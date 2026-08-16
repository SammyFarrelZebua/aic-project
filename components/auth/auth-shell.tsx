import type { ReactNode } from "react"
import { Wordmark } from "@/components/auth/wordmark"

interface AuthShellProps {
  heading: string
  subtext: string
  footer?: ReactNode
  children: ReactNode
}

export function AuthShell({ heading, subtext, footer, children }: AuthShellProps) {
  return (
    <div className="auth-shell flex min-h-screen items-center justify-center bg-auth-paper">
      <div className="w-full max-w-[540px] border-[0.5px] border-auth-line my-auto">
        <div className="flex flex-col justify-center bg-auth-paper-raised px-10 py-12 min-[540px]:px-[72px] min-[540px]:py-16">
          <Wordmark />
          <h1 className="mb-2.5 font-case text-[26px] font-medium tracking-[-0.01em] text-auth-ink">
            {heading}
          </h1>
          <p className="mb-10 max-w-[380px] text-[14.5px] leading-[1.6] text-auth-ink-muted">{subtext}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}
