import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = (page - 1) * limit

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { data: cases, count, error } = await supabase
    .from('root_cause_predictions')
    .select('*', { count: 'exact' })
    .order('predicted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch all entities to map names
  const [factoriesRes, warehousesRes, couriersRes] = await Promise.all([
    supabase.from('factory').select('factory_id, factory_name'),
    supabase.from('warehouse').select('warehouse_id, warehouse_name'),
    supabase.from('courier').select('courier_id, courier_provider')
  ])

  const factories = Object.fromEntries(factoriesRes.data?.map(f => [f.factory_id, f.factory_name]) || [])
  const warehouses = Object.fromEntries(warehousesRes.data?.map(w => [w.warehouse_id, w.warehouse_name]) || [])
  const couriers = Object.fromEntries(couriersRes.data?.map(c => [c.courier_id, c.courier_provider]) || [])

  const enrichedCases = cases?.map(c => {
    let candidateName = c.candidate_id;
    if (c.candidate_type === 'factory') candidateName = factories[c.candidate_id] || candidateName;
    else if (c.candidate_type === 'warehouse') candidateName = warehouses[c.candidate_id] || candidateName;
    else if (c.candidate_type === 'courier') candidateName = couriers[c.candidate_id] || candidateName;
    
    return {
      ...c,
      candidate_name: candidateName
    }
  })

  return NextResponse.json({ data: enrichedCases, count, page, limit })
}
