import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

interface ColumnInfo {
  name: string
  type: string
  format?: string
  required: boolean
}

interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Gunakan service role key jika ada, fallback ke publishable key
  const activeKey = serviceRoleKey || publishableKey
  const isUsingSecretKey = !!serviceRoleKey

  let tables: TableInfo[] = []
  let isAuthorized = true
  let errorMsg: string | null = null

  // Coba ambil skema database secara dinamis
  if (supabaseUrl && activeKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: activeKey,
          Authorization: `Bearer ${activeKey}`,
        },
        next: { revalidate: 0 },
      })

      if (response.status === 401) {
        isAuthorized = false
      } else if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      } else {
        const schema = await response.json()
        const definitions = schema.definitions || {}

        tables = Object.keys(definitions).map((tableName) => {
          const tableDefinition = definitions[tableName]
          const properties = tableDefinition.properties || {}
          const requiredFields = tableDefinition.required || []

          const columns = Object.keys(properties).map((colName) => {
            const prop = properties[colName]
            return {
              name: colName,
              type: prop.type || 'unknown',
              format: prop.format,
              required: requiredFields.includes(colName),
            }
          })

          return {
            name: tableName,
            columns,
          }
        })
      }
    } catch (err: any) {
      errorMsg = err.message || 'Gagal memuat skema database.'
    }
  }

  // Fallback ke skema statis tabel factory jika tidak memiliki akses rahasia (kunci publishable)
  const fallbackFactorySchema = [
    { name: 'factory_id', type: 'VARCHAR(50)', constraint: 'PRIMARY KEY (Not Null)' },
    { name: 'factory_name', type: 'VARCHAR(150)', constraint: 'NOT NULL' },
    { name: 'city', type: 'VARCHAR(100)', constraint: 'NULL (Optional)' },
    { name: 'province', type: 'VARCHAR(100)', constraint: 'NULL (Optional)' },
  ]

  const isConfigured = !!(supabaseUrl && publishableKey)

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-emerald-950/15 via-transparent to-transparent blur-[120px] pointer-events-none -z-10" />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
        {/* Header */}
        <header className="border-b border-zinc-800/80 pb-6 mb-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Supabase Database Explorer
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Skema Proyek Supabase
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isUsingSecretKey && isAuthorized
              ? 'Menampilkan seluruh tabel dan kolom secara dinamis menggunakan Secret Key.'
              : 'Menampilkan skema tabel default (Akses Publik Terbatas).'}
          </p>
        </header>

        {/* Configuration Error */}
        {!isConfigured && (
          <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 text-red-200 mb-8">
            <h3 className="font-semibold text-red-300 mb-1">Kredensial Belum Terkoneksi</h3>
            <p className="text-sm">Silakan buat `.env.local` dan isi kredensial Supabase Anda.</p>
          </div>
        )}

        {/* Info Banner when fallback is used */}
        {isConfigured && (!isUsingSecretKey || !isAuthorized) && (
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-5 text-amber-250 mb-8 text-sm">
            <h4 className="font-bold text-amber-300">💡 Deteksi Otomatis Tabel Terbatas</h4>
            <p className="mt-1 opacity-90">
              Kunci publik (publishable) tidak memiliki izin untuk mengintip seluruh daftar tabel. Halaman ini menggunakan tampilan skema statis untuk tabel <strong>factory</strong>.
            </p>
            <p className="mt-2 text-xs text-amber-400/70 font-mono">
              Untuk mengaktifkan deteksi dinamis semua tabel, tambahkan: SUPABASE_SERVICE_ROLE_KEY=sb_secret_... di .env.local
            </p>
          </div>
        )}

        {/* API Fetch Error */}
        {isConfigured && errorMsg && (
          <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 text-red-200 mb-8">
            <h3 className="font-semibold text-red-300 mb-1">Gagal Membaca Skema Database</h3>
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Dynamic Tables list (Using Secret Key) */}
        {isConfigured && !errorMsg && isAuthorized && isUsingSecretKey && (
          <div className="space-y-8">
            {tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl py-20 text-center">
                <h3 className="text-lg font-semibold text-white">Tidak Ada Tabel Publik Terdeteksi</h3>
              </div>
            ) : (
              tables.map((table) => (
                <section 
                  key={table.name} 
                  className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl"
                >
                  <div className="bg-zinc-900/80 border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-950/50 text-emerald-400 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Tabel: <span className="text-emerald-400 font-mono">{table.name}</span>
                      </h2>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                      {table.columns.length} Kolom
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-950/20 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          <th className="px-6 py-3">Nama Kolom</th>
                          <th className="px-6 py-3">Tipe Data</th>
                          <th className="px-6 py-3">Format</th>
                          <th className="px-6 py-3 text-right">Aturan / Constraint</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 font-mono text-sm text-zinc-300">
                        {table.columns.map((col) => (
                          <tr key={col.name} className="hover:bg-zinc-900/20 transition duration-150">
                            <td className="px-6 py-4 font-bold text-white select-all">{col.name}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 border border-zinc-750">
                                {col.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-zinc-500">{col.format || '-'}</td>
                            <td className="px-6 py-4 text-right">
                              {col.required ? (
                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-red-950/50 text-red-400 border border-red-900/30">
                                  Required
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-650">Nullable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* Fallback Static View (When only Publishable Key is used) */}
        {isConfigured && (!isUsingSecretKey || !isAuthorized) && (
          <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="bg-zinc-900/80 border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-950/50 text-emerald-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Tabel: <span className="text-emerald-400 font-mono">factory</span>
                </h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/20 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-6 py-3">Nama Kolom</th>
                    <th className="px-6 py-3">Tipe Data</th>
                    <th className="px-6 py-3 text-right">Constraint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 font-mono text-sm text-zinc-350">
                  {fallbackFactorySchema.map((col) => (
                    <tr key={col.name} className="hover:bg-zinc-900/20 transition duration-150">
                      <td className="px-6 py-4 font-bold text-white">{col.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 border border-zinc-750">
                          {col.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          col.constraint.includes('PRIMARY') || col.constraint.includes('NOT NULL')
                            ? 'bg-amber-950/50 text-amber-400 border border-amber-900/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {col.constraint}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500 select-none">
        <p>© 2026 AIC Project x Supabase. All rights reserved.</p>
      </footer>
    </div>
  )
}
