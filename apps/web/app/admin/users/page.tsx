'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { Search, UserCheck, Shield, CheckCircle2, Plus, Edit2, Trash2, Crown, LogIn } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore, DynamicUser } from '@/hooks/use-dynamic-store';
import { Can } from '@/components/auth/can';

export default function UserManagementPage() {
  const router = useRouter();
  const { isSystemAdmin, isMasterLogin, bypassAllPermissions, hasPermission, impersonateUser } = usePermissions();
  const { users, roles, addUser, updateUser, deleteUser } = useDynamicStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<DynamicUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Add/Edit Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('AdminOmniClaim2026!');
  const [roleSlug, setRoleSlug] = useState('CLAIMS_ADJUSTER');
  const [isSuperAdminFlag, setIsSuperAdminFlag] = useState(false);
  const [isActiveFlag, setIsActiveFlag] = useState(true);

  const canManageUsers = isSystemAdmin || isMasterLogin || bypassAllPermissions || hasPermission('rbac:users_assign');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('AdminOmniClaim2026!');
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
    setPassword(user.password);
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
      showToast(`User "${payload.fullName}" (@${payload.username}) updated. Redis cache invalidated.`);
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

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.roleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <Breadcrumb
        title="User Management & Dynamic Role Assignment"
        items={[{ label: 'Setup' }, { label: 'Users & Access' }]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, username, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-border bg-card pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-80 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}

          <Can permission="rbac:users_assign">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-bold shadow transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add User</span>
            </button>
          </Can>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">User &amp; Username</th>
              <th className="py-3 px-4">Assigned Role</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Assigned Since</th>
              {canManageUsers && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-muted/20 transition">
                <td className="py-3.5 px-4">
                  <div className="font-bold text-foreground text-sm flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                      {user.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{user.fullName}</span>
                    {user.isSuperAdmin && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 text-amber-400 px-1.5 py-0.5 text-[9px] font-black">
                        <Crown className="h-2.5 w-2.5" /> SUPER
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground pl-8">
                    @{user.username} · {user.email}
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{user.roleName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground pl-5">
                    {user.roleSlug}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <button
                    disabled={!canManageUsers}
                    onClick={() => {
                      updateUser(user.id, { isActive: !user.isActive });
                      showToast(`${user.fullName} marked ${!user.isActive ? 'Active' : 'Inactive'}.`);
                    }}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      user.isActive
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="py-3.5 px-4 text-muted-foreground font-mono">
                  {user.assignedAt}
                </td>
                {canManageUsers && (
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(isSystemAdmin || isMasterLogin || bypassAllPermissions) && (
                        <button
                          onClick={() => {
                            impersonateUser(user.id, true);
                            router.push('/claims');
                          }}
                          className="inline-flex items-center gap-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold"
                          title="Impersonate & Enter Account"
                        >
                          <LogIn className="h-3 w-3" />
                          <span>Login As</span>
                        </button>
                      )}
                      <Can permission="rbac:users_assign">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="inline-flex items-center gap-1 rounded bg-secondary hover:bg-secondary/80 text-foreground border border-border px-2.5 py-1 text-xs font-semibold"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </Can>
                      {user.username !== 'superadmin' && (
                        <Can permission="rbac:users_assign">
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 p-1.5"
                            title="Delete User"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </Can>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>{editingUser ? `Edit User: ${editingUser.fullName}` : 'Create New System User'}</span>
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Users can log in immediately via username or email, or via Super Master Password.
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Priya Patel" className="w-full rounded-lg border border-border bg-background px-3 py-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Username *</label>
                  <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya.patel" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    {editingUser ? 'New Password (optional)' : 'Password *'}
                  </label>
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
                <label className="block font-semibold mb-1">Email *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@omniclaim.internal" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Assigned Role *</label>
                <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                  {roles.map((r) => (
                    <option key={r.id} value={r.slug}>{r.name} ({r.slug})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input type="checkbox" checked={isSuperAdminFlag} onChange={(e) => setIsSuperAdminFlag(e.target.checked)} />
                  <span className="text-amber-400">Super Admin (Skip All Permissions)</span>
                </label>
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input type="checkbox" checked={isActiveFlag} onChange={(e) => setIsActiveFlag(e.target.checked)} />
                  <span>Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowUserModal(false)} className="rounded-lg border border-border bg-muted/60 px-4 py-1.5 font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
