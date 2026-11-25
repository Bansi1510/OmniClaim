'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { Search, UserCheck, Shield, CheckCircle2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { Can } from '@/components/auth/can';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  roleName: string;
  roleSlug: string;
  isActive: boolean;
  assignedAt: string;
}

const INITIAL_USERS: UserRow[] = [
  {
    id: 'u-1',
    email: 'admin@omniclaim.internal',
    fullName: 'Chief Enterprise Admin',
    roleName: 'Super Administrator',
    roleSlug: 'SUPER_ADMIN',
    isActive: true,
    assignedAt: '2026-11-20',
  },
  {
    id: 'u-2',
    email: 'adjuster.senior@omniclaim.internal',
    fullName: 'Sarah Jenkins',
    roleName: 'Senior Claims Adjuster',
    roleSlug: 'SENIOR_ADJUSTER',
    isActive: true,
    assignedAt: '2026-11-21',
  },
  {
    id: 'u-3',
    email: 'fraud.siu@omniclaim.internal',
    fullName: 'Marcus Vance',
    roleName: 'SIU Fraud Investigator',
    roleSlug: 'FRAUD_INVESTIGATOR',
    isActive: true,
    assignedAt: '2026-11-22',
  },
  {
    id: 'u-4',
    email: 'finance.controller@omniclaim.internal',
    fullName: 'David Sterling',
    roleName: 'Finance Controller',
    roleSlug: 'FINANCE_CONTROLLER',
    isActive: true,
    assignedAt: '2026-11-23',
  },
];

export default function UserManagementPage() {
  const { isSystemAdmin, hasPermission } = usePermissions();
  const [users, setUsers] = useState<UserRow[]>(INITIAL_USERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newRoleSlug, setNewRoleSlug] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canAssignRole = isSystemAdmin || hasPermission('rbac:users_assign');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAssign = (user: UserRow) => {
    setSelectedUser(user);
    setNewRoleSlug(user.roleSlug);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newRoleSlug) return;

    const roleNameMap: Record<string, string> = {
      SUPER_ADMIN: 'Super Administrator',
      SENIOR_ADJUSTER: 'Senior Claims Adjuster',
      JUNIOR_ADJUSTER: 'Junior Claims Adjuster',
      FRAUD_INVESTIGATOR: 'SIU Fraud Investigator',
      FINANCE_CONTROLLER: 'Finance Controller',
    };

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              roleSlug: newRoleSlug,
              roleName: roleNameMap[newRoleSlug] || newRoleSlug,
            }
          : u
      )
    );

    showToast(`Role updated for ${selectedUser.fullName}. Redis permissions cache invalidated.`);
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.roleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <Breadcrumb
        title="User Access & Role Assignment"
        items={[{ label: 'Setup' }, { label: 'User Management' }]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-border bg-card pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-80 shadow-sm"
          />
        </div>

        {toastMessage && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Assigned Role</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Assigned Since</th>
              {canAssignRole && <th className="py-3 px-4 text-right">Action</th>}
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
                    {user.fullName}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground pl-8">
                    {user.email}
                  </span>
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
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                    Active
                  </span>
                </td>
                <td className="py-3.5 px-4 text-muted-foreground font-mono">
                  {user.assignedAt}
                </td>
                {canAssignRole && (
                  <td className="py-3.5 px-4 text-right">
                    <Can permission="rbac:users_assign">
                      <button
                        onClick={() => handleOpenAssign(user)}
                        className="inline-flex items-center gap-1 rounded bg-secondary hover:bg-secondary/80 text-foreground border border-border px-3 py-1 text-xs font-semibold transition"
                      >
                        <UserCheck className="h-3 w-3" />
                        <span>Change Role</span>
                      </button>
                    </Can>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-bold text-foreground mb-1">
              Change Role for {selectedUser.fullName}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Updating the user role recalculates active permissions in real-time.
            </p>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Select Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                >
                  <option value="SUPER_ADMIN">Super Administrator (Full System Authority)</option>
                  <option value="SENIOR_ADJUSTER">Senior Claims Adjuster (Approval & Override Authority)</option>
                  <option value="JUNIOR_ADJUSTER">Junior Claims Adjuster (Intake & Triage Rights)</option>
                  <option value="FRAUD_INVESTIGATOR">SIU Fraud Investigator (Special Investigation Unit)</option>
                  <option value="FINANCE_CONTROLLER">Finance Controller (Ledger & Payout Authority)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-1.5 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 text-xs font-semibold shadow transition"
                >
                  Confirm & Invalidate Cache
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
