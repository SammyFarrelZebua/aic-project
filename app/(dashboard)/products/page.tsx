import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/utils/cn'
import { AlertCircle, Package, Search } from 'lucide-react'

export const metadata = { title: "Produk | Detektif Kemasan" }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string; limit?: string; search?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const page = resolvedSearchParams?.page ? parseInt(resolvedSearchParams.page as string, 10) : 1
  const limit = resolvedSearchParams?.limit ? parseInt(resolvedSearchParams.limit as string, 10) : 50
  const search = (resolvedSearchParams?.search as string) || ''
  const offset = (page - 1) * limit

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  let query = supabase
    .from('product_stats_view')
    .select('*', { count: 'exact' })

  if (search.trim()) {
    query = query.or(`product_name.ilike.%${search.trim()}%,brand.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`)
  }

  const { data, count } = await query
    .order('complaint_count', { ascending: false })
    .range(offset, offset + limit - 1)

  const productStats = data?.map(p => ({
    product_id: p.product_id,
    product_name: p.product_name,
    category: p.category,
    brand: p.brand,
    price: p.price,
    orderCount: p.order_count,
    complaintCount: p.complaint_count,
    needsAlert: p.needs_alert
  })) || []
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Produk</h1>
          <p className="text-ink-muted">Pantau daftar produk dan metrik komplain.</p>
        </div>
        <Package className="h-8 w-8 text-ink-muted" />
      </div>

      {/* Search Bar */}
      <form method="GET" className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Cari nama produk, brand, kategori..."
            className="w-full rounded-md border border-line bg-paper pl-9 pr-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-cleared focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-paper-raised border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper transition-colors"
        >
          Cari
        </button>
        {search && (
          <Link
            href="/products"
            className="rounded-md border border-line px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-paper transition-colors"
          >
            Reset
          </Link>
        )}
      </form>
      
      <Card className="bg-paper border-line">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-paper-raised text-ink-muted font-case uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Nama Produk</th>
                  <th className="px-6 py-4 font-medium">Kategori</th>
                  <th className="px-6 py-4 font-medium">Brand</th>
                  <th className="px-6 py-4 font-medium">Harga</th>
                  <th className="px-6 py-4 font-medium text-right">Jml Order</th>
                  <th className="px-6 py-4 font-medium text-right">Jml Komplain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink">
                {productStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-ink-muted">
                      Tidak ada produk ditemukan.
                    </td>
                  </tr>
                ) : (
                  productStats.map(p => (
                    <tr key={p.product_id} className="hover:bg-paper-raised/50 transition-colors">
                      <td className="px-6 py-4 font-medium flex items-center gap-2">
                        {p.product_name}
                        {p.needsAlert && (
                          <span title="Rasio komplain tinggi">
                            <AlertCircle className="h-4 w-4 text-alert" />
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{p.category}</td>
                      <td className="px-6 py-4">{p.brand}</td>
                      <td className="px-6 py-4 tabular-figures">
                        Rp {new Intl.NumberFormat('id-ID').format(p.price)}
                      </td>
                      <td className="px-6 py-4 text-right tabular-figures">{p.orderCount}</td>
                      <td className={cn(
                        "px-6 py-4 text-right tabular-figures font-medium",
                        p.needsAlert ? "text-alert" : "text-ink"
                      )}>
                        {p.complaintCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {count !== null && count > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-sm text-ink-muted">
            Menampilkan <span className="font-medium text-ink tabular-figures">{count ? offset + 1 : 0}</span> - <span className="font-medium text-ink tabular-figures">{Math.min(offset + limit, count || 0)}</span> dari <span className="font-medium text-ink tabular-figures">{count}</span> produk
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted font-case mr-2">
              Halaman {page} dari {Math.ceil((count || 0) / limit) || 1}
            </span>
            {page > 1 ? (
              <Link
                href={`/products?page=${page - 1}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                className="px-3 py-1.5 text-xs font-medium border border-line rounded bg-paper-raised text-ink hover:bg-paper transition-colors"
              >
                Previous
              </Link>
            ) : (
              <button disabled className="px-3 py-1.5 text-xs font-medium border border-line rounded text-ink-muted opacity-50 cursor-not-allowed">
                Previous
              </button>
            )}
            {offset + limit < (count || 0) ? (
              <Link
                href={`/products?page=${page + 1}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                className="px-3 py-1.5 text-xs font-medium border border-line rounded bg-paper-raised text-ink hover:bg-paper transition-colors"
              >
                Next
              </Link>
            ) : (
              <button disabled className="px-3 py-1.5 text-xs font-medium border border-line rounded text-ink-muted opacity-50 cursor-not-allowed">
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
