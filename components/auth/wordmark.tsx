export function Wordmark() {
  return (
    <div className="mb-14 flex items-center gap-2.5">
      <span className="relative h-[22px] w-[22px] shrink-0 rounded-[3px] border-[1.5px] border-auth-ink">
        <span className="absolute inset-[5px] bg-auth-alert" />
      </span>
      <span className="font-case text-[13px] font-semibold uppercase tracking-[0.08em] text-auth-ink">
        Detektif Kemasan
      </span>
    </div>
  )
}
