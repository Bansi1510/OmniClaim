'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { Shield, Plus, Edit2, Trash2, Search, CheckCircle2, Lock } from 'lucide-react';

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissionsCount: number;
}

const INITIAL_ROLES: RoleRow[] = [
  {
    id: 'role-super-admin',
    name: 'Super Administrator',
    slug: 'SUPER_ADMIN',
    description: 'Unrestricted enterprise administrative access with full authority',
    isSystem: true,
    userCount: 2,
    permissionsCount: 24,
  },
  {
    id: 'role-senior-adjuster',
    name: 'Senior Claims Adjuster',
    slug: 'SENIOR_ADJUSTER',
    description: 'Assesses high-value claims, authorizes settlements, and overrides phantom line items',
    isSystem: true,
    userCount: 5,
    permissionsCount: 16,
  },
  {
    id: 'role-junior-adjuster',
    name: 'Junior Claims Adjuster',
    slug: 'JUNIOR_ADJUSTER',
    description: 'Intake triage, photo inspection, and initial damage verification without payout authorization',
    isSystem: true,
    userCount: 12,
    permissionsCount: 6,
  },
  {
    id: 'role-fraud-siu',
    name: 'SIU Fraud Investigator',
    slug: 'FRAUD_INVESTIGATOR',
    description: 'Special Investigation Unit: reviews vector similarities, GPS anomalies, and SIU referrals',
    isSystem: true,
    userCount: 3,
    permissionsCount: 8,
  },
  {
    id: 'role-finance-controller',
    name: 'Finance Controller',
    slug: 'FINANCE_CONTROLLER',
    description: 'Audits balanced double-entry accounting ledgers and authorizes disbursement vouchers',
    isSystem: true,
    userCount: 4,
    permissionsCount: 7,
  },
];

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleRow[]>(INITIAL_ROLES);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);

  // Form states for Add/Edit
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

  const handleOpenEdit = (role: RoleRow) => {
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
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? { ...r, name: formName, description: formDesc }
            : r
        )
      );
      showToast(`Role '${formName}' updated successfully.`);
    } else {
      const newRole: RoleRow = {
        id: `role-${Date.now()}`,
        name: formName,
        slug: formSlug.toUpperCase().replace(/\s+/g, '_'),
        description: formDesc,
        isSystem: false,
        userCount: 0,
        permissionsCount: 0,
      };
      setRoles((prev) => [...prev, newRole]);
      showToast(`New custom role '${formName}' created.`);
    }

    setShowModal(false);
  };

  const handleDelete = (role: RoleRow) => {
    if (role.isSystem) {
      alert(`System role '${role.name}' is protected and cannot be deleted.`);
      return;
    }
    if (confirm(`Are you sure you want to delete role '${role.name}'?`)) {
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      showToast(`Role '${role.name}' deleted.`);
    }
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <Breadcrumb
        title="Role Management"
        items={[{ label: 'Setup' }, { label: 'Role & Rights' }]}
      />

      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search roles by name or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-border bg-card pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-72 shadow-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-semibold shadow transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Role</span>
          </button>
        </div>
      </div>

      {/* Role Data Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">Role Title & Slug</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-center">Type</th>
              <th className="py-3 px-4 text-center">Assigned Users</th>
              <th className="py-3 px-4 text-center">Active Rights</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredRoles.map((role) => (
              <tr key={role.id} className="hover:bg-muted/20 transition">
                <td className="py-3.5 px-4">
                  <div className="font-bold text-foreground text-sm flex items-center gap-2">
                    {role.name}
                    {role.isSystem && (
                      <span className="text-muted-foreground" title="System Role">
                        <Lock className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    {role.slug}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-muted-foreground max-w-md">
                  {role.description}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      role.isSystem
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}
                  >
                    {role.isSystem ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-foreground">
                  {role.userCount}
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-primary">
                  {role.permissionsCount} rights
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Assign Rights Button (Shield Icon) matching college erp */}
                    <Link
                      href={`/admin/roles/${role.id}/rights?name=${encodeURIComponent(role.name)}&slug=${role.slug}`}
                      className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 text-xs font-semibold transition"
                      title="Assign Rights / Permissions"
                    >
                      <Shield className="h-3 w-3" />
                      <span>Rights</span>
                    </Link>

                    {/* Edit Role Button */}
                    <button
                      onClick={() => handleOpenEdit(role)}
                      className="rounded bg-muted hover:bg-muted/80 text-foreground p-1 text-xs transition"
                      title="Edit Role Details"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete Role Button */}
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 p-1 text-xs transition"
                        title="Delete Role"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-bold text-foreground mb-1">
              {editingRole ? 'Edit Role Details' : 'Create New Custom Role'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Roles bind permission policies to adjusters, investigators, and finance controllers.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Role Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Fraud Auditor"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Role Slug / Identifier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingRole)}
                  placeholder="e.g. SENIOR_FRAUD_AUDITOR"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono uppercase disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain responsibilities and authority bounds..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-1.5 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 text-xs font-semibold shadow transition"
                >
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
