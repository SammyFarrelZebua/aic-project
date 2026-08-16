import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center text-ink-muted">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
