'use client';

import React, { useMemo, useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { useDynamicStore, type DynamicPermission } from '@/hooks/use-dynamic-store';
import { usePermissions } from '@/hooks/use-permissions';

export default function DynamicRbacMatrixPage() {
  const { roles, permissionsCatalog, updateRolePermissions, refreshFromBackend } = useDynamicStore();
  const { hasAnyPermission } = usePermissions();
  const [notification, setNotification] = useState<string | null>(null);

  const canModifyRights = hasAnyPermission(['rbac:roles_assign', 'rbac:roles_update']);

  const togglePermission = (roleId: string, permSlug: string) => {
    if (!canModifyRights) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.slug === 'SUPER_ADMIN') return;

    const next = new Set(role.permissions);
    if (next.has(permSlug)) next.delete(permSlug);
    else next.add(permSlug);

    updateRolePermissions(role.id, Array.from(next));
    setNotification(`Updated ${permSlug} for ${role.name}. Active sessions updated immediately.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const moduleFilterOptions = useMemo(() => {
    const mods = Array.from(new Set(permissionsCatalog.map((p) => p.module))).sort();
    return mods.map((m) => ({ label: m, value: m }));
  }, [permissionsCatalog]);

  const columns: GridColumn<DynamicPermission>[] = useMemo(() => {
    const base: GridColumn<DynamicPermission>[] = [
      {
        id: 'permission',
        header: 'Permission Slug & Description',
        minWidth: 250,
        accessor: (p) => `${p.slug} ${p.description}`,
        summary: 'count',
        cell: (perm) => (
          <div>
            <span className="block font-mono font-bold text-primary">{perm.slug}</span>
            <span className="text-[11px] text-muted-foreground">{perm.description}</span>
          </div>
        ),
      },
      {
        id: 'module',
        header: 'Module',
        filterOptions: moduleFilterOptions,
        accessor: (p) => p.module,
        cell: (perm) => (
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {perm.module}
          </span>
        ),
      },
    ];

    const roleCols: GridColumn<DynamicPermission>[] = roles.map((r) => ({
      id: `role-${r.id}`,
      header: `${r.name} (${r.slug})`,
      align: 'center',
      minWidth: 140,
      sortable: false,
      filterable: false,
      groupable: false,
      accessor: (perm) => {
        const isSuper = r.slug === 'SUPER_ADMIN' || r.permissions.includes('*');
        return isSuper || r.permissions.includes(perm.slug) ? 'Granted' : 'Denied';
      },
      cell: (perm) => {
        const isSuper = r.slug === 'SUPER_ADMIN' || r.permissions.includes('*');
        const isChecked = isSuper || r.permissions.includes(perm.slug);
        return (
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isSuper || !canModifyRights}
            onChange={() => togglePermission(r.id, perm.slug)}
            className="h-4 w-4 cursor-pointer rounded border-border text-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        );
      },
    }));

    return [...base, ...roleCols];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, moduleFilterOptions, canModifyRights]);

  return (
    <RequirePageAccess
      permission={['rbac:roles_read', 'rbac:roles_assign', 'rbac:roles_update']}
      title="Dynamic RBAC Permission Matrix"
    >
      <div className="space-y-6">
        <Breadcrumb
          title="Permission Matrix Grid"
          items={[{ label: 'Setup' }, { label: 'Role & Rights', href: '/admin/roles' }, { label: 'Matrix' }]}
        />
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dynamic RBAC Permission Matrix</h1>
            <p className="text-xs text-muted-foreground">
              Live Role &amp; Permission Matrix — Super Admin always bypasses all checks (*)
            </p>
          </div>
          {notification && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-500">
              ✔ {notification}
            </div>
          )}
        </div>

        <DataGrid<DynamicPermission>
          title="Permission Matrix"
          subtitle={canModifyRights ? 'Toggle checkboxes to grant/revoke rights live' : 'Read-only view (assign rights permission required to edit)'}
          data={permissionsCatalog}
          columns={columns}
          rowKey={(p) => p.id}
          pageSize={25}
          exportFileName="omniclaim-rbac-matrix"
          searchPlaceholder="Search permission slug, module, or description..."
          onRefresh={() => refreshFromBackend()}
        />
      </div>
    </RequirePageAccess>
  );
}
