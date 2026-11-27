'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { UserCheck, Shield, CheckCircle2, Plus, Edit2, Trash2, Crown } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore, DynamicUser } from '@/hooks/use-dynamic-store';
import { Can } from '@/components/auth/can';

export default function UserManagementPage() {
  const { isSystemAdmin, bypassAllPermissions, hasPermission } = usePermissions();
  const { users, roles, addUser, updateUser, deleteUser, refreshFromBackend } = useDynamicStore();

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<DynamicUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('OmniClaim@123');
  const [roleSlug, setRoleSlug] = useState('CLAIMS_ADJUSTER');
  const [isSuperAdminFlag, setIsSuperAdminFlag] = useState(false);
  const [isActiveFlag, setIsActiveFlag] = useState(true);

  const isSuper = isSystemAdmin || bypassAllPermissions;
  const canManageUsers = isSuper || hasPermission('rbac:users_assign');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('OmniClaim@123');
    setRoleSlug(roles[1]?.slug || 'CLAIMS_ADJUSTER');
    setIsSuperAdminFlag(false);
    setIsActiveFlag(true);
    setShowUserModal(true);
  };

  const handleOpenEdit = (user: DynamicUser) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setUsername(user.username);
    setEmail(user.email);
    setPassword('');
    setRoleSlug(user.roleSlug);
    setIsSuperAdminFlag(user.isSuperAdmin);
    setIsActiveFlag(user.isActive);
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedRole = roles.find((r) => r.slug === roleSlug);
    const payload = {
      fullName: fullName.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      roleSlug,
      roleName: matchedRole?.name || roleSlug,
      isSuperAdmin: isSuperAdminFlag || roleSlug === 'SUPER_ADMIN',
      isActive: isActiveFlag,
    };
    if (editingUser) {
      updateUser(editingUser.id, payload);
      showToast(`User "${payload.fullName}" (@${payload.username}) updated.`);
    } else {
      addUser(payload);
      showToast(`New user "${payload.fullName}" (@${payload.username}) created.`);
    }
    setShowUserModal(false);
  };

  const handleDeleteUser = (user: DynamicUser) => {
    if (user.username === 'superadmin') {
      alert('Root superadmin account cannot be deleted.');
      return;
    }
    if (confirm(`Delete user "${user.fullName}" (@${user.username})?`)) {
      deleteUser(user.id);
      showToast(`User "${user.fullName}" deleted.`);
    }
  };

  // Role-wise row actions: each action is only returned when the active role holds the right.
  const rowActions = (user: DynamicUser): GridAction[] => [
    ...(canManageUsers
      ? [{ key: 'edit', label: 'Edit', icon: Edit2, onClick: () => handleOpenEdit(user) }]
      : []),
    ...(canManageUsers && user.username !== 'superadmin'
      ? [
          {
            key: 'delete',
            label: 'Delete',
            title: 'Delete User',
            icon: Trash2,
            tone: 'danger' as const,
            onClick: () => handleDeleteUser(user),
          },
        ]
      : []),
  ];

  const columns: GridColumn<DynamicUser>[] = [
    {
      id: 'user',
      header: 'User & Username',
      accessor: (u) => `${u.fullName} @${u.username}`,
      minWidth: 220,
      cell: (u) => (
        <div>
          <div className="flex items-center gap-2 font-bold text-foreground text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
              {u.fullName.slice(0, 2).toUpperCase()}
            </div>
            <span>{u.fullName}</span>
            {u.isSuperAdmin && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-400">
                <Crown className="h-2.5 w-2.5" /> SUPER
              </span>
            )}
          </div>
          <div className="pl-8 font-mono text-[11px] text-muted-foreground">@{u.username}</div>
        </div>
      ),
    },
    { id: 'email', header: 'Email', accessor: (u) => u.email, minWidth: 200, cell: (u) => <span className="font-mono text-[11px]">{u.email}</span> },
    {
      id: 'role',
      header: 'Assigned Role',
      accessor: (u) => `${u.roleName} ${u.roleSlug}`,
      cell: (u) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{u.roleName}</span>
          </div>
          <span className="pl-5 font-mono text-[10px] text-muted-foreground">{u.roleSlug}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      filterOptions: [
        { label: 'Active', value: 'Active' },
        { label: 'Inactive', value: 'Inactive' },
      ],
      accessor: (u) => (u.isActive ? 'Active' : 'Inactive'),
      cell: (u) => (
        <button
          disabled={!canManageUsers}
          onClick={() => {
            updateUser(u.id, { isActive: !u.isActive });
            showToast(`${u.fullName} marked ${!u.isActive ? 'Active' : 'Inactive'}.`);
          }}
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold disabled:cursor-not-allowed ${
            u.isActive
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-500'
          }`}
        >
          {u.isActive ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    { id: 'assignedAt', header: 'Assigned Since', accessor: (u) => u.assignedAt, cell: (u) => <span className="font-mono text-muted-foreground">{u.assignedAt}</span> },
  ];

  return (
    <RequirePageAccess
      permission={['rbac:users_read', 'rbac:users_create', 'rbac:users_update', 'rbac:users_delete', 'rbac:users_assign']}
      title="User Management"
    >
      <div>
      <Breadcrumb title="User Management & Dynamic Role Assignment" items={[{ label: 'Setup' }, { label: 'Users & Access' }]} />

      {toastMessage && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      <DataGrid<DynamicUser>
        title="System Users"
        subtitle="Role-wise: actions shown depend on the active role's rights"
        data={users}
        columns={columns}
        rowKey={(u) => u.id}
        actions={rowActions}
        pageSize={25}
        selectable
        exportFileName="omniclaim-users"
        searchPlaceholder="Search by name, username, email, or role..."
        onRefresh={() => refreshFromBackend()}
        toolbar={
          <Can permission="rbac:users_assign">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add User</span>
            </button>
          </Can>
        }
      />

      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>{editingUser ? `Edit User: ${editingUser.fullName}` : 'Create New System User'}</span>
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">Users can log in immediately via username or email, or via Super Master Password.</p>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold">Full Name *</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Priya Patel" className="w-full rounded-lg border border-border bg-background px-3 py-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">Username *</label>
                  <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya.patel" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">{editingUser ? 'New Password (optional)' : 'Password *'}</label>
                  <input
                    required={!editingUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to keep unchanged' : 'Enter password'}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold">Email *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@omniclaim.internal" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Assigned Role *</label>
                <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                  {roles.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" checked={isSuperAdminFlag} onChange={(e) => setIsSuperAdminFlag(e.target.checked)} />
                  <span className="text-amber-400">Super Admin (Skip All Permissions)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" checked={isActiveFlag} onChange={(e) => setIsActiveFlag(e.target.checked)} />
                  <span>Active</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setShowUserModal(false)} className="rounded-lg border border-border bg-muted/60 px-4 py-1.5 font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 font-bold text-primary-foreground">
                  {editingUser ? 'Save Changes' : 'Create User'}
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
