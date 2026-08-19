import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const type = searchParams.get('type') || 'All'
  const rating = searchParams.get('rating') || 'All'
  const factoryId = searchParams.get('factory_id') || ''
  const warehouseId = searchParams.get('warehouse_id') || ''
  const courierId = searchParams.get('courier_id') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = (page - 1) * limit

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // If filtering by complaint type, resolve matching review_ids first so the
  // filter can be applied server-side, before pagination -- complaint_prediction
  // is cheap to query for this since only a small fraction of rows are non-NORMAL.
  let typeReviewIds: string[] | null = null
  if (type !== 'All') {
    const { data: typeRows, error: typeError } = await supabase
      .from('complaint_prediction')
      .select('review_id')
      .eq('complaint_type', type)

    if (typeError) {
      return NextResponse.json({ error: typeError.message }, { status: 500 })
    }
    typeReviewIds = (typeRows || []).map(r => r.review_id)
    if (typeReviewIds.length === 0) {
      return NextResponse.json({ data: [], count: 0, page, limit })
    }
  }

  // Query analytics_traceability_view (not the raw `review` table) so entity
  // filters (factory/warehouse/courier) can be applied directly -- review.order_id
  // is an order UUID, not a factory/warehouse/courier id, so filtering the raw
  // table can never match.
  let query = supabase
    .from('analytics_traceability_view')
    .select('review_id, review_score, review_comment_message, review_creation_date', { count: 'exact' })

  if (search) {
    query = query.ilike('review_comment_message', `%${search}%`)
  }

  if (rating !== 'All') {
    query = query.eq('review_score', parseInt(rating, 10))
  }

  if (factoryId) {
    query = query.eq('factory_id', factoryId)
  } else if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  } else if (courierId) {
    query = query.eq('courier_id', courierId)
  }

  if (typeReviewIds) {
    query = query.in('review_id', typeReviewIds)
  }

  query = query.order('review_creation_date', { ascending: false })
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const reviews = (data || []).map(r => ({
    review_id: r.review_id,
    review_date: r.review_creation_date,
    rating: r.review_score,
    review_text: r.review_comment_message
  }))
  const reviewIds = reviews.map(r => r.review_id)

  let predictions: any[] = []
  if (reviewIds.length > 0) {
    const { data: preds, error: predError } = await supabase
      .from('complaint_prediction')
      .select('review_id, complaint_type, severity, confidence, prob_product_defect, prob_packaging_damage, prob_late_delivery')
      .in('review_id', reviewIds)

    if (!predError) {
      predictions = preds || []
    }
  }

  // Attach prediction(s) to each review
  const reviewsWithPreds = reviews.map(r => ({
    ...r,
    complaint_prediction: predictions.filter(p => p.review_id === r.review_id)
  }))

  return NextResponse.json({ data: reviewsWithPreds, count, page, limit })
}
