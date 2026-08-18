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

  // Build review query WITHOUT embedding complaint_prediction (the joined query
  // times out on 15k+ rows). We select predictions in a second pass instead.
  let query = supabase.from('review').select('*', { count: 'exact' })

  if (search) {
    query = query.ilike('review_text', `%${search}%`)
  }

  if (rating !== 'All') {
    query = query.eq('rating', parseInt(rating, 10))
  }

  if (factoryId) {
    // Filter via order -> batch -> factory
    query = query.eq('order_id', factoryId)
  } else if (warehouseId) {
    query = query.eq('order_id', warehouseId)
  } else if (courierId) {
    query = query.eq('order_id', courierId)
  }

  query = query.order('review_date', { ascending: false })
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const reviews = data || []
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

  // If a type filter was requested, apply it in-memory (since we no longer filter server-side)
  let result = reviewsWithPreds
  if (type !== 'All') {
    result = reviewsWithPreds.filter(r =>
      r.complaint_prediction && r.complaint_prediction.length > 0 && r.complaint_prediction[0].complaint_type === type
    )
  }

  return NextResponse.json({ data: result, count, page, limit })
}
