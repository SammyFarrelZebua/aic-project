import React from "react"
import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-paper overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
