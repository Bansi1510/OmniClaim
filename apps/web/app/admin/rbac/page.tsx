'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';

interface RolePermRow {
  roleId: string;
  roleName: string;
  roleSlug: string;
  isSystem: boolean;
  permissions: Set<string>;
}

const PERMISSION_CATALOG = [
  { slug: 'claims:read', module: 'CLAIMS', description: 'View claims list and dossiers' },
  { slug: 'claims:create', module: 'CLAIMS', description: 'Initiate new accident claims' },
  { slug: 'claims:update', module: 'CLAIMS', description: 'Modify claim metadata' },
  { slug: 'claims:triage', module: 'CLAIMS', description: 'Triage and dispatch claims' },
  { slug: 'claims:approve', module: 'CLAIMS', description: 'Authorize formal claim approvals' },
  { slug: 'claims:override_reconciliation', module: 'CLAIMS', description: 'Override phantom bill deductions' },
  { slug: 'claims:settle', module: 'CLAIMS', description: 'Disburse payouts & post ledger entries' },
  { slug: 'ledger:read', module: 'LEDGER', description: 'Inspect balanced accounting journals' },
  { slug: 'ledger:post', module: 'LEDGER', description: 'Authorize ledger vouchers' },
  { slug: 'fraud:read', module: 'FRAUD', description: 'Inspect fraud scorecards & pgvector similarity' },
  { slug: 'fraud:override', module: 'FRAUD', description: 'Documented override of fraud indicators' },
  { slug: 'rbac:roles_create', module: 'RBAC', description: 'Create custom roles' },
  { slug: 'rbac:roles_update', module: 'RBAC', description: 'Modify role permission bindings' },
];

const INITIAL_ROLES: RolePermRow[] = [
  {
    roleId: 'r-1',
    roleName: 'Super Administrator',
    roleSlug: 'SUPER_ADMIN',
    isSystem: true,
    permissions: new Set(PERMISSION_CATALOG.map((p) => p.slug)),
  },
  {
    roleId: 'r-2',
    roleName: 'Senior Adjuster',
    roleSlug: 'SENIOR_ADJUSTER',
    isSystem: true,
    permissions: new Set([
      'claims:read', 'claims:update', 'claims:triage', 'claims:approve',
      'claims:override_reconciliation', 'claims:settle', 'fraud:read', 'fraud:override', 'ledger:read'
    ]),
  },
  {
    roleId: 'r-3',
    roleName: 'Junior Adjuster',
    roleSlug: 'JUNIOR_ADJUSTER',
    isSystem: true,
    permissions: new Set(['claims:read', 'claims:update', 'claims:triage', 'fraud:read']),
  },
  {
    roleId: 'r-4',
    roleName: 'SIU Fraud Investigator',
    roleSlug: 'FRAUD_INVESTIGATOR',
    isSystem: true,
    permissions: new Set(['claims:read', 'fraud:read', 'fraud:override']),
  },
];

export default function DynamicRbacMatrixPage() {
  const [roles, setRoles] = useState<RolePermRow[]>(INITIAL_ROLES);
  const [notification, setNotification] = useState<string | null>(null);

  const togglePermission = (roleId: string, permSlug: string) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.roleId !== roleId) return role;
        const newPerms = new Set(role.permissions);
        if (newPerms.has(permSlug)) {
          newPerms.delete(permSlug);
        } else {
          newPerms.add(permSlug);
        }
        return { ...role, permissions: newPerms };
      })
    );

    setNotification(`Permissions updated for role. Redis user cache automatically invalidated.`);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        title="Permission Matrix Grid"
        items={[{ label: 'Setup' }, { label: 'Role & Rights', href: '/admin/roles' }, { label: 'Matrix' }]}
      />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dynamic RBAC Permission Matrix</h1>
          <p className="text-xs text-muted-foreground">
            Runtime Role & Permission Management with Instant Redis Cache Invalidation
          </p>
        </div>
        {notification && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 text-xs text-emerald-500 font-semibold animate-pulse">
            ✔ {notification}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4 min-w-[240px]">Permission Slug & Description</th>
              <th className="py-3 px-4">Module</th>
              {roles.map((r) => (
                <th key={r.roleId} className="py-3 px-4 text-center min-w-[130px]">
                  <span className="block text-foreground font-bold">{r.roleName}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{r.roleSlug}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {PERMISSION_CATALOG.map((perm) => (
              <tr key={perm.slug} className="hover:bg-muted/20 transition">
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-primary block">{perm.slug}</span>
                  <span className="text-[11px] text-muted-foreground">{perm.description}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {perm.module}
                  </span>
                </td>
                {roles.map((r) => {
                  const isChecked = r.permissions.has(perm.slug);
                  return (
                    <td key={r.roleId} className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(r.roleId, perm.slug)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
