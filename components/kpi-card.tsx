import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/utils/cn"

interface KpiCardProps {
  label: string
  value: string
  sublabel?: string
  emphasize?: boolean
}

export function KpiCard({ label, value, sublabel, emphasize }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "border-line bg-paper-raised",
        emphasize && "relative overflow-hidden border-alert/50"
      )}
    >
      {emphasize && <div className="absolute left-0 top-0 h-full w-1 bg-alert" />}
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] font-normal uppercase tracking-wide text-ink-muted">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="font-case tabular-figures text-3xl text-ink">{value}</div>
        {sublabel && <p className="mt-1 text-xs text-ink-muted">{sublabel}</p>}
      </CardContent>
    </Card>
  )
}
