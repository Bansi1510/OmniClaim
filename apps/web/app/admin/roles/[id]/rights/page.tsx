'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import { Can } from '@/components/auth/can';
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
  const searchParams = useSearchParams();
  const { roles, permissionsCatalog, updateRolePermissions } = useDynamicStore();

  const targetRole = useMemo(
    () =>
      roles.find((r) => r.id === unwrappedParams.id || r.slug === searchParams.get('slug')) ||
      roles[0],
    [roles, unwrappedParams.id, searchParams]
  );

  const roleName = targetRole?.name || searchParams.get('name') || 'Role';
  const roleSlug = targetRole?.slug || searchParams.get('slug') || 'ROLE';

  const moduleSections = useMemo(() => {
    const map = new Map<string, { module: string; permissions: typeof permissionsCatalog }>();
    for (const p of permissionsCatalog) {
      if (!map.has(p.module)) {
        map.set(p.module, { module: p.module, permissions: [] });
      }
      map.get(p.module)!.permissions.push(p);
    }
    return Array.from(map.values());
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
    setIsDirty(true);
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleToggleModuleAll = (perms: typeof permissionsCatalog) => {
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
    setToastMessage(`Rights for '${roleName}' updated live! Menus & buttons refreshed immediately.`);
    setIsDirty(false);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
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

      <div className="space-y-4">
        {moduleSections.map((section) => {
          const isOpen = openAccordions[section.module] ?? true;
          const allSlugs = section.permissions.map((p) => p.slug);
          const allSelected = allSlugs.every((s) => selectedSlugs.has(s));
          const someSelected = allSlugs.some((s) => selectedSlugs.has(s)) && !allSelected;

          return (
            <div key={section.module} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-muted/30 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`select-all-${section.module}`}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => handleToggleModuleAll(section.permissions)}
                    className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                  />
                  <label htmlFor={`select-all-${section.module}`} className="font-bold text-sm text-foreground cursor-pointer hover:text-primary">
                    {section.module} MODULE ({section.permissions.length} Rights)
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => toggleAccordion(section.module)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {isOpen && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-card">
                  {section.permissions.map((perm) => {
                    const isChecked = selectedSlugs.has(perm.slug);
                    return (
                      <div
                        key={perm.slug}
                        onClick={() => handleToggleSingle(perm.slug)}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition select-none ${
                          isChecked ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-background hover:bg-muted/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 rounded border-border text-primary pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{perm.action}</span>
                            <span className="text-[10px] font-mono text-primary font-semibold">{perm.slug}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{perm.description}</p>
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
  );
}
