'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import { apiRequest } from '@/lib/api-client';
import { Crown, KeyRound, LogOut, ShieldOff, ShieldCheck, ArrowLeftRight, Sun, Moon, Lock } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('omniclaim_theme');
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniclaim_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  };
  const {
    username,
    userName,
    activeRole,
    isSystemAdmin,
    isMasterLogin,
    bypassAllPermissions,
    mustChangePassword,
    clearMustChangePassword,
    toggleBypassAllPermissions,
    exitMasterSession,
    logout,
  } = usePermissions();

  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    if (mustChangePassword && pathname !== '/login') {
      setPwdModalOpen(true);
    }
  }, [mustChangePassword, pathname]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);
    if (newPwd.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('New password and confirmation do not match.');
      return;
    }
    setPwdSaving(true);
    const res = await apiRequest<{ success: boolean; message: string }>('POST', '/api/v1/auth/change-password', {
      currentPassword: curPwd,
      newPassword: newPwd,
    });
    setPwdSaving(false);
    if (!res.ok) {
      setPwdError(res.error || 'Failed to update password.');
      return;
    }
    clearMustChangePassword();
    setCurPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdSuccess('Password updated successfully.');
    setTimeout(() => {
      setPwdModalOpen(false);
      setPwdSuccess(null);
    }, 1000);
  };
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
              Insurance Policies &amp; Claims Portal
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {(isSystemAdmin || bypassAllPermissions) && (
              <Link
                href="/super-admin"
                className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Admin</span>
              </Link>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-border bg-card hover:bg-muted p-1.5 text-muted-foreground hover:text-foreground transition"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Light/Dark Theme"
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </button>

            <div className="hidden xl:flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
              <span className={`h-2 w-2 rounded-full animate-pulse ${isBackendConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-mono font-semibold text-foreground">
                @{username} · {activeRole}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setPwdError(null);
                setPwdSuccess(null);
                setPwdModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition"
              title="Change your account password"
            >
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Change Password</span>
            </button>

            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="rounded-lg border border-border/70 p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Application Frame with Dynamic Navigation Sidebar */}
      <div className="flex w-full bg-slate-50/70 dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <Suspense fallback={<aside className="w-64 border-r border-border bg-card shrink-0" />}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 p-6 md:p-8 max-w-full overflow-x-hidden">{children}</main>
      </div>

      {/* Self-Service Change Password Modal */}
      {pwdModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleChangePassword}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span>Change Account Password</span>
              </h3>
              {!mustChangePassword && (
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              )}
            </div>

            {mustChangePassword && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 font-medium">
                You signed in with the common initial password. Please set your personal password now.
              </div>
            )}

            {pwdError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-rose-700 dark:text-rose-300 font-medium">
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                {pwdSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={curPwd}
                  onChange={(e) => setCurPwd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">New Personal Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {!mustChangePassword && (
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="rounded-lg border border-border px-3 py-2 font-semibold"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={pwdSaving}
                className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pwdSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
