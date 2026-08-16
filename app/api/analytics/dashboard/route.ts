import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';

async function fetchDashboardData() {
  const supabase = createServiceClient();

  // 1. Fetch Summary KPIs
  const { count: totalReviews } = await supabase.from('review').select('*', { count: 'exact', head: true });
  const { count: lowRatings } = await supabase.from('review').select('*', { count: 'exact', head: true }).lte('rating', 2);
  const { count: predictedComplaints } = await supabase.from('complaint_prediction').select('*', { count: 'exact', head: true });
  const { count: totalAnomalies } = await supabase.from('root_cause_predictions').select('*', { count: 'exact', head: true });

  // 2. Accuracy Metric (against ground truth)
  const { data: rootCausePredictions } = await supabase.from('root_cause_predictions').select('*');
  const { data: groundTruth } = await supabase.from('incidents').select('*');

  let correctCount = 0;
  const detectedGroups = new Set();

  // Group anomalies to match with ground truth windows
  if (rootCausePredictions && groundTruth) {
    rootCausePredictions.forEach(pred => {
      const pStart = new Date(pred.detected_period_start).getTime();
      const groupKey = `${pred.incident_type}_${pStart}`;

      if (!detectedGroups.has(groupKey)) {
        detectedGroups.add(groupKey);

        // Check if it matches any ground truth
        const isMatch = groundTruth.some(gt => {
          const gtStart = new Date(gt.start_date).getTime();
          const gtEnd = new Date(gt.end_date).getTime();

          return gt.incident_type === pred.incident_type &&
                 pStart >= (gtStart - 7 * 24 * 60 * 60 * 1000) && // within 7 days
                 pStart <= (gtEnd + 7 * 24 * 60 * 60 * 1000) &&
                 gt.entity_id === pred.candidate_id;
        });

        if (isMatch) correctCount++;
      }
    });
  }

  const accuracy = detectedGroups.size > 0 ? (correctCount / detectedGroups.size) * 100 : 0;

  // 3. Timeseries Data
  const { data: timeseriesData, error: timeseriesError } = await supabase
    .from('daily_complaints_view')
    .select('*')
    .order('date', { ascending: true });

  if (timeseriesError) {
    throw timeseriesError;
  }

  const timeseries = timeseriesData || [];

  // 4. Rankings
  interface RankedEntity {
    id: string;
    name: string;
    anomaly_count: number;
  }

  const rankings: {
    factories: RankedEntity[];
    warehouses: RankedEntity[];
    couriers: RankedEntity[];
  } = {
    factories: [],
    warehouses: [],
    couriers: []
  };

  if (rootCausePredictions) {
    const groupedCounts: Record<string, number> = {};
    rootCausePredictions.forEach(pred => {
      const key = `${pred.candidate_type}_${pred.candidate_id}`;
      groupedCounts[key] = (groupedCounts[key] || 0) + 1;
    });

    const { data: factories } = await supabase.from('factory').select('factory_id, factory_name');
    const { data: warehouses } = await supabase.from('warehouse').select('warehouse_id, warehouse_name');
    const { data: couriers } = await supabase.from('courier').select('courier_id, courier_provider');

    factories?.forEach(f => {
      const count = groupedCounts[`factory_${f.factory_id}`] || 0;
      if (count > 0) rankings.factories.push({ id: f.factory_id, name: f.factory_name, anomaly_count: count });
    });
    warehouses?.forEach(w => {
      const count = groupedCounts[`warehouse_${w.warehouse_id}`] || 0;
      if (count > 0) rankings.warehouses.push({ id: w.warehouse_id, name: w.warehouse_name, anomaly_count: count });
    });
    couriers?.forEach(c => {
      const count = groupedCounts[`courier_${c.courier_id}`] || 0;
      if (count > 0) rankings.couriers.push({ id: c.courier_id, name: c.courier_provider, anomaly_count: count });
    });

    rankings.factories.sort((a, b) => b.anomaly_count - a.anomaly_count);
    rankings.warehouses.sort((a, b) => b.anomaly_count - a.anomaly_count);
    rankings.couriers.sort((a, b) => b.anomaly_count - a.anomaly_count);
  }

  return {
    kpis: {
      totalReviews,
      lowRatings,
      predictedComplaints,
      totalAnomalies,
      accuracy
    },
    timeseries,
    rankings,
    anomalies: rootCausePredictions || []
  };
}

const getCachedDashboardData = unstable_cache(
  fetchDashboardData,
  ['dashboard-analytics'],
  { revalidate: 300, tags: ['dashboard-analytics'] }
);

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isFresh = request.nextUrl.searchParams.get('fresh') === 'true';
    const data = isFresh ? await fetchDashboardData() : await getCachedDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
