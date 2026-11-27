'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { RoleSwitcher } from '@/components/layout/role-switcher';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import { Crown, KeyRound, LogIn, LogOut, ShieldOff, ShieldCheck, ArrowLeftRight } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    username,
    userName,
    activeRole,
    isSystemAdmin,
    isMasterLogin,
    bypassAllPermissions,
    toggleBypassAllPermissions,
    exitMasterSession,
    logout,
  } = usePermissions();
  const { settings, isBackendConnected } = useDynamicStore();

  const brandName =
    settings.find((s) => s.key === 'COMPANY_BRAND_NAME')?.value || 'OmniClaim';
  const maintenanceMode =
    settings.find((s) => s.key === 'MAINTENANCE_MODE')?.value === 'true';

  // Login route renders full-screen cleanly
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Maintenance mode gate — Super Admin & Master Password bypass unconditionally!
  if (maintenanceMode && !isSystemAdmin && !bypassAllPermissions && !isMasterLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-card p-8 text-center shadow-2xl space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <Crown className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">System Maintenance Active</h1>
          <p className="text-xs text-muted-foreground">
            {brandName} is currently in maintenance mode. Only Super Administrators or Master Password sessions can access the platform right now.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Super Admin / Master Password Login</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Super Master Password / Impersonation Live Override Banner */}
      {isMasterLogin && (
        <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 px-6 py-1.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5" />
            <span>
              SUPER MASTER SESSION ACTIVE — Entered as <span className="underline">{userName}</span> (@{username} · {activeRole})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleBypassAllPermissions}
              className="inline-flex items-center gap-1 rounded bg-slate-950/90 text-amber-300 px-2.5 py-0.5 text-[11px] hover:bg-slate-950 transition"
            >
              {bypassAllPermissions ? (
                <>
                  <ShieldOff className="h-3 w-3" />
                  <span>God Mode: Permissions Skipped (Switch to Target View)</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3" />
                  <span>Viewing Exact User Rights (Enable God Mode)</span>
                </>
              )}
            </button>
            <Link
              href="/super-admin"
              className="inline-flex items-center gap-1 rounded bg-white/90 text-slate-950 px-2.5 py-0.5 text-[11px] hover:bg-white transition"
            >
              <Crown className="h-3 w-3" />
              <span>Super Admin</span>
            </Link>
            <button
              onClick={exitMasterSession}
              className="inline-flex items-center gap-1 rounded bg-slate-950/20 hover:bg-slate-950/35 text-slate-950 px-2.5 py-0.5 text-[11px] transition"
            >
              <ArrowLeftRight className="h-3 w-3" />
              <span>Exit Master Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Master Header Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 w-full items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/claims" className="flex items-center gap-2.5 font-bold tracking-tight text-lg text-primary">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm shadow">
                Ω
              </span>
              {brandName}
            </Link>
            <span className="text-xs text-muted-foreground border-l border-border/60 pl-4 hidden lg:inline">
              Dynamic Multi-Modal Fraud &amp; Settlement Engine
            </span>
          </div>

          <div className="flex items-center gap-3">
            {(isSystemAdmin || bypassAllPermissions) && (
              <Link
                href="/super-admin"
                className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/25 transition"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Super Admin</span>
              </Link>
            )}

            <RoleSwitcher />

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition"
              title="Sign in with Username + Password or Super Master Password"
            >
              <LogIn className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Master Login</span>
            </Link>

            <div className="hidden xl:flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
              <span className={`h-2 w-2 rounded-full animate-pulse ${isBackendConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-mono font-semibold text-foreground">
                @{username} · {activeRole} · {isBackendConnected ? 'Live DB' : 'Local'}
              </span>
            </div>

            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="rounded-lg border border-border/70 p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Application Frame with Dynamic Navigation Sidebar */}
      <div className="flex w-full">
        <Sidebar />
        <main className="flex-1 p-6 max-w-full overflow-x-hidden">{children}</main>
      </div>
    </>
  );
}
