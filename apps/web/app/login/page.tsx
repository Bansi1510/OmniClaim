'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import {
  Shield,
  KeyRound,
  User,
  Lock,
  Eye,
  EyeOff,
  Crown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials } = usePermissions();
  const { users, superMasterPassword, superMasterPasswordEnabled } = useDynamicStore();

  const [identifier, setIdentifier] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const res = await loginWithCredentials(identifier, password);
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Authentication failed.');
      return;
    }

    if (res.authMethod === 'SUPER_MASTER_PASSWORD') {
      setSuccessMsg(`⚡ Super Master Password accepted! Entering as ${res.userName} with Super Admin bypass...`);
      setTimeout(() => router.push('/super-admin'), 650);
    } else if (res.roleSlug === 'SUPER_ADMIN') {
      setSuccessMsg(`Welcome back, ${res.userName}! Opening Super Admin Command Center...`);
      setTimeout(() => router.push('/super-admin'), 500);
    } else {
      setSuccessMsg(`Signed in as ${res.userName}. Redirecting to workspace...`);
      setTimeout(() => router.push('/claims'), 500);
    }
  };

  const handleQuickFillMaster = (username: string) => {
    setIdentifier(username);
    setPassword(superMasterPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Ambient Background Gradients */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-5 gap-6 relative z-10">
        {/* Left Login Form Card */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card/90 backdrop-blur p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-lg">
              Ω
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground">OmniClaim</h1>
              <p className="text-xs text-muted-foreground">
                Sign in to manage your insurance policies and claims
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Username or Email Address
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="Enter any username (e.g. sarah.jenkins) or email..."
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Password or Super Master Password
                </label>
                {superMasterPasswordEnabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                    <KeyRound className="h-3 w-3" />
                    Master Password Enabled
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter user password OR Super Master Password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-sm font-bold shadow-lg transition disabled:opacity-50"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In to OmniClaim'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Every Master Password entry is cryptographically audited.</span>
            <span className="font-mono text-primary font-semibold">PBKDF2 + HS256</span>
          </div>
        </div>

        {/* Right Quick Access & Super Master Password Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-amber-500/25 bg-card/70 backdrop-blur p-6 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
              <Crown className="h-4 w-4" />
              <span>Super Master Password Access</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Super Admins can enter <strong className="text-foreground">any user&apos;s username or email</strong> together with the{' '}
              <strong className="text-amber-400">Super Master Password</strong> to log straight into their account with optional{' '}
              <strong className="text-foreground">All-Permissions Bypass (God Mode)</strong>.
            </p>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-4 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                Active Master Password (Changeable Anytime in Super Admin)
              </div>
              <div className="font-mono font-bold text-foreground text-sm select-all">
                {superMasterPasswordEnabled ? superMasterPassword : 'DISABLED BY ADMIN'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>One-Click Fill Any Username + Master Password</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickFillMaster(u.username)}
                    className="w-full flex items-center justify-between rounded-lg border border-border/70 bg-background/70 hover:border-amber-500/50 hover:bg-amber-500/5 px-3 py-2 text-left transition"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{u.fullName}</span>
                        {u.isSuperAdmin && <Crown className="h-3 w-3 text-amber-400" />}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        @{u.username} · {u.roleSlug}
                      </div>
                    </div>
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Fill
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Standard seeded user password: <code className="font-mono text-foreground">AdminOmniClaim2026!</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
