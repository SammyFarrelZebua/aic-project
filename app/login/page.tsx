import { Suspense } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { DossierPanel } from "@/components/auth/dossier-panel"
import { getDossierSummary } from "@/lib/dossier-summary"

async function DossierAside() {
  const summary = await getDossierSummary()
  return <DossierPanel summary={summary} />
}

export default function LoginPage() {
  return (
    <AuthShell
      heading="Masuk ke sistem"
      subtext="Masuk untuk melihat status investigasi rantai pasok dan alert terkini dari tim kamu."
      footer={
        <p className="mt-8 text-[13px] text-auth-ink-muted">
          Belum punya akses?{" "}
          <span className="border-b border-auth-line-strong text-auth-ink">Hubungi admin tim kamu.</span>
        </p>
      }
      aside={
        <Suspense fallback={<aside className="flex h-full items-center justify-center bg-auth-dossier-bg px-10 py-12 text-auth-dossier-stat">Memuat ringkasan pipeline…</aside>}>
          <DossierAside />
        </Suspense>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
