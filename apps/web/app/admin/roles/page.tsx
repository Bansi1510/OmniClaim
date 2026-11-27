'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { Shield, Plus, Edit2, Trash2, CheckCircle2, Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore, DynamicRole } from '@/hooks/use-dynamic-store';
import { Can } from '@/components/auth/can';
import { useRouter } from 'next/navigation';

export default function RoleManagementPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { roles, users, addRole, updateRole, deleteRole, refreshFromBackend } = useDynamicStore();

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<DynamicRole | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingRole(null);
    setFormName('');
    setFormSlug('');
    setFormDesc('');
    setShowModal(true);
  };

  const handleOpenEdit = (role: DynamicRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormSlug(role.slug);
    setFormDesc(role.description);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) return;
    if (editingRole) {
      updateRole(editingRole.id, { name: formName, description: formDesc });
      showToast(`Role '${formName}' updated successfully.`);
    } else {
      addRole({
        name: formName,
        slug: formSlug.toUpperCase().replace(/\s+/g, '_'),
        description: formDesc,
        isSystem: false,
        permissions: ['claims:read'],
      });
      showToast(`New custom role '${formName}' created and available across Role Switcher!`);
    }
    setShowModal(false);
  };

  const handleDelete = (role: DynamicRole) => {
    if (role.isSystem) {
      alert(`System role '${role.name}' is protected and cannot be deleted.`);
      return;
    }
    if (confirm(`Are you sure you want to delete role '${role.name}'?`)) {
      deleteRole(role.id);
      showToast(`Role '${role.name}' deleted.`);
    }
  };

  // Role-wise row actions
  const rowActions = (role: DynamicRole): GridAction[] => [
    ...(hasPermission('rbac:roles_assign')
      ? [
          {
            key: 'rights',
            label: 'Rights',
            title: 'Assign Rights / Permissions',
            icon: Shield,
            tone: 'primary' as const,
            onClick: () =>
              router.push(`/admin/roles/${role.id}/rights?name=${encodeURIComponent(role.name)}&slug=${role.slug}`),
          },
        ]
      : []),
    ...(hasPermission('rbac:roles_update')
      ? [{ key: 'edit', label: 'Edit', title: 'Edit Role Details', icon: Edit2, onClick: () => handleOpenEdit(role) }]
      : []),
    ...(!role.isSystem && hasPermission('rbac:roles_delete')
      ? [
          {
            key: 'delete',
            label: 'Delete',
            title: 'Delete Role',
            icon: Trash2,
            tone: 'danger' as const,
            onClick: () => handleDelete(role),
          },
        ]
      : []),
  ];

  const columns: GridColumn<DynamicRole>[] = [
    {
      id: 'role',
      header: 'Role Title & Slug',
      accessor: (r) => `${r.name} ${r.slug}`,
      minWidth: 220,
      cell: (r) => (
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            {r.name}
            {r.isSystem && (
              <span className="text-muted-foreground" title="System Role">
                <Lock className="h-3 w-3" />
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] font-semibold text-primary">{r.slug}</span>
        </div>
      ),
    },
    { id: 'description', header: 'Description', accessor: (r) => r.description, minWidth: 260, cell: (r) => <span className="text-muted-foreground">{r.description}</span> },
    {
      id: 'type',
      header: 'Type',
      align: 'center',
      filterOptions: [
        { label: 'System', value: 'System' },
        { label: 'Custom', value: 'Custom' },
      ],
      accessor: (r) => (r.isSystem ? 'System' : 'Custom'),
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            r.isSystem
              ? 'border border-blue-500/20 bg-blue-500/10 text-blue-500'
              : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
          }`}
        >
          {r.isSystem ? 'System' : 'Custom'}
        </span>
      ),
    },
    {
      id: 'users',
      header: 'Assigned Users',
      align: 'center',
      accessor: (r) => users.filter((u) => u.roleSlug === r.slug).length,
      summary: 'sum',
      cell: (r) => <span className="font-mono font-bold text-foreground">{users.filter((u) => u.roleSlug === r.slug).length}</span>,
    },
    {
      id: 'rights',
      header: 'Active Rights',
      align: 'center',
      accessor: (r) => (r.permissions.includes('*') ? 9999 : r.permissions.length),
      cell: (r) => (
        <span className="font-mono font-bold text-primary">{r.permissions.includes('*') ? 'ALL (*)' : `${r.permissions.length} rights`}</span>
      ),
    },
  ];

  return (
    <RequirePageAccess
      permission={['rbac:roles_read', 'rbac:roles_create', 'rbac:roles_update', 'rbac:roles_delete', 'rbac:roles_assign']}
      title="Role Management"
    >
      <div>
      <Breadcrumb title="Role Management" items={[{ label: 'Setup' }, { label: 'Role & Rights' }]} />

      {toastMessage && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      <DataGrid<DynamicRole>
        title="Roles & Rights"
        subtitle="Every menu, button and grid action in the system follows these roles"
        data={roles}
        columns={columns}
        rowKey={(r) => r.id}
        actions={rowActions}
        pageSize={25}
        selectable
        exportFileName="omniclaim-roles"
        searchPlaceholder="Search roles by name, slug or description..."
        onRefresh={() => refreshFromBackend()}
        toolbar={
          <Can permission="rbac:roles_create">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Role</span>
            </button>
          </Can>
        }
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-foreground">{editingRole ? 'Edit Role Details' : 'Create New Custom Role'}</h2>
            <p className="mb-4 text-xs text-muted-foreground">Roles bind permission policies dynamically across the entire platform.</p>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Role Name *</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Regional Audit Lead" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Role Slug *</label>
                <input type="text" required disabled={Boolean(editingRole)} value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="e.g. REGIONAL_AUDIT_LEAD" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs uppercase disabled:opacity-50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Description</label>
                <textarea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div className="flex justify-end gap-3 border-t border-border pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-border bg-muted/60 px-4 py-1.5 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </RequirePageAccess>
  );
}
