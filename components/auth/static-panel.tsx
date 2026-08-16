interface StaticPanelProps {
  title: string
  body: string
}

export function StaticPanel({ title, body }: StaticPanelProps) {
  return (
    <div className="flex h-full flex-col justify-center bg-auth-dossier-bg px-10 py-12 min-[861px]:px-14">
      <p className="mb-1.5 font-case text-[11px] font-medium uppercase tracking-[0.1em] text-auth-dossier-eyebrow">
        Berkas kasus
      </p>
      <h2 className="mb-4 max-w-[320px] font-case text-[17px] font-medium text-auth-dossier-title">
        {title}
      </h2>
      <p className="max-w-[320px] text-[13.5px] leading-[1.6] text-auth-dossier-stat">{body}</p>
    </div>
  )
}
