import * as fs from 'fs';
import * as path from 'path';
import { createServiceClient } from '../utils/supabase/service';

// Load environment variables from .env.local or .env
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let value = parts.slice(1).join('=').trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.log(`Loaded environment variables from ${envPath}`);
      return;
    }
  }
}

loadEnv();

async function run() {
  const supabase = createServiceClient();

  console.log('--- Checking Database Record Counts ---');

  const tables = [
    'factory',
    'warehouse',
    'courier',
    'product',
    'batch',
    'orders',
    'shipment',
    'review',
    'incidents'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`Error counting table ${table}:`, error.message);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }

  console.log('\n--- Checking Analytical View Traceability & Joins ---');
  const { data: viewSample, count: viewCount, error: viewError } = await supabase
    .from('analytics_traceability_view')
    .select('*', { count: 'exact' })
    .limit(5);

  if (viewError) {
    console.error('Error querying analytics_traceability_view:', viewError.message);
  } else {
    console.log(`analytics_traceability_view: ${viewCount} records total`);
    console.log('Sample record keys:', Object.keys(viewSample[0] || {}));
  }

  console.log('\n--- Validating Controlled Incident Injections ---');

  // Query Factory C stats
  const { data: factStats, error: factError } = await supabase
    .from('analytics_traceability_view')
    .select('review_score, review_comment_message, factory_name')
    .eq('factory_name', 'Factory C');

  if (factError) {
    console.error('Error checking Factory C stats:', factError.message);
  } else if (factStats) {
    const total = factStats.length;
    const lowScore = factStats.filter(s => s.review_score <= 2).length;
    const hasDefectKeyword = factStats.filter(s => s.review_comment_message && s.review_comment_message.includes('cacat')).length;
    console.log(`Factory C: Total reviews = ${total}, Low score (<=2) = ${lowScore} (${((lowScore/total)*100).toFixed(2)}%), Mentioning "cacat" = ${hasDefectKeyword}`);
  }

  // Query Warehouse South stats
  const { data: whStats, error: whError } = await supabase
    .from('analytics_traceability_view')
    .select('review_score, review_comment_message, warehouse_name')
    .eq('warehouse_name', 'Warehouse South');

  if (whError) {
    console.error('Error checking Warehouse South stats:', whError.message);
  } else if (whStats) {
    const total = whStats.length;
    const lowScore = whStats.filter(s => s.review_score <= 2).length;
    const hasDamageKeyword = whStats.filter(s => s.review_comment_message && s.review_comment_message.includes('kemasan')).length;
    console.log(`Warehouse South: Total reviews = ${total}, Low score (<=2) = ${lowScore} (${((lowScore/total)*100).toFixed(2)}%), Mentioning "kemasan" = ${hasDamageKeyword}`);
  }

  // Query Courier Fast Express stats
  const { data: courierStats, error: courierError } = await supabase
    .from('analytics_traceability_view')
    .select('review_score, review_comment_message, courier_name, shipment_date, shipment_delivery_date')
    .eq('courier_name', 'Courier Fast Express');

  if (courierError) {
    console.error('Error checking Courier Fast Express stats:', courierError.message);
  } else if (courierStats) {
    const total = courierStats.length;
    const lowScore = courierStats.filter(s => s.review_score <= 2).length;
    const hasDelayKeyword = courierStats.filter(s => s.review_comment_message && s.review_comment_message.includes('telat')).length;

    // Check actual delayed delivery counts
    let delayCalculated = 0;
    courierStats.forEach(s => {
      if (s.shipment_date && s.shipment_delivery_date) {
        const ship = new Date(s.shipment_date);
        const del = new Date(s.shipment_delivery_date);
        const diffDays = (del.getTime() - ship.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
          delayCalculated++;
        }
      }
    });

    console.log(`Courier Fast Express: Total reviews = ${total}, Low score (<=2) = ${lowScore} (${((lowScore/total)*100).toFixed(2)}%), Mentioning "telat" = ${hasDelayKeyword}, Calculated late deliveries (>7 days) = ${delayCalculated}`);
  }
}

run().catch(err => {
  console.error('Validation script failed:', err);
  process.exit(1);
});
