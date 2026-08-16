import { Suspense } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

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
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}

