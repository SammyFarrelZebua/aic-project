import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Settings as SettingsIcon, Database, Cpu, Mail, BadgeCheck, Shield } from 'lucide-react'

export const metadata = { title: "Pengaturan | Detektif Kemasan" }

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Pengaturan</h1>
          <p className="text-ink-muted">Informasi pengguna dan konfigurasi sistem.</p>
        </div>
        <SettingsIcon className="h-8 w-8 text-ink-muted" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-paper border-line">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-ink-muted" /> Profil Pengguna
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-paper-raised rounded-md border border-line">
                  <div className="h-12 w-12 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-xl mr-4">
                    {profile?.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-bold text-ink">{profile?.full_name || 'Pengguna'}</div>
                    <div className="text-sm text-ink-muted flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {user.email}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-paper-raised rounded-md border border-line">
                    <div className="font-case text-xs uppercase text-ink-muted mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Role
                    </div>
                    <div className="font-medium text-ink">
                      {profile?.role || 'Administrator'}
                    </div>
                  </div>
                  <div className="p-4 bg-paper-raised rounded-md border border-line">
                    <div className="font-case text-xs uppercase text-ink-muted mb-1 flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" /> Status
                    </div>
                    <div className="font-medium text-cleared">
                      Aktif Terverifikasi
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-ink-muted border border-dashed border-line rounded-md">
                <p>Informasi pengguna tidak tersedia atau sesi telah berakhir.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-paper border-line">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-ink-muted" /> Informasi Sistem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-paper-raised rounded-md border border-line flex items-start gap-3">
              <Cpu className="h-5 w-5 text-ink-muted mt-0.5" />
              <div>
                <div className="font-bold text-ink">Pipeline Model AI</div>
                <div className="text-sm text-ink-muted mb-2">Menggunakan mDeBERTa-v3-base untuk analisis sentimen dan ekstraksi topik komplain.</div>
                <div className="inline-flex px-2 py-1 bg-evidence-glow/10 text-evidence-glow text-xs font-case rounded border border-evidence-glow/20 uppercase">
                  V0.1.0-beta
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-paper-raised rounded-md border border-line flex items-start gap-3">
              <Database className="h-5 w-5 text-ink-muted mt-0.5" />
              <div>
                <div className="font-bold text-ink">Sumber Dataset</div>
                <div className="text-sm text-ink-muted">Terlatih pada dataset E-Commerce Olist Brazil (terjemahan) & sintesis kasus lokal.</div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-line text-xs text-center text-ink-muted font-case uppercase">
              Detektif Kemasan App v0.1.0
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
