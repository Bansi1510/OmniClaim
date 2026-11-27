'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CLAIM_STATUS_THEME, FRAUD_RISK_THEME } from '@/lib/theme-constants';
import { ClaimStatus, FraudRiskTier } from '@omniclaim/shared-types';
import { Can } from '@/components/auth/can';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { useDynamicStore, DynamicClaim } from '@/hooks/use-dynamic-store';
import { useRoleScope } from '@/hooks/use-role-scope';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { Plus, Edit2, Trash2, CheckCircle2, Eye } from 'lucide-react';

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Triage Pending', value: 'TRIAGE_PENDING' },
  { label: 'Manual Review', value: 'MANUAL_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Settled', value: 'SETTLED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function ClaimsQueuePage() {
  const { users, addClaim, updateClaim, deleteClaim, refreshFromBackend } = useDynamicStore();
  const {
    visibleClaims,
    visiblePolicies,
    seesAll,
    canSeeFraud,
    canSeeFinancials,
    canExport,
    scopeLabel,
    totalClaims,
    hasPermission,
  } = useRoleScope();
  const [toast, setToast] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<DynamicClaim | null>(null);
  const [policyNumber, setPolicyNumber] = useState('POL-OMNI-2026-9081');
  const [vehicle, setVehicle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [status, setStatus] = useState<ClaimStatus>('TRIAGE_PENDING');
  const [netPayout, setNetPayout] = useState('650');
  const [fraudScore, setFraudScore] = useState('12');
  const [adjuster, setAdjuster] = useState('Sarah Jenkins');

  const policies = visiblePolicies;
  const canUpdateClaims = hasPermission('claims:update');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fillFromPolicy = (num: string) => {
    const pol = policies.find((p) => p.policyNumber === num);
    if (pol) setVehicle(`${pol.vehicleYear} ${pol.vehicleMake} ${pol.vehicleModel} (VIN: ${pol.vehicleVin})`);
  };

  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasAutoOpenedRef.current) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'new' && hasPermission('claims:create')) {
        hasAutoOpenedRef.current = true;
        const defaultPol = policies[0];
        setEditingClaim(null);
        setPolicyNumber(defaultPol?.policyNumber || 'POL-OMNI-2026-9081');
        setVehicle(
          defaultPol
            ? `${defaultPol.vehicleYear} ${defaultPol.vehicleMake} ${defaultPol.vehicleModel} (VIN: ${defaultPol.vehicleVin})`
            : '2024 Honda Civic Sedan'
        );
        setStatus(canUpdateClaims ? 'TRIAGE_PENDING' : 'SUBMITTED');
        setNetPayout(canUpdateClaims ? '650' : '0');
        setFraudScore(canUpdateClaims ? '12' : '0');
        setAdjuster(canUpdateClaims ? 'Sarah Jenkins' : 'Autonomous STP');
        setShowModal(true);
      }
    }
  }, [policies, hasPermission, canUpdateClaims]);

  const openAdd = () => {
    setEditingClaim(null);
    const defaultPol = policies[0];
    setPolicyNumber(defaultPol?.policyNumber || 'POL-OMNI-2026-9081');
    setVehicle(
      defaultPol
        ? `${defaultPol.vehicleYear} ${defaultPol.vehicleMake} ${defaultPol.vehicleModel} (VIN: ${defaultPol.vehicleVin})`
        : '2024 Honda Civic Sedan'
    );
    setIncidentDesc('');
    setStatus(canUpdateClaims ? 'TRIAGE_PENDING' : 'SUBMITTED');
    setNetPayout(canUpdateClaims ? '650' : '0');
    setFraudScore(canUpdateClaims ? '12' : '0');
    setAdjuster(canUpdateClaims ? 'Sarah Jenkins' : 'Autonomous STP');
    setShowModal(true);
  };

  const openEdit = (claim: DynamicClaim) => {
    setEditingClaim(claim);
    setPolicyNumber(claim.policyNumber);
    setVehicle(claim.vehicle);
    setIncidentDesc(claim.incidentDescription);
    setStatus(claim.status);
    setNetPayout(String(claim.netPayout));
    setFraudScore(String(claim.fraudScore));
    setAdjuster(claim.adjuster);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStatus: ClaimStatus = canUpdateClaims ? status : editingClaim ? editingClaim.status : 'SUBMITTED';
    const effectivePayout = canUpdateClaims ? Number(netPayout) || 0 : editingClaim ? editingClaim.netPayout : 0;
    const score = canUpdateClaims
      ? Math.min(100, Math.max(0, Number(fraudScore) || 0))
      : editingClaim
        ? editingClaim.fraudScore
        : 0;
    const tier: FraudRiskTier = score >= 70 ? 'CRITICAL' : score >= 45 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
    const effectiveAdjuster = canUpdateClaims ? adjuster : editingClaim ? editingClaim.adjuster : 'Autonomous STP';

    if (editingClaim) {
      updateClaim(editingClaim.id, {
        policyNumber,
        vehicle,
        incidentDescription: incidentDesc,
        status: effectiveStatus,
        netPayout: effectivePayout,
        fraudScore: score,
        riskTier: tier,
        adjuster: effectiveAdjuster,
      });
      notify(`Claim ${editingClaim.claimNumber} updated.`);
    } else {
      const claimNumber = `CLM-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      addClaim({
        claimNumber,
        policyNumber,
        vehicle,
        incidentDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        incidentDescription: incidentDesc || 'New accident claim submitted dynamically.',
        status: effectiveStatus,
        fraudScore: score,
        riskTier: tier,
        netPayout: effectivePayout,
        deductible: 500,
        adjuster: effectiveAdjuster,
        damages: [],
        reconciliationItems: [],
        fraudIndicators: [],
      });
      notify(`New claim ${claimNumber} created.`);
    }
    setShowModal(false);
  };

  const handleDelete = (claim: DynamicClaim) => {
    if (confirm(`Delete claim ${claim.claimNumber}? This action cannot be undone.`)) {
      deleteClaim(claim.id);
      notify(`Claim ${claim.claimNumber} deleted.`);
    }
  };

  // Role-wise row actions
  const rowActions = (claim: DynamicClaim): GridAction[] => [
    ...(hasPermission('claims:update')
      ? [{ key: 'edit', label: 'Edit', title: 'Edit Claim', icon: Edit2, onClick: () => openEdit(claim) }]
      : []),
    ...(hasPermission('claims:delete')
      ? [
          {
            key: 'delete',
            label: 'Delete',
            title: 'Delete Claim',
            icon: Trash2,
            tone: 'danger' as const,
            onClick: () => handleDelete(claim),
          },
        ]
      : []),
  ];

  const columns: GridColumn<DynamicClaim>[] = [
    {
      id: 'claimNumber',
      header: 'Claim Dossier',
      minWidth: 160,
      accessor: (c) => `${c.claimNumber} ${c.incidentDate}`,
      summary: 'count',
      cell: (c) => (
        <div>
          <span className="block font-mono font-bold text-foreground">{c.claimNumber}</span>
          <span className="block text-[11px] text-muted-foreground">{c.incidentDate}</span>
        </div>
      ),
    },
    {
      id: 'vehicle',
      header: 'Insured Vehicle & Policy',
      minWidth: 240,
      accessor: (c) => `${c.vehicle} ${c.policyNumber}`,
      cell: (c) => (
        <div>
          <span className="block font-medium text-foreground">{c.vehicle}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{c.policyNumber}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Lifecycle Status',
      filterOptions: STATUS_OPTIONS,
      accessor: (c) => c.status,
      cell: (c) => {
        const theme = CLAIM_STATUS_THEME[c.status];
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${theme.badgeClass}`}>
            {theme.label}
          </span>
        );
      },
    },
    ...(canSeeFraud
      ? [
          {
            id: 'fraud',
            header: 'Fraud Risk Score',
            accessor: (c: DynamicClaim) => c.fraudScore,
            cell: (c: DynamicClaim) => {
              const risk = FRAUD_RISK_THEME[c.riskTier];
              return (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground">{c.fraudScore}/100</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${risk.badgeClass}`}>{risk.label}</span>
                </div>
              );
            },
          } as GridColumn<DynamicClaim>,
        ]
      : []),
    ...(canSeeFinancials
      ? [
          {
            id: 'netPayout',
            header: 'Net Authorized Payout',
            align: 'right' as const,
            accessor: (c: DynamicClaim) => c.netPayout,
            summary: (rows: DynamicClaim[]) => (
              <span className="font-mono text-primary">
                ${rows.reduce((s, r) => s + r.netPayout, 0).toFixed(2)}
              </span>
            ),
            cell: (c: DynamicClaim) => <span className="font-mono font-bold text-foreground">${c.netPayout.toFixed(2)}</span>,
          } as GridColumn<DynamicClaim>,
        ]
      : []),
    {
      id: 'adjuster',
      header: 'Assigned Adjuster',
      accessor: (c) => c.adjuster,
      cell: (c) => <span className="text-muted-foreground">{c.adjuster}</span>,
    },
    {
      id: 'workspace',
      header: 'Workspace',
      sortable: false,
      filterable: false,
      groupable: false,
      exportable: false,
      cell: (c) =>
        hasPermission('claims:read') ? (
          <Link
            href={`/claims/${c.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
          >
            <Eye className="h-3 w-3" /> Workspace →
          </Link>
        ) : null,
    },
  ];

  return (
    <RequirePageAccess permission="claims:read" title="Claims Triage Queue">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Adjuster Triage Queue</h1>
          <p className="text-xs text-muted-foreground">
            Role-wise claim verification grid — filter, group, sort, export, and act on only what your role allows
          </p>
        </div>

        {toast && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{toast}</span>
          </div>
        )}

        <DataGrid<DynamicClaim>
          title="Claims"
          subtitle={scopeLabel}
          data={visibleClaims}
          columns={columns}
          rowKey={(c) => c.id}
          actions={rowActions}
          pageSize={25}
          selectable={seesAll}
          allowExport={canExport}
          exportFileName="omniclaim-claims"
          searchPlaceholder="Search by Claim #, Policy, VIN, status..."
          onRefresh={() => refreshFromBackend()}
          footer={
            <span>
              Role scope: <strong className="text-foreground">{scopeLabel}</strong> · {visibleClaims.length} of {totalClaims} claims visible
              {seesAll ? '' : ' · other claims are hidden for this role'}
            </span>
          }
          toolbar={
            <Can permission="claims:create">
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Submit Claim</span>
              </button>
            </Can>
          }
        />

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
              <h2 className="mb-1 text-lg font-bold text-foreground">
                {editingClaim ? `Edit Claim ${editingClaim.claimNumber}` : 'Initiate New Auto Insurance Claim'}
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {canUpdateClaims
                  ? 'All modifications take effect immediately across workspace, ledger, and audit engines.'
                  : 'Submit incident details for your insured policy. Triage & payout values are evaluated automatically.'}
              </p>

              <form onSubmit={handleSave} className="space-y-3 text-xs">
                <div className={`grid grid-cols-1 gap-3 ${canUpdateClaims ? 'sm:grid-cols-2' : ''}`}>
                  <div>
                    <label className="mb-1 block font-semibold">Policy Number</label>
                    <select
                      value={policyNumber}
                      onChange={(e) => {
                        setPolicyNumber(e.target.value);
                        fillFromPolicy(e.target.value);
                      }}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                    >
                      {policies.map((p) => (
                        <option key={p.id} value={p.policyNumber}>
                          {p.policyNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  {canUpdateClaims && (
                    <div>
                      <label className="mb-1 block font-semibold">Lifecycle Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ClaimStatus)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
                      >
                        {['DRAFT', 'SUBMITTED', 'TRIAGE_PENDING', 'MANUAL_REVIEW', 'APPROVED', 'SETTLED', 'REJECTED'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block font-semibold">Vehicle Description &amp; VIN</label>
                  <input
                    required
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
                  />
                </div>

                {canUpdateClaims && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block font-semibold">Net Payout ($)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={netPayout}
                        onChange={(e) => setNetPayout(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold">Fraud Score (0-100)</label>
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        value={fraudScore}
                        onChange={(e) => setFraudScore(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold">Assigned Adjuster</label>
                      <select
                        value={adjuster}
                        onChange={(e) => setAdjuster(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
                      >
                        <option value="Autonomous STP">Autonomous STP</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.fullName}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-semibold">Incident Description</label>
                  <textarea
                    rows={2}
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                    placeholder="Describe collision details..."
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-border px-4 py-1.5 font-semibold"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 font-bold text-primary-foreground">
                    {editingClaim ? 'Update Claim' : 'Create Claim'}
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
