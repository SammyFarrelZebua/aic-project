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

  let selectStr = type !== 'All' 
    ? `*, complaint_prediction!inner(*)` 
    : `*, complaint_prediction(*)`

  if (factoryId) {
    selectStr += `, orders!inner(batch!inner(factory_id))`
  } else if (warehouseId) {
    selectStr += `, orders!inner(warehouse_id)`
  } else if (courierId) {
    selectStr += `, orders!inner(shipment!inner(courier_id))`
  }

  let query = supabase.from('review').select(selectStr, { count: 'exact' })

  if (search) {
    query = query.ilike('review_text', `%${search}%`)
  }
  
  if (rating !== 'All') {
    query = query.eq('rating', parseInt(rating, 10))
  }

  if (type !== 'All') {
    query = query.eq('complaint_prediction.complaint_type', type)
  }

  if (factoryId) {
    query = query.eq('orders.batch.factory_id', factoryId)
  }
  if (warehouseId) {
    query = query.eq('orders.warehouse_id', warehouseId)
  }
  if (courierId) {
    query = query.eq('orders.shipment.courier_id', courierId)
  }

  query = query.order('review_date', { ascending: false })
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count, page, limit })
}
