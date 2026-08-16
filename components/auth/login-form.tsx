"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { errorBanner, fieldInput, fieldLabel, inlineLink, submitButton } from "@/components/auth/form-styles"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email atau kata sandi salah."
          : signInError.message
      )
      setLoading(false)
      return
    }

    const next = searchParams.get("next") || "/dashboard"
    router.push(next)
    router.refresh()
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

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="password" className={fieldLabel}>
          Kata sandi
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldInput}
        />
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <label className="flex items-center gap-2 text-auth-ink-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-auth-ink"
          />
          Ingat saya
        </label>
        <Link href="/forgot-password" className={inlineLink}>
          Lupa kata sandi?
        </Link>
      </div>

      {error && (
        <p className={errorBanner} role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className={submitButton}>
        {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
        {loading ? "Memeriksa..." : "Masuk"}
      </button>
    </form>
  )
}
