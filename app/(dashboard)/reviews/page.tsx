"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Loader2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/utils/cn"
import { translateIncidentType } from "@/lib/pipeline-messages"

interface ReviewPrediction {
  complaint_type: string
  severity: string
  confidence: number
  prob_product_defect?: number
  prob_packaging_damage?: number
  prob_late_delivery?: number
}

interface ReviewItem {
  review_id: string
  review_date: string
  rating: number
  review_text: string
  complaint_prediction?: ReviewPrediction[]
}

function ReviewsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initFactoryId = searchParams.get("factory_id") || ""
  const initWarehouseId = searchParams.get("warehouse_id") || ""
  const initCourierId = searchParams.get("courier_id") || ""
  const initType = searchParams.get("type") || "All"

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [type, setType] = useState(initType)
  const [rating, setRating] = useState("All")
  const [page, setPage] = useState(1)
  const limit = 20

  const [factoryId] = useState(initFactoryId)
  const [warehouseId] = useState(initWarehouseId)
  const [courierId] = useState(initCourierId)

  const hasEntityFilter = !!(factoryId || warehouseId || courierId)
  const entityFilterLabel = factoryId
    ? `Pabrik: ${factoryId}`
    : warehouseId
    ? `Gudang: ${warehouseId}`
    : courierId
    ? `Kurir: ${courierId}`
    : ""

  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true)
      try {
        const params: Record<string, string> = {
          search,
          type,
          rating,
          factory_id: factoryId,
          warehouse_id: warehouseId,
          courier_id: courierId,
          page: page.toString(),
          limit: limit.toString()
        }
        const query = new URLSearchParams(params)
        const res = await fetch(`/api/reviews?${query.toString()}`)
        const data = await res.json()
        setReviews(data.data || [])
        setTotal(data.count || 0)
      } catch (err) {
        console.error("Failed to fetch reviews", err)
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchReviews()
    }, 300)

    return () => clearTimeout(timer)
  }, [search, type, rating, page, factoryId, warehouseId, courierId])

  const clearEntityFilters = () => {
    setPage(1)
    router.push("/reviews")
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Ulasan</h1>
        <p className="text-sm text-ink-muted mt-1">Daftar ulasan pelanggan dan hasil klasifikasi AI</p>
      </div>

      {hasEntityFilter && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-alert-soft/40 border border-alert/20 rounded-lg text-sm text-alert">
          <span className="font-medium">Filter aktif:</span>
          <span className="font-case">{entityFilterLabel}</span>
          <button
            onClick={clearEntityFilters}
            className="ml-auto flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Hapus filter
          </button>
        </div>
      )}

      <Card className="bg-paper border-line">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Cari teks review..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-paper-raised border border-line rounded text-sm focus:outline-none focus:border-ink transition-colors text-ink"
              />
            </div>
            
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-paper-raised border border-line rounded text-sm focus:outline-none focus:border-ink transition-colors text-ink font-case"
            >
              <option value="All">Semua Komplain</option>
              <option value="PRODUCT_DEFECT">Cacat Produk</option>
              <option value="PACKAGING_DAMAGE">Kemasan Rusak</option>
              <option value="LATE_DELIVERY">Keterlambatan</option>
            </select>

            <select
              value={rating}
              onChange={(e) => { setRating(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-paper-raised border border-line rounded text-sm focus:outline-none focus:border-ink transition-colors text-ink tabular-figures"
            >
              <option value="All">Semua Rating</option>
              <option value="1">1 Bintang</option>
              <option value="2">2 Bintang</option>
              <option value="3">3 Bintang</option>
              <option value="4">4 Bintang</option>
              <option value="5">5 Bintang</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-ink-muted uppercase bg-paper-raised border-y border-line font-case">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Teks Review</th>
                  <th className="px-4 py-3 font-medium">Tipe Komplain</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium text-right">Cacat Produk</th>
                  <th className="px-4 py-3 font-medium text-right">Kemasan Rusak</th>
                  <th className="px-4 py-3 font-medium text-right">Keterlambatan</th>
                  <th className="px-4 py-3 font-medium text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-ink-muted mx-auto" />
                    </td>
                  </tr>
                ) : reviews.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-ink-muted">
                      Tidak ada ulasan yang ditemukan
                    </td>
                  </tr>
                ) : (
                  reviews.map((review) => {
                    const prediction = review.complaint_prediction?.[0]
                    return (
                      <tr key={review.review_id} className="border-b border-line hover:bg-paper-raised/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap tabular-figures text-ink-muted">
                          {new Date(review.review_date).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-4 py-3 tabular-figures text-alert">
                          {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                        </td>
                        <td className="px-4 py-3 text-ink max-w-[300px] truncate" title={review.review_text}>
                          {review.review_text}
                        </td>
                        <td className="px-4 py-3">
                          {prediction ? (
                            <span className={cn(
                              "px-2 py-1 text-[10px] font-case rounded uppercase tracking-wider",
                              "bg-alert-soft text-alert"
                            )}>
                              {translateIncidentType(prediction.complaint_type)}
                            </span>
                          ) : (
                            <span className="text-ink-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {prediction ? (
                            <span className={cn(
                              "px-2 py-1 text-[10px] font-case rounded uppercase tracking-wider",
                              prediction.severity === "HIGH" && "bg-alert-soft text-alert",
                              prediction.severity === "MEDIUM" && "bg-paper-raised text-ink-muted",
                              prediction.severity === "LOW" && "bg-cleared-soft text-cleared"
                            )}>
                              {prediction.severity}
                            </span>
                          ) : (
                            <span className="text-ink-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-figures text-ink-muted">
                          {prediction && prediction.prob_product_defect !== undefined ? `${(prediction.prob_product_defect * 100).toFixed(1)}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-figures text-ink-muted">
                          {prediction && prediction.prob_packaging_damage !== undefined ? `${(prediction.prob_packaging_damage * 100).toFixed(1)}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-figures text-ink-muted">
                          {prediction && prediction.prob_late_delivery !== undefined ? `${(prediction.prob_late_delivery * 100).toFixed(1)}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-figures font-medium">
                          {prediction ? `${(prediction.confidence * 100).toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <span className="text-sm text-ink-muted tabular-figures">
                Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm bg-paper border border-line rounded disabled:opacity-50 text-ink hover:bg-paper-raised"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm bg-paper border border-line rounded disabled:opacity-50 text-ink hover:bg-paper-raised"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    }>
      <ReviewsContent />
    </Suspense>
  )
}
