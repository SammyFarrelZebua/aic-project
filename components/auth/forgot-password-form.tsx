"use client"

import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { errorBanner, fieldInput, fieldLabel, submitButton, successBanner } from "@/components/auth/form-styles"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    setLoading(false)

    // Same message whether or not the email exists -- don't leak which
    // accounts are registered. Only a genuine server/network failure
    // (not "user not found", which Supabase doesn't even report here)
    // surfaces as an error.
    if (resetError && resetError.status && resetError.status >= 500) {
      setError("Terjadi kesalahan. Coba lagi beberapa saat lagi.")
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <p className={`max-w-[380px] ${successBanner}`}>
        Kalau email terdaftar, kami sudah kirim link reset ke email tersebut.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[380px] flex-col gap-5">
      <div className="flex flex-col gap-[7px]">
        <label htmlFor="email" className={fieldLabel}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {loading ? "Mengirim..." : "Kirim link reset"}
      </button>
    </form>
  )
}
