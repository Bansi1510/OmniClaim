'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { useDynamicStore } from '@/hooks/use-dynamic-store';

export default function DynamicRbacMatrixPage() {
  const { roles, permissionsCatalog, updateRolePermissions } = useDynamicStore();
  const [notification, setNotification] = useState<string | null>(null);

  const togglePermission = (roleId: string, permSlug: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.slug === 'SUPER_ADMIN') return;

    const next = new Set(role.permissions);
    if (next.has(permSlug)) next.delete(permSlug);
    else next.add(permSlug);

    updateRolePermissions(role.id, Array.from(next));
    setNotification(`Updated ${permSlug} for ${role.name}. Active sessions updated immediately.`);
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
            Live Role &amp; Permission Matrix — Super Admin always bypasses all checks (*)
          </p>
        </div>
        {notification && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 text-xs text-emerald-500 font-semibold">
            ✔ {notification}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4 min-w-[240px]">Permission Slug &amp; Description</th>
              <th className="py-3 px-4">Module</th>
              {roles.map((r) => (
                <th key={r.id} className="py-3 px-4 text-center min-w-[130px]">
                  <span className="block text-foreground font-bold">{r.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{r.slug}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {permissionsCatalog.map((perm) => (
              <tr key={perm.id} className="hover:bg-muted/20 transition">
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
                  const isSuper = r.slug === 'SUPER_ADMIN' || r.permissions.includes('*');
                  const isChecked = isSuper || r.permissions.includes(perm.slug);
                  return (
                    <td key={r.id} className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isSuper}
                        onChange={() => togglePermission(r.id, perm.slug)}
                        className="h-4 w-4 rounded border-border text-primary cursor-pointer disabled:opacity-60"
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
