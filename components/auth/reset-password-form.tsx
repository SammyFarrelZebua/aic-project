"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { errorBanner, fieldInput, fieldLabel, inlineLink, submitButton, successBanner } from "@/components/auth/form-styles"

export function ResetPasswordForm() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setCheckingSession(false)
    })
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.")
      return
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.")
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push("/login"), 1500)
  }

  if (checkingSession) {
    return <p className="max-w-[380px] font-case text-[13px] text-auth-ink-muted">Memeriksa tautan...</p>
  }

  if (!hasSession) {
    return (
      <div className="flex max-w-[380px] flex-col gap-3">
        <p className={errorBanner} role="alert">
          Link reset tidak valid atau sudah kedaluwarsa.
        </p>
        <Link href="/forgot-password" className={`self-start text-[13px] ${inlineLink}`}>
          Minta link baru
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <p className={`max-w-[380px] ${successBanner}`}>
        Kata sandi berhasil diperbarui. Mengalihkan ke halaman masuk...
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[380px] flex-col gap-5">
      <div className="flex flex-col gap-[7px]">
        <label htmlFor="password" className={fieldLabel}>
          Kata sandi baru
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldInput}
        />
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="confirmPassword" className={fieldLabel}>
          Konfirmasi kata sandi
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={fieldInput}
        />
      </div>

      {error && (
        <p className={errorBanner} role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className={submitButton}>
        {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
        {loading ? "Menyimpan..." : "Simpan kata sandi baru"}
      </button>
    </form>
  )
}
