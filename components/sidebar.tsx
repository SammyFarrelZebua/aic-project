"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  MessageSquareText,
  FileSearch,
  Building2,
  Factory,
  Warehouse,
  Truck,
  Bell,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react"
import { cn } from "@/utils/cn"
import { createClient } from "@/utils/supabase/client"

interface NavItemProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  indent?: boolean
  collapsed?: boolean
  mobileOpen?: boolean
  onClick?: () => void
}

function NavItem({ href, icon: Icon, label, active, indent = false, collapsed = false, mobileOpen = false, onClick }: NavItemProps) {
  const pathname = usePathname()
  const isActive = active !== undefined ? active : pathname === href
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-300",
        "hover:bg-cleared-soft hover:text-ink",
        isActive ? "bg-cleared-soft text-ink border-l-2 border-cleared" : "text-ink-muted border-l-2 border-transparent",
        indent ? "ml-6" : "",
        collapsed && !mobileOpen ? "justify-center px-0" : ""
      )}
      title={collapsed && !mobileOpen ? label : undefined}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-cleared" : "text-ink-muted group-hover:text-ink")} />
      {(!collapsed || mobileOpen) && <span>{label}</span>}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [entitasOpen, setEntitasOpen] = useState(() => pathname.startsWith("/entities"))
  const [loggingOut, setLoggingOut] = useState(false)

  const closeMobile = () => setMobileOpen(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-paper-raised border-r border-line text-ink transition-all duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-line">
        {(!collapsed || mobileOpen) && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-[10px] font-case uppercase tracking-wide text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-cleared" aria-hidden="true" />
              AIC 2026
            </div>
            <h2 className="font-case text-sm font-bold mt-1 uppercase tracking-wider">Detektif Kemasan</h2>
          </div>
        )}
        {/* Toggle Button for desktop */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center p-1.5 rounded-md text-ink-muted hover:bg-paper hover:text-ink"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
        {/* Close Button for mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
          className="md:hidden flex items-center justify-center p-1.5 rounded-md text-ink-muted hover:bg-paper hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Beranda" collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
        <NavItem href="/reviews" icon={MessageSquareText} label="Ulasan" collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
        <NavItem href="/cases" icon={FileSearch} label="Kasus" collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
        
        {/* Entitas Group */}
        <div className="py-1">
          <button
            onClick={() => setEntitasOpen(!entitasOpen)}
            className={cn(
              "w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-300 text-ink-muted hover:bg-cleared-soft hover:text-ink",
              collapsed && !mobileOpen ? "justify-center px-0" : "justify-between"
            )}
            title={collapsed && !mobileOpen ? "Entitas" : undefined}
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0 text-ink-muted group-hover:text-ink" />
              {(!collapsed || mobileOpen) && <span>Entitas</span>}
            </div>
            {(!collapsed || mobileOpen) && (
              <ChevronDown className={cn("h-4 w-4 transition-transform", entitasOpen ? "rotate-180" : "")} />
            )}
          </button>
          
          {entitasOpen && (!collapsed || mobileOpen) && (
            <div className="mt-1 space-y-1">
              <NavItem href="/entities/factories" icon={Factory} label="Pabrik" indent collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
              <NavItem href="/entities/warehouses" icon={Warehouse} label="Gudang" indent collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
              <NavItem href="/entities/couriers" icon={Truck} label="Kurir" indent collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
            </div>
          )}
        </div>

        <NavItem href="/alerts" icon={Bell} label="Peringatan" collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
        <NavItem href="/settings" icon={Settings} label="Pengaturan" collapsed={collapsed} mobileOpen={mobileOpen} onClick={closeMobile} />
      </div>

      {/* Bottom Profile / Logout */}
      <div className="p-4 border-t border-line">
        {(!collapsed || mobileOpen) ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper border border-line">
                <User className="h-4 w-4 text-ink-muted" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium">Penyidik Utama</span>
                <span className="truncate text-[10px] text-ink-muted font-case uppercase tracking-wide">Investigator</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-case uppercase tracking-wide text-ink-muted transition-colors hover:border-alert hover:text-alert disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? "Keluar..." : "Keluar"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center p-2 rounded-md text-ink-muted hover:text-alert transition-colors"
            title="Keluar"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Toggle Bar - Visible only on mobile when sidebar is closed */}
      <div className="md:hidden flex items-center p-4 bg-paper-raised border-b border-line text-ink fixed top-0 left-0 right-0 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Buka menu"
          className="p-2 -ml-2 rounded-md text-ink-muted hover:bg-paper"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-2 font-case text-sm uppercase tracking-wide font-bold">Detektif Kemasan</span>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition-all duration-300 md:relative md:translate-x-0 flex shrink-0",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="w-full h-full">
            {sidebarContent}
        </div>
      </div>
    </>
  )
}
