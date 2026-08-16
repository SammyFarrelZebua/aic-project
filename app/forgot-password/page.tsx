import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading="Lupa kata sandi?"
      subtext="Masukkan email akunmu. Kami akan kirim link untuk mengatur ulang kata sandi."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}

