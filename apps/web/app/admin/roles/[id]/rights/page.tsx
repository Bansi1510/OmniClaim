'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import { usePermissions } from '@/hooks/use-permissions';
import { Can } from '@/components/auth/can';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export default function RoleRightsAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { roles, permissionsCatalog, updateRolePermissions } = useDynamicStore();
  const { hasAnyPermission } = usePermissions();
  const canEditRights = hasAnyPermission(['rbac:roles_assign', 'rbac:roles_update']);

  const targetRole = useMemo(
    () =>
      roles.find((r) => r.id === unwrappedParams.id || r.slug === searchParams.get('slug')) ||
      roles[0],
    [roles, unwrappedParams.id, searchParams]
  );

  const roleName = targetRole?.name || searchParams.get('name') || 'Role';
  const roleSlug = targetRole?.slug || searchParams.get('slug') || 'ROLE';

  const GROUP_MAP: Record<string, string> = {
    POLICIES: 'Operations',
    UNDERWRITING: 'Operations',
    CLAIMS: 'Operations',
    RECONCILIATION: 'Operations',
    FRAUD: 'Operations',
    LEDGER: 'Operations',
    REPORTS: 'Operations',
    MASTER_DATA: 'Administration',
    RBAC: 'Administration',
    SETTINGS: 'Administration',
    AUDIT: 'Administration',
    SUPER_ADMIN: 'Administration',
  };

  const groupSections = useMemo(() => {
    const groups = new Map<string, Map<string, typeof permissionsCatalog>>();
    for (const p of permissionsCatalog) {
      const mod = p.module || 'GENERAL';
      const groupName = p.groupName || GROUP_MAP[mod] || 'Administration';
      if (!groups.has(groupName)) {
        groups.set(groupName, new Map());
      }
      const modMap = groups.get(groupName)!;
      if (!modMap.has(mod)) {
        modMap.set(mod, []);
      }
      modMap.get(mod)!.push(p);
    }

    const orderedNames = [
      'Operations',
      'Administration',
      ...Array.from(groups.keys()).filter((g) => g !== 'Operations' && g !== 'Administration'),
    ];
    return orderedNames
      .filter((g) => groups.has(g))
      .map((groupName) => {
        const modMap = groups.get(groupName)!;
        const modules = Array.from(modMap.entries()).map(([module, permissions]) => ({
          module,
          permissions,
        }));
        const allPermissions = modules.flatMap((m) => m.permissions);
        return { groupName, modules, allPermissions };
      });
  }, [permissionsCatalog]);

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!targetRole) return;
    if (targetRole.permissions.includes('*')) {
      setSelectedSlugs(new Set(permissionsCatalog.map((p) => p.slug)));
    } else {
      setSelectedSlugs(new Set(targetRole.permissions));
    }
    setIsDirty(false);
  }, [targetRole, permissionsCatalog]);

  const toggleAccordion = (mod: string) => {
    setOpenAccordions((prev) => ({ ...prev, [mod]: !(prev[mod] ?? true) }));
  };

  const handleToggleSingle = (slug: string) => {
    if (!canEditRights) return;
    setIsDirty(true);
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleToggleModuleAll = (perms: typeof permissionsCatalog) => {
    if (!canEditRights) return;
    setIsDirty(true);
    const allSlugs = perms.map((p) => p.slug);
    const allSelected = allSlugs.every((s) => selectedSlugs.has(s));

    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (allSelected) allSlugs.forEach((s) => next.delete(s));
      else allSlugs.forEach((s) => next.add(s));
      return next;
    });
  };

  const handleSave = () => {
    if (!targetRole) return;
    const nextPerms =
      targetRole.slug === 'SUPER_ADMIN' ? ['*'] : Array.from(selectedSlugs);
    updateRolePermissions(targetRole.id, nextPerms);
    setToastMessage(`Rights for '${roleName}' updated live! Redirecting to Roles...`);
    setIsDirty(false);
    setTimeout(() => {
      router.push('/admin/roles');
    }, 600);
  };

  return (
    <RequirePageAccess
      permission={['rbac:roles_read', 'rbac:roles_assign', 'rbac:roles_update']}
      title="Assign Role Rights"
    >
      <div className="pb-24">
      <Breadcrumb
        title={`Assign Rights: ${roleName}`}
        items={[{ label: 'Setup' }, { label: 'Role & Rights', href: '/admin/roles' }]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{roleName}</h2>
            <span className="rounded bg-primary/10 border border-primary/30 px-2 py-0.5 text-xs font-mono font-bold text-primary">
              {roleSlug}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure module-level access and granular action rights. Changes update live role permissions immediately.
          </p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          Total Authorized Rights: <span className="text-primary font-mono font-bold">{selectedSlugs.size}</span>
        </span>
      </div>

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-500 mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="columns-1 md:columns-2 gap-4 space-y-4">
        {groupSections.map((group) => {
          const isGroupOpen = openAccordions[group.groupName] ?? true;
          const groupSlugs = group.allPermissions.map((p) => p.slug);
          const groupAllSelected = groupSlugs.every((s) => selectedSlugs.has(s));
          const groupSomeSelected = groupSlugs.some((s) => selectedSlugs.has(s)) && !groupAllSelected;

          return (
            <div key={group.groupName} className="break-inside-avoid rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Level 1: Group Header */}
              <div
                onClick={() => toggleAccordion(group.groupName)}
                className="flex items-center justify-between p-4 bg-muted/40 border-b border-border/60 cursor-pointer"
              >
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    id={`select-group-${group.groupName}`}
                    checked={groupAllSelected}
                    disabled={!canEditRights}
                    ref={(el) => {
                      if (el) el.indeterminate = groupSomeSelected;
                    }}
                    onChange={() => handleToggleModuleAll(group.allPermissions)}
                    className="h-4 w-4 rounded border-border text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <label htmlFor={`select-group-${group.groupName}`} className="font-bold text-sm text-foreground cursor-pointer hover:text-primary">
                    {group.groupName} ({group.modules.length} Modules · {group.allPermissions.length} Rights)
                  </label>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion(group.groupName);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {isGroupOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Level 2: Modules inside Group */}
              {isGroupOpen && (
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-card">
                  {group.modules.map((mod) => {
                    const modSlugs = mod.permissions.map((p) => p.slug);
                    const modAllSelected = modSlugs.every((s) => selectedSlugs.has(s));
                    const modSomeSelected = modSlugs.some((s) => selectedSlugs.has(s)) && !modAllSelected;

                    return (
                      <div key={mod.module} className="rounded-lg border border-border/70 bg-muted/10 p-3 space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                          <input
                            type="checkbox"
                            id={`select-mod-${mod.module}`}
                            checked={modAllSelected}
                            disabled={!canEditRights}
                            ref={(el) => {
                              if (el) el.indeterminate = modSomeSelected;
                            }}
                            onChange={() => handleToggleModuleAll(mod.permissions)}
                            className="h-3.5 w-3.5 rounded border-border text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <label htmlFor={`select-mod-${mod.module}`} className="text-xs font-bold text-foreground cursor-pointer">
                            {mod.module} ({mod.permissions.length})
                          </label>
                        </div>

                        {/* Level 3: Individual Rights inline */}
                        <div className="flex flex-wrap gap-2">
                          {mod.permissions.map((perm) => {
                            const isChecked = selectedSlugs.has(perm.slug);
                            return (
                              <label
                                key={perm.slug}
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition select-none ${
                                  canEditRights ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                                } ${
                                  isChecked
                                    ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!canEditRights}
                                  onChange={() => handleToggleSingle(perm.slug)}
                                  className="h-3.5 w-3.5 rounded border-border text-primary"
                                />
                                <span className="font-medium text-xs capitalize">
                                  {perm.action || perm.slug.split(':')[1] || perm.slug}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur p-4 shadow-lg">
        <div className="container max-w-screen-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {isDirty ? (
              <span className="flex items-center gap-1.5 font-semibold text-amber-500">
                <AlertTriangle className="h-4 w-4" /> Unsaved permission modifications detected.
              </span>
            ) : (
              <span className="text-muted-foreground">All rights synchronized live.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/roles" className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-2 text-xs font-semibold">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Roles
            </Link>
            <Can
              permission="rbac:roles_update"
              fallback={
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                  <Lock className="h-3.5 w-3.5" /> Update rights required
                </span>
              }
            >
              <button onClick={handleSave} className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 text-xs font-bold shadow-md">
                <Save className="h-3.5 w-3.5" /> Save Rights
              </button>
            </Can>
          </div>
        </div>
      </div>
      </div>
    </RequirePageAccess>
  );
}
