import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default function ResetPasswordPage() {
  return (
    <AuthShell
      heading="Atur ulang kata sandi"
      subtext="Buat kata sandi baru untuk akunmu."
    >
      <ResetPasswordForm />
    </AuthShell>
  )
}

