'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { DamageCanvas } from '@/components/claims/damage-canvas';
import { CarWireframe } from '@/components/claims/car-wireframe';
import { ReconciliationTable } from '@/components/claims/reconciliation-table';
import { ActuarialWaterfall } from '@/components/claims/actuarial-waterfall';
import { FraudScorecardView } from '@/components/claims/fraud-scorecard';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { CLAIM_STATUS_THEME } from '@/lib/theme-constants';
import { VehiclePartType, MaterialType, DamageSeverity, ClaimStatus, FraudRiskTier } from '@omniclaim/shared-types';
import { Can } from '@/components/auth/can';
import { usePermissions } from '@/hooks/use-permissions';
import { useRoleScope } from '@/hooks/use-role-scope';
import { useDynamicStore, type DynamicDamageItem } from '@/hooks/use-dynamic-store';
import { Plus, Trash2, Crown, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

export default function AdjusterWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const { isSystemAdmin, bypassAllPermissions, userName, userEmail, username, activeRole, hasPermission } =
    usePermissions();
  const { canAccessClaim, canSeeFraud } = useRoleScope();
  const { claims, updateClaim, appendFieldAudit, addJournalEntry } = useDynamicStore();

  const claim = useMemo(
    () => claims.find((c) => c.id === unwrappedParams.id),
    [claims, unwrappedParams.id]
  );

  const [activeTab, setActiveTab] = useState<'evidence' | 'reconciliation' | 'fraud' | 'actuarial'>('evidence');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'fraud' && !canSeeFraud) {
      setActiveTab('evidence');
    }
  }, [activeTab, canSeeFraud]);

  // Add Damage state
  const [newPart, setNewPart] = useState<VehiclePartType>('HOOD_BONNET');
  const [newMat, setNewMat] = useState<MaterialType>('METAL');
  const [newSev, setNewSev] = useState<DamageSeverity>('DENT');

  // Add Reconciliation Line Item state
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newIsLabor, setNewIsLabor] = useState(false);

  // Add Fraud Flag state
  const [newFlagType, setNewFlagType] = useState('EXIF_GPS_MISMATCH');
  const [newFlagPts, setNewFlagPts] = useState('25');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (!claim) {
    return (
      <RequirePageAccess permission="claims:read" title="Claim Dossier Workspace">
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Claim not found.</p>
          <Link href="/claims" className="mt-2 inline-block text-xs text-primary underline">
            Back to Claims Queue
          </Link>
        </div>
      </RequirePageAccess>
    );
  }

  if (!canAccessClaim(claim)) {
    return (
      <RequirePageAccess permission="claims:read" title="Claim Dossier Workspace">
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-rose-500/30 bg-card p-8 text-center shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Claim Outside Your Role Scope</h1>
          <p className="text-xs text-muted-foreground">
            Account <span className="font-mono font-semibold text-foreground">@{username}</span> ({activeRole}) can only inspect claims linked to your own policies.
          </p>
          <Link
            href="/claims"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Your Claims</span>
          </Link>
        </div>
      </RequirePageAccess>
    );
  }

  const totalBilled = claim.reconciliationItems.reduce((s, i) => s + i.claimedCost, 0);
  const totalApproved = claim.reconciliationItems.reduce((s, i) => s + i.approvedCost, 0);
  const totalPhantom = claim.reconciliationItems.reduce((s, i) => s + i.systemDeduction, 0);
  const laborApproved = claim.reconciliationItems
    .filter((i) => i.isLabor && i.isVerifiedByDamage)
    .reduce((s, i) => s + i.approvedCost, 0);
  const partsApproved = Math.max(0, totalApproved - laborApproved);
  const plasticDep = Number((partsApproved * 0.25).toFixed(2));
  const computedNet = Math.max(0, partsApproved - plasticDep + laborApproved);

  const actuarial = {
    grossPartsTotal: partsApproved,
    metalDepreciation: 0,
    plasticDepreciation: plasticDep,
    glassDepreciation: 0,
    totalDepreciation: plasticDep,
    totalLaborApproved: laborApproved,
    applicableDeductible: claim.deductible || 500,
    salvageValue: 0,
    netPayout: totalApproved > 0 ? computedNet : claim.netPayout,
    isStpQualified: claim.fraudScore < 15 && totalPhantom === 0 && claim.netPayout <= 750,
  };

  const handleStatusChange = (nextStatus: ClaimStatus, reason: string) => {
    const oldStatus = claim.status;
    updateClaim(claim.id, { status: nextStatus, netPayout: actuarial.netPayout });
    appendFieldAudit({
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      field: 'status',
      oldValue: `${oldStatus} (v${claim.version})`,
      newValue: `${nextStatus} (v${claim.version + 1})`,
      modifiedBy: userName,
      modifiedByEmail: userEmail,
      reason,
    });

    if (nextStatus === 'SETTLED') {
      const vchr = `VCHR-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
      addJournalEntry({
        voucherNumber: vchr,
        date: dateStr,
        claimNumber: claim.claimNumber,
        account: 'Claims Incurred Losses (Expense)',
        entryType: 'DEBIT',
        amount: actuarial.netPayout,
        description: `Settlement payout approved by ${userName}`,
        isReconciled: true,
      });
      addJournalEntry({
        voucherNumber: vchr,
        date: dateStr,
        claimNumber: claim.claimNumber,
        account: 'Settlement Disbursement Clearing (Cash)',
        entryType: 'CREDIT',
        amount: actuarial.netPayout,
        description: `Disbursement voucher ${vchr} posted`,
        isReconciled: true,
      });
    }
    notify(`Claim ${claim.claimNumber} transitioned to ${nextStatus}.`);
  };

  const handleAddDamage = (e: React.FormEvent) => {
    e.preventDefault();
    const nextDamages = [
      ...claim.damages,
      {
        id: `dmg-${Date.now()}`,
        evidenceId: 'ev-manual',
        partType: newPart,
        materialType: newMat,
        severity: newSev,
        confidence: 1.0,
        boundingBox: { xmin: 0.3, ymin: 0.35, xmax: 0.68, ymax: 0.72 },
        repairAction: 'REPLACE' as const,
        isManualAdded: true,
      },
    ];
    updateClaim(claim.id, { damages: nextDamages });
    notify(`Added manual damage detection: ${newPart}.`);
  };

  const handleDeleteDamage = (dmgId: string) => {
    updateClaim(claim.id, { damages: claim.damages.filter((d) => d.id !== dmgId) });
    notify('Damage annotation removed.');
  };

  const handleOverrideReconciliation = (itemId: string, approved: boolean) => {
    const nextItems = claim.reconciliationItems.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        isVerifiedByDamage: approved,
        isManualOverride: true,
        approvedCost: approved ? item.claimedCost : 0,
        systemDeduction: approved ? 0 : item.claimedCost,
        overrideReason: `Manual override by ${userName}`,
      };
    });
    updateClaim(claim.id, { reconciliationItems: nextItems });
    notify(`Line item ${approved ? 'approved' : 'marked phantom'} via manual override.`);
  };

  const handleAddReconciliationItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(newCost);
    if (!newDesc.trim() || isNaN(cost) || cost <= 0) return;
    const nextItems = [
      ...claim.reconciliationItems,
      {
        id: `rec-${Date.now()}`,
        billLineItemId: `bli-${Date.now()}`,
        rawDescription: newDesc,
        claimedCost: cost,
        isLabor: newIsLabor,
        isVerifiedByDamage: true,
        matchedDamagePart: null,
        systemDeduction: 0,
        approvedCost: cost,
        rejectionReason: null,
        isManualOverride: true,
        overrideReason: `Added dynamically by ${userName}`,
      },
    ];
    updateClaim(claim.id, { reconciliationItems: nextItems });
    setNewDesc('');
    setNewCost('');
    notify('New bill line item added.');
  };

  const handleOverrideFraud = (indicatorType: string) => {
    const nextInds = claim.fraudIndicators.map((ind) =>
      ind.type === indicatorType ? { ...ind, isOverridden: true, overrideReason: `Overridden by ${userName}` } : ind
    );
    const activeScore = Math.min(
      100,
      nextInds.filter((i) => !i.isOverridden).reduce((s, i) => s + i.riskContribution, 0)
    );
    const tier: FraudRiskTier =
      activeScore >= 70 ? 'CRITICAL' : activeScore >= 45 ? 'HIGH' : activeScore >= 20 ? 'MEDIUM' : 'LOW';
    updateClaim(claim.id, { fraudIndicators: nextInds, fraudScore: activeScore, riskTier: tier });
    notify(`Fraud flag ${indicatorType} overridden — new composite score: ${activeScore}.`);
  };

  const handleAddFraudIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = Number(newFlagPts) || 20;
    const nextInds = [
      ...claim.fraudIndicators,
      {
        id: `fi-${Date.now()}`,
        type: newFlagType,
        riskContribution: pts,
        evidenceMetadata: { addedBy: userName, note: 'Dynamic SIU risk flag' },
        isOverridden: false,
      },
    ];
    const activeScore = Math.min(
      100,
      nextInds.filter((i) => !i.isOverridden).reduce((s, i) => s + i.riskContribution, 0)
    );
    const tier: FraudRiskTier =
      activeScore >= 70 ? 'CRITICAL' : activeScore >= 45 ? 'HIGH' : activeScore >= 20 ? 'MEDIUM' : 'LOW';
    updateClaim(claim.id, { fraudIndicators: nextInds, fraudScore: activeScore, riskTier: tier });
    notify(`Added fraud flag ${newFlagType} (+${pts} pts).`);
  };

  const isSuperBypass = isSystemAdmin || bypassAllPermissions;
  const canUpdateClaims = hasPermission('claims:update');

  const damageColumns: GridColumn<DynamicDamageItem>[] = [
    {
      id: 'partType',
      header: 'Damaged Part',
      accessor: (d) => d.partType,
      summary: 'count',
      cell: (d) => <span className="font-mono font-bold text-foreground">{d.partType}</span>,
    },
    {
      id: 'materialType',
      header: 'Material',
      accessor: (d) => d.materialType,
      cell: (d) => <span className="font-mono text-primary">{d.materialType}</span>,
    },
    {
      id: 'severity',
      header: 'Severity',
      accessor: (d) => d.severity,
      cell: (d) => (
        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">{d.severity}</span>
      ),
    },
    {
      id: 'confidence',
      header: 'Confidence',
      align: 'right',
      accessor: (d) => Math.round(d.confidence * 100),
      cell: (d) => <span className="font-mono">{Math.round(d.confidence * 100)}%</span>,
    },
    {
      id: 'repairAction',
      header: 'Action',
      accessor: (d) => d.repairAction,
      cell: (d) => <span className="font-mono font-semibold">{d.repairAction}</span>,
    },
    {
      id: 'source',
      header: 'Source',
      align: 'center',
      accessor: (d) => (d.isManualAdded ? 'Manual' : 'AI Vision'),
      cell: (d) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            d.isManualAdded ? 'bg-indigo-500/15 text-indigo-400' : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          {d.isManualAdded ? 'Manual' : 'AI Vision'}
        </span>
      ),
    },
  ];

  const damageActions = (d: DynamicDamageItem): GridAction[] =>
    canUpdateClaims
      ? [
          {
            key: 'delete',
            label: 'Remove',
            title: 'Remove damage annotation',
            icon: Trash2,
            tone: 'danger',
            onClick: () => handleDeleteDamage(d.id),
          },
        ]
      : [];

  return (
    <RequirePageAccess permission="claims:read" title="Claim Dossier Workspace">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/claims" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Claims Queue
          </Link>
          {toast && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toast}</span>
            </div>
          )}
        </div>

        {/* Top Header Card */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-black tracking-tight text-foreground">{claim.claimNumber}</h1>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${CLAIM_STATUS_THEME[claim.status].badgeClass}`}>
                {CLAIM_STATUS_THEME[claim.status].label}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                v{claim.version} (OCC)
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Policy: {claim.policyNumber} | {claim.vehicle} | Deductible: ${claim.deductible.toFixed(2)}
            </p>
          </div>

          {/* Action Settlement Bar + Super Admin Force Override */}
          <div className="flex flex-wrap items-center gap-3">
            {isSuperBypass && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <select
                  value={claim.status}
                  onChange={(e) =>
                    handleStatusChange(
                      e.target.value as ClaimStatus,
                      'Super Admin Emergency FSM Override'
                    )
                  }
                  className="cursor-pointer bg-transparent text-xs font-bold text-amber-400 focus:outline-none"
                  title="Super Admin Force Status Override"
                >
                  <option value="DRAFT" className="bg-card text-foreground">Force: DRAFT</option>
                  <option value="SUBMITTED" className="bg-card text-foreground">Force: SUBMITTED</option>
                  <option value="TRIAGE_PENDING" className="bg-card text-foreground">Force: TRIAGE_PENDING</option>
                  <option value="MANUAL_REVIEW" className="bg-card text-foreground">Force: MANUAL_REVIEW</option>
                  <option value="APPROVED" className="bg-card text-foreground">Force: APPROVED</option>
                  <option value="SETTLED" className="bg-card text-foreground">Force: SETTLED</option>
                  <option value="REJECTED" className="bg-card text-foreground">Force: REJECTED</option>
                </select>
              </div>
            )}

            {(claim.status === 'TRIAGE_PENDING' || claim.status === 'MANUAL_REVIEW') && (
              <Can
                permission="claims:approve"
                fallback={
                  <span className="text-xs italic text-muted-foreground">
                    Approval rights required to authorize claim
                  </span>
                }
              >
                <button
                  onClick={() => handleStatusChange('APPROVED', 'Adjuster formal approval')}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-teal-700"
                >
                  Approve Assessment
                </button>
              </Can>
            )}

            {claim.status === 'APPROVED' && (
              <Can
                permission="claims:settle"
                fallback={
                  <span className="text-xs italic text-muted-foreground">
                    Finance controller settlement authority required
                  </span>
                }
              >
                <button
                  onClick={() => handleStatusChange('SETTLED', 'Disbursement voucher posted')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-emerald-700"
                >
                  Disburse Payout &amp; Post Ledger (${actuarial.netPayout.toFixed(2)})
                </button>
              </Can>
            )}

            {claim.status === 'SETTLED' && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-500">
                ✔ Balanced Ledger Vouchers Posted
              </div>
            )}
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="flex flex-wrap gap-6 border-b border-border text-xs font-semibold">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`border-b-2 pb-3 transition ${activeTab === 'evidence' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Visual Damage Canvas ({claim.damages.length})
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`border-b-2 pb-3 transition ${activeTab === 'reconciliation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Bill Reconciliation ({claim.reconciliationItems.length})
          </button>
          {canSeeFraud && (
            <button
              onClick={() => setActiveTab('fraud')}
              className={`border-b-2 pb-3 transition ${activeTab === 'fraud' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Fraud Scorecard ({claim.fraudScore}/100)
            </button>
          )}
          <button
            onClick={() => setActiveTab('actuarial')}
            className={`border-b-2 pb-3 transition ${activeTab === 'actuarial' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Actuarial Waterfall (${actuarial.netPayout.toFixed(2)})
          </button>
        </div>

        {/* Tab Panels */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <DamageCanvas
                  imageUrl="https://images.unsplash.com/photo-1590362891988-f77804703088?auto=format&fit=crop&w=1200&q=80"
                  damages={claim.damages}
                />
              </div>
              <div className="space-y-4">
                <CarWireframe damagedParts={claim.damages.map((d) => d.partType)} />
                <Can permission="claims:update">
                  <form onSubmit={handleAddDamage} className="space-y-2.5 rounded-xl border border-border bg-card p-4 text-xs">
                    <div className="font-bold text-foreground">Add Manual Damage Annotation</div>
                    <select value={newPart} onChange={(e) => setNewPart(e.target.value as VehiclePartType)} className="w-full rounded border border-border bg-background px-2.5 py-1.5">
                      <option value="HOOD_BONNET">HOOD_BONNET</option>
                      <option value="BUMPER_FRONT">BUMPER_FRONT</option>
                      <option value="BUMPER_REAR">BUMPER_REAR</option>
                      <option value="FENDER_LEFT">FENDER_LEFT</option>
                      <option value="DOOR_FRONT_LEFT">DOOR_FRONT_LEFT</option>
                      <option value="WINDSHIELD_FRONT">WINDSHIELD_FRONT</option>
                      <option value="HEADLIGHT_RIGHT">HEADLIGHT_RIGHT</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newMat} onChange={(e) => setNewMat(e.target.value as MaterialType)} className="rounded border border-border bg-background px-2 py-1.5">
                        <option value="METAL">METAL</option>
                        <option value="PLASTIC">PLASTIC</option>
                        <option value="GLASS">GLASS</option>
                      </select>
                      <select value={newSev} onChange={(e) => setNewSev(e.target.value as DamageSeverity)} className="rounded border border-border bg-background px-2 py-1.5">
                        <option value="SCRATCH">SCRATCH</option>
                        <option value="DENT">DENT</option>
                        <option value="SHATTERED">SHATTERED</option>
                      </select>
                    </div>
                    <button type="submit" className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-1.5 font-bold text-primary-foreground">
                      <Plus className="h-3.5 w-3.5" /> Add Damage Part
                    </button>
                  </form>
                </Can>
              </div>
            </div>

            <DataGrid<DynamicDamageItem>
              title="Detected Damage Inventory"
              subtitle="AI vision detections and adjuster manual annotations"
              data={claim.damages}
              columns={damageColumns}
              rowKey={(d) => d.id}
              actions={damageActions}
              compact
              pageSize={10}
              enableGrouping={false}
              exportFileName={`${claim.claimNumber}-damages`}
              emptyMessage="No damage annotations recorded on this claim."
            />
          </div>
        )}

        {activeTab === 'reconciliation' && (
          <div className="space-y-4">
            <Can permission="claims:override_reconciliation">
              <form onSubmit={handleAddReconciliationItem} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-xs">
                <input required placeholder="Add Garage Line Item Description..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5" />
                <input required type="number" step="0.01" placeholder="Cost ($)" value={newCost} onChange={(e) => setNewCost(e.target.value)} className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                <label className="flex items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={newIsLabor} onChange={(e) => setNewIsLabor(e.target.checked)} />
                  Labor
                </label>
                <button type="submit" className="flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 font-bold text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" /> Add Bill Item
                </button>
              </form>
            </Can>
            <ReconciliationTable
              items={claim.reconciliationItems}
              totalBilled={totalBilled}
              totalApproved={totalApproved}
              totalPhantom={totalPhantom}
              onOverrideItem={handleOverrideReconciliation}
            />
          </div>
        )}

        {activeTab === 'fraud' && canSeeFraud && (
          <div className="space-y-4">
            <Can permission="fraud:override">
              <form onSubmit={handleAddFraudIndicator} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-xs">
                <select value={newFlagType} onChange={(e) => setNewFlagType(e.target.value)} className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono">
                  <option value="EXIF_GPS_MISMATCH">EXIF_GPS_MISMATCH</option>
                  <option value="VECTOR_SIMILARITY_DUPLICATE">VECTOR_SIMILARITY_DUPLICATE</option>
                  <option value="DEVICE_CLOCK_TAMPERING">DEVICE_CLOCK_TAMPERING</option>
                  <option value="PHANTOM_ITEM_DETECTED">PHANTOM_ITEM_DETECTED</option>
                  <option value="EXCESSIVE_LABOR_ESTIMATE">EXCESSIVE_LABOR_ESTIMATE</option>
                </select>
                <input type="number" value={newFlagPts} onChange={(e) => setNewFlagPts(e.target.value)} placeholder="Points" className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                <button type="submit" className="flex items-center gap-1 rounded-lg bg-rose-600 px-3.5 py-1.5 font-bold text-white hover:bg-rose-700">
                  <Plus className="h-3.5 w-3.5" /> Add SIU Flag
                </button>
              </form>
            </Can>
            <FraudScorecardView
              scorecard={{
                compositeScore: claim.fraudScore,
                riskTier: claim.riskTier,
                indicators: claim.fraudIndicators,
              }}
              onOverrideIndicator={handleOverrideFraud}
            />
          </div>
        )}

        {activeTab === 'actuarial' && (
          <ActuarialWaterfall assessment={actuarial} coverageLimit={50000.0} />
        )}
      </div>
    </RequirePageAccess>
  );
}
