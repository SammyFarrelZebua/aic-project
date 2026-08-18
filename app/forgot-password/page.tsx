import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { StaticPanel } from "@/components/auth/static-panel"

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading="Lupa kata sandi?"
      subtext="Masukkan email akunmu. Kami akan kirim link untuk mengatur ulang kata sandi."
      aside={
        <StaticPanel
          title="Pemulihan akses investigasi"
          body="Tim operasional menerima alert dan dossier kasus otomatis. Pulihkan akses akunmu untuk kembali memantau rantai pasok."
        />
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}

