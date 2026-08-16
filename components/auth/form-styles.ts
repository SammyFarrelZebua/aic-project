// Shared class strings so login/forgot-password/reset-password inputs and
// buttons stay pixel-identical without copy-pasting the same Tailwind
// string into three files.
export const fieldLabel =
  "font-case text-[11px] font-medium uppercase tracking-[0.06em] text-auth-ink-muted"

export const fieldInput =
  "rounded-[2px] border border-auth-line-strong bg-auth-paper px-3.5 py-3 text-[14.5px] text-auth-ink placeholder:text-[#a9a69c] outline-none transition-colors focus:border-auth-ink focus:ring-[3px] focus:ring-auth-ink/[0.08]"

export const submitButton =
  "mt-2 flex items-center justify-center gap-2 rounded-[2px] bg-auth-ink px-5 py-3.5 font-case text-[13px] font-semibold uppercase tracking-[0.04em] text-auth-paper transition-colors hover:bg-[#2e3a4b] disabled:cursor-not-allowed disabled:opacity-70"

// Colored left-border as the --alert/--cleared accent, dark ink text for
// readability -- amber-on-peach text alone doesn't hold enough contrast.
export const errorBanner =
  "rounded-[2px] border-l-[3px] border-auth-alert bg-auth-alert-bg px-3.5 py-3 text-[13.5px] text-auth-ink"

export const successBanner =
  "rounded-[2px] border-l-[3px] border-auth-cleared bg-auth-cleared-bg px-3.5 py-3 text-[13.5px] text-auth-ink"

export const inlineLink =
  "border-b border-auth-line-strong pb-px text-auth-ink transition-colors hover:border-auth-ink"
