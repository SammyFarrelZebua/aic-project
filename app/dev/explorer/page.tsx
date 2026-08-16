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
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Gagal memuat skema database.'
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
    <div className="flex flex-col min-h-screen bg-paper text-ink">
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
        {/* Header */}
        <header className="border-b border-line pb-6 mb-10">
          <div className="flex items-center gap-2 text-xs font-case tracking-wider text-ink-muted uppercase mb-2">
            <span className="w-2 h-2 rounded-full bg-cleared" />
            Supabase Database Explorer
          </div>
          <h1 className="text-3xl font-case tracking-tight text-ink">
            Skema Proyek Supabase
          </h1>
          <p className="text-ink-muted text-sm mt-1">
            {isUsingSecretKey && isAuthorized
              ? 'Menampilkan seluruh tabel dan kolom secara dinamis menggunakan Secret Key.'
              : 'Menampilkan skema tabel default (Akses Publik Terbatas).'}
          </p>
        </header>

        {/* Configuration Error */}
        {!isConfigured && (
          <div className="bg-alert-soft border border-alert/30 rounded-xl p-6 text-alert mb-8">
            <h3 className="font-semibold mb-1">Kredensial Belum Terkoneksi</h3>
            <p className="text-sm">Silakan buat `.env.local` dan isi kredensial Supabase Anda.</p>
          </div>
        )}

        {/* Info Banner when fallback is used */}
        {isConfigured && (!isUsingSecretKey || !isAuthorized) && (
          <div className="bg-alert-soft border border-alert/20 rounded-xl p-5 text-alert mb-8 text-sm">
            <h4 className="font-bold">Deteksi Otomatis Tabel Terbatas</h4>
            <p className="mt-1 opacity-90">
              Kunci publik (publishable) tidak memiliki izin untuk mengintip seluruh daftar tabel. Halaman ini menggunakan tampilan skema statis untuk tabel <strong>factory</strong>.
            </p>
            <p className="mt-2 text-xs opacity-70 font-case">
              Untuk mengaktifkan deteksi dinamis semua tabel, tambahkan: SUPABASE_SERVICE_ROLE_KEY=sb_secret_... di .env.local
            </p>
          </div>
        )}

        {/* API Fetch Error */}
        {isConfigured && errorMsg && (
          <div className="bg-alert-soft border border-alert/30 rounded-xl p-6 text-alert mb-8">
            <h3 className="font-semibold mb-1">Gagal Membaca Skema Database</h3>
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Dynamic Tables list (Using Secret Key) */}
        {isConfigured && !errorMsg && isAuthorized && isUsingSecretKey && (
          <div className="space-y-8">
            {tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-line rounded-2xl py-20 text-center">
                <h3 className="text-lg font-semibold text-ink">Tidak Ada Tabel Publik Terdeteksi</h3>
              </div>
            ) : (
              tables.map((table) => (
                <section
                  key={table.name}
                  className="bg-paper-raised border border-line rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="bg-paper-raised border-b border-line px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cleared-soft text-cleared rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-case tracking-tight text-ink">
                        Tabel: <span className="text-cleared">{table.name}</span>
                      </h2>
                    </div>
                    <span className="text-xs font-case px-2.5 py-1 rounded bg-paper text-ink-muted border border-line">
                      {table.columns.length} Kolom
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-line bg-paper text-xs font-case uppercase tracking-wider text-ink-muted">
                          <th className="px-6 py-3">Nama Kolom</th>
                          <th className="px-6 py-3">Tipe Data</th>
                          <th className="px-6 py-3">Format</th>
                          <th className="px-6 py-3 text-right">Aturan / Constraint</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-case text-sm text-ink">
                        {table.columns.map((col) => (
                          <tr key={col.name} className="hover:bg-paper transition duration-150">
                            <td className="px-6 py-4 font-semibold text-ink select-all">{col.name}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded text-xs bg-paper text-ink-muted border border-line">
                                {col.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-ink-muted">{col.format || '-'}</td>
                            <td className="px-6 py-4 text-right">
                              {col.required ? (
                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-alert-soft text-alert border border-alert/30">
                                  Required
                                </span>
                              ) : (
                                <span className="text-xs text-ink-muted">Nullable</span>
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
          <section className="bg-paper-raised border border-line rounded-xl overflow-hidden shadow-sm">
            <div className="bg-paper-raised border-b border-line px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cleared-soft text-cleared rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-case tracking-tight text-ink">
                  Tabel: <span className="text-cleared">factory</span>
                </h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-paper text-xs font-case uppercase tracking-wider text-ink-muted">
                    <th className="px-6 py-3">Nama Kolom</th>
                    <th className="px-6 py-3">Tipe Data</th>
                    <th className="px-6 py-3 text-right">Constraint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-case text-sm text-ink">
                  {fallbackFactorySchema.map((col) => (
                    <tr key={col.name} className="hover:bg-paper transition duration-150">
                      <td className="px-6 py-4 font-semibold text-ink">{col.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-paper text-ink-muted border border-line">
                          {col.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          col.constraint.includes('PRIMARY') || col.constraint.includes('NOT NULL')
                            ? 'bg-alert-soft text-alert border border-alert/30'
                            : 'bg-paper text-ink-muted border border-line'
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
      <footer className="border-t border-line bg-paper py-6 text-center text-xs text-ink-muted select-none">
        <p>© 2026 AIC Project x Supabase. All rights reserved.</p>
      </footer>
    </div>
  )
}
