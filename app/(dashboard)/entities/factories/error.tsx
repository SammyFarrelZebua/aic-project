"use client";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-alert/40 bg-alert-soft p-6 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-alert" />
        <h2 className="mb-2 font-case text-lg font-semibold text-ink">Gagal Memuat Data</h2>
        <p className="mb-6 text-sm text-ink-muted">{error.message || "Terjadi kesalahan sistem saat mengambil data."}</p>
        <button
          onClick={() => reset()}
          className="rounded-md border border-alert/50 px-4 py-2 text-sm font-case text-alert hover:bg-alert/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
