'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft, LogIn } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useRoleScope } from '@/hooks/use-role-scope';

interface RequirePageAccessProps {
  permission?: string | string[];
  requireAll?: boolean;
  superAdminOnly?: boolean;
  title?: string;
  children: React.ReactNode;
}

/**
 * Page-level RBAC guard: blocks direct URL access when the active role lacks permission.
 */
export function RequirePageAccess({
  permission,
  requireAll = false,
  superAdminOnly = false,
  title = 'Restricted Workspace',
  children,
}: RequirePageAccessProps) {
  const {
    username,
    activeRole,
    isSystemAdmin,
    isMasterLogin,
    bypassAllPermissions,
    canView,
    isLoading,
  } = usePermissions();
  const { defaultLandingRoute } = useRoleScope();

  if (isLoading) return null;

  const allowed = superAdminOnly
    ? isSystemAdmin || bypassAllPermissions || isMasterLogin
    : !permission || canView(permission, requireAll);

  if (allowed) {
    return <>{children}</>;
  }

  const requiredList = Array.isArray(permission)
    ? permission
    : permission
      ? [permission]
      : ['superadmin:access'];

  return (
    <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-rose-500/30 bg-card p-8 text-center shadow-xl space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
        <Lock className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-foreground">{title} — Access Restricted</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Signed in as <span className="font-mono font-semibold text-foreground">@{username}</span> ({activeRole}).
          Your current role does not hold the required right(s) to open this page.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {requiredList.map((slug) => (
          <span
            key={slug}
            className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-400"
          >
            {slug}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Link
          href={defaultLandingRoute}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Go to Authorized Workspace</span>
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
        >
          <LogIn className="h-3.5 w-3.5" />
          <span>Switch Account / Login</span>
        </Link>
      </div>
    </div>
  );
}
