'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { Shield, Plus, Edit2, Trash2, Search, CheckCircle2, Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore, DynamicRole } from '@/hooks/use-dynamic-store';
import { Can } from '@/components/auth/can';

export default function RoleManagementPage() {
  const { isSystemAdmin, hasAnyPermission } = usePermissions();
  const { roles, users, addRole, updateRole, deleteRole } = useDynamicStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<DynamicRole | null>(null);

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canPerformAnyAction =
    isSystemAdmin ||
    hasAnyPermission(['rbac:roles_assign', 'rbac:roles_update', 'rbac:roles_delete']);

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}

          <Can permission="rbac:roles_create">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-semibold shadow transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Role</span>
            </button>
          </Can>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">Role Title &amp; Slug</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-center">Type</th>
              <th className="py-3 px-4 text-center">Assigned Users</th>
              <th className="py-3 px-4 text-center">Active Rights</th>
              {canPerformAnyAction && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredRoles.map((role) => {
              const userCount = users.filter((u) => u.roleSlug === role.slug).length;
              const rightsLabel = role.permissions.includes('*') ? 'ALL (*)' : `${role.permissions.length} rights`;

              return (
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
                    {userCount}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-primary">
                    {rightsLabel}
                  </td>
                  {canPerformAnyAction && (
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Can permission="rbac:roles_assign">
                          <Link
                            href={`/admin/roles/${role.id}/rights?name=${encodeURIComponent(role.name)}&slug=${role.slug}`}
                            className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 text-xs font-semibold transition"
                            title="Assign Rights / Permissions"
                          >
                            <Shield className="h-3 w-3" />
                            <span>Rights</span>
                          </Link>
                        </Can>

                        <Can permission="rbac:roles_update">
                          <button
                            onClick={() => handleOpenEdit(role)}
                            className="rounded bg-muted hover:bg-muted/80 text-foreground p-1 text-xs transition"
                            title="Edit Role Details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </Can>

                        {!role.isSystem && (
                          <Can permission="rbac:roles_delete">
                            <button
                              onClick={() => handleDelete(role)}
                              className="rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 p-1 text-xs transition"
                              title="Delete Role"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </Can>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-1">
              {editingRole ? 'Edit Role Details' : 'Create New Custom Role'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Roles bind permission policies dynamically across the entire platform.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Role Name *</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Regional Audit Lead" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Role Slug *</label>
                <input type="text" required disabled={Boolean(editingRole)} value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="e.g. REGIONAL_AUDIT_LEAD" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono uppercase disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <textarea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-border bg-muted/60 px-4 py-1.5 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold">
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
