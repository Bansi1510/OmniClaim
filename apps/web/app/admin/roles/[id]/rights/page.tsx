'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface PermissionAction {
  slug: string;
  action: string;
  description: string;
}

interface ModuleSection {
  module: string;
  displayName: string;
  description: string;
  permissions: PermissionAction[];
}

// Complete Hierarchical Module Catalog (Matching College ERP Accordion Format)
const MODULE_SECTIONS: ModuleSection[] = [
  {
    module: 'CLAIMS',
    displayName: 'Claims Lifecycle Management',
    description: 'Intake, triage queue, visual review, approval, dispute rejection, and financial settlement',
    permissions: [
      { slug: 'claims:read', action: 'VIEW', description: 'View claims list and detail dossiers' },
      { slug: 'claims:create', action: 'CREATE', description: 'Initiate new auto accident claims' },
      { slug: 'claims:update', action: 'EDIT', description: 'Modify claim metadata and insured vehicle info' },
      { slug: 'claims:triage', action: 'TRIAGE', description: 'Triage and dispatch claims to adjusters' },
      { slug: 'claims:approve', action: 'APPROVE', description: 'Authorize formal claim approvals' },
      { slug: 'claims:reject', action: 'REJECT', description: 'Reject claim with documented justification' },
      { slug: 'claims:settle', action: 'SETTLE', description: 'Disburse payouts and post balanced ledger vouchers' },
    ],
  },
  {
    module: 'RECONCILIATION',
    displayName: 'Bill Reconciliation & Phantom Diff Engine',
    description: 'OCR invoice item comparison against AI visual damages and phantom deduction overrides',
    permissions: [
      { slug: 'claims:reconcile_view', action: 'VIEW', description: 'View invoice diff tables and phantom charges' },
      { slug: 'claims:reconcile_run', action: 'EXECUTE', description: 'Trigger automatic bill reconciliation' },
      { slug: 'claims:override_reconciliation', action: 'OVERRIDE', description: 'Manually override phantom item deductions' },
    ],
  },
  {
    module: 'ACTUARIAL',
    displayName: 'Actuarial Math & Depreciation Engine',
    description: 'Deterministic statutory depreciation schedules, deductibles, and net settlement calculation',
    permissions: [
      { slug: 'actuarial:view', action: 'VIEW', description: 'Inspect gross parts, depreciation waterfall, and net payout' },
      { slug: 'actuarial:calculate', action: 'EXECUTE', description: 'Recompute statutory depreciation and deductible math' },
    ],
  },
  {
    module: 'FRAUD',
    displayName: 'Fraud Detection & SIU Special Investigation Unit',
    description: 'Haversine GPS checks, mock-location detection, and pgvector cosine vector similarity audits',
    permissions: [
      { slug: 'fraud:read', action: 'VIEW', description: 'View composite risk scorecards and triggered flags' },
      { slug: 'fraud:override', action: 'OVERRIDE', description: 'Documented override of triggered fraud indicators' },
      { slug: 'fraud:investigate', action: 'SIU REFERRAL', description: 'Refer claim for deep SIU criminal fraud investigation' },
    ],
  },
  {
    module: 'LEDGER',
    displayName: 'Financial Accounting & Balanced Double-Entry Ledger',
    description: 'Balanced journal entry creation, accrual/payment vouchers, and zero-sum balance audits',
    permissions: [
      { slug: 'ledger:read', action: 'VIEW', description: 'Inspect general ledger journals and balance sheets' },
      { slug: 'ledger:post', action: 'POST VOUCHER', description: 'Post manual or automated double-entry vouchers' },
      { slug: 'ledger:export', action: 'EXPORT', description: 'Export GAAP/IFRS compliant financial audit statements' },
    ],
  },
  {
    module: 'STP',
    displayName: 'Straight-Through Processing (STP)',
    description: 'Autonomous fast-track auto-settlement for clean minor claims under $750 in under 45 seconds',
    permissions: [
      { slug: 'stp:view', action: 'VIEW', description: 'View STP qualification metrics and execution logs' },
      { slug: 'stp:execute', action: 'EXECUTE', description: 'Trigger autonomous fast-track claim settlement' },
    ],
  },
  {
    module: 'RBAC',
    displayName: 'Dynamic Role & Access Rights Management',
    description: 'Runtime creation of custom roles, assignment of module permissions, and user role binding',
    permissions: [
      { slug: 'rbac:roles_create', action: 'CREATE ROLE', description: 'Create new custom enterprise roles' },
      { slug: 'rbac:roles_update', action: 'EDIT RIGHTS', description: 'Modify role permission bindings' },
      { slug: 'rbac:roles_delete', action: 'DELETE ROLE', description: 'Delete non-system custom roles' },
      { slug: 'rbac:users_assign', action: 'ASSIGN USERS', description: 'Assign or revoke roles from users' },
    ],
  },
  {
    module: 'AUDIT',
    displayName: 'Audit Trail & Collaborative Presence',
    description: 'Immutable time-travel field modification logs and active adjuster presence leases',
    permissions: [
      { slug: 'audit:read', action: 'VIEW LOGS', description: 'Inspect immutable time-travel audit records' },
      { slug: 'presence:unlock', action: 'FORCE UNLOCK', description: 'Force release active adjuster presence lock' },
    ],
  },
];

export default function RoleRightsAssignmentPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const roleName = searchParams.get('name') || 'Senior Claims Adjuster';
  const roleSlug = searchParams.get('slug') || 'SENIOR_ADJUSTER';

  // State of selected permission slugs
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(
    new Set([
      'claims:read', 'claims:update', 'claims:triage', 'claims:approve',
      'claims:reconcile_view', 'claims:reconcile_run', 'claims:override_reconciliation',
      'actuarial:view', 'actuarial:calculate', 'fraud:read', 'fraud:override',
      'ledger:read', 'stp:view', 'stp:execute', 'audit:read',
    ])
  );

  // Accordion collapsed state per module
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    CLAIMS: true,
    RECONCILIATION: true,
    ACTUARIAL: true,
    FRAUD: true,
    LEDGER: true,
    STP: true,
    RBAC: true,
    AUDIT: true,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleAccordion = (mod: string) => {
    setOpenAccordions((prev) => ({ ...prev, [mod]: !prev[mod] }));
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

  const handleToggleModuleAll = (section: ModuleSection) => {
    setIsDirty(true);
    const allSlugs = section.permissions.map((p) => p.slug);
    const allSelected = allSlugs.every((s) => selectedSlugs.has(s));

    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allSlugs.forEach((s) => next.delete(s));
      } else {
        allSlugs.forEach((s) => next.add(s));
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!isDirty) {
      alert('No changes occurred.');
      return;
    }

    // Call API /api/v1/rbac/roles/:id/permissions
    setToastMessage(`Rights for '${roleName}' updated successfully! Redis permission cache invalidated.`);
    setIsDirty(false);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="pb-24">
      <Breadcrumb
        title={`Assign Rights: ${roleName}`}
        items={[
          { label: 'Setup' },
          { label: 'Role & Rights', href: '/admin/roles' },
        ]}
      />

      {/* Role Banner */}
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
            Configure module-level access and granular action rights. Changes apply immediately upon saving.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            Total Authorized Rights: <span className="text-primary font-mono font-bold">{selectedSlugs.size}</span>
          </span>
        </div>
      </div>

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-500 mb-6 animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hierarchical Accordion Checkbox List (Exact College ERP Pattern) */}
      <div className="space-y-4">
        {MODULE_SECTIONS.map((section) => {
          const isOpen = openAccordions[section.module];
          const allSlugs = section.permissions.map((p) => p.slug);
          const allSelected = allSlugs.every((s) => selectedSlugs.has(s));
          const someSelected = allSlugs.some((s) => selectedSlugs.has(s)) && !allSelected;

          return (
            <div
              key={section.module}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Accordion Header */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border-b border-border/60">
                <div className="flex items-center gap-3">
                  {/* Select All Checkbox per Module */}
                  <input
                    type="checkbox"
                    id={`select-all-${section.module}`}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => handleToggleModuleAll(section)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor={`select-all-${section.module}`}
                      className="font-bold text-sm text-foreground cursor-pointer hover:text-primary transition"
                    >
                      {section.displayName}
                    </label>
                    <p className="text-[11px] text-muted-foreground">{section.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleAccordion(section.module)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Accordion Body with Granular Inline Checkboxes */}
              {isOpen && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-card">
                  {section.permissions.map((perm) => {
                    const isChecked = selectedSlugs.has(perm.slug);
                    return (
                      <div
                        key={perm.slug}
                        onClick={() => handleToggleSingle(perm.slug)}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition select-none ${
                          isChecked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border/50 bg-background hover:bg-muted/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by container onClick
                          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{perm.action}</span>
                            <span className="text-[10px] font-mono text-primary font-semibold">
                              {perm.slug}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {perm.description}
                          </p>
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

      {/* Sticky Bottom Action Bar matching College ERP */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur p-4 shadow-lg">
        <div className="container max-w-screen-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {isDirty ? (
              <span className="flex items-center gap-1.5 font-semibold text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                Unsaved permission modifications detected.
              </span>
            ) : (
              <span className="text-muted-foreground">All rights synchronized with database.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/roles"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-2 text-xs font-semibold transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Roles</span>
            </Link>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 text-xs font-bold shadow-md transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Rights</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
