import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { StaticPanel } from "@/components/auth/static-panel"

export default function ResetPasswordPage() {
  return (
    <AuthShell
      heading="Atur ulang kata sandi"
      subtext="Buat kata sandi baru untuk akunmu."
      aside={
        <StaticPanel
          title="Amankan akunmu kembali"
          body="Setelah kata sandi diperbarui, kamu akan kembali masuk ke dashboard investigasi rantai pasok."
        />
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  )
}

