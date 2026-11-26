'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { DamageCanvas } from '@/components/claims/damage-canvas';
import { CarWireframe } from '@/components/claims/car-wireframe';
import { ReconciliationTable } from '@/components/claims/reconciliation-table';
import { ActuarialWaterfall } from '@/components/claims/actuarial-waterfall';
import { FraudScorecardView } from '@/components/claims/fraud-scorecard';
import { CLAIM_STATUS_THEME } from '@/lib/theme-constants';
import { VehiclePartType, MaterialType, DamageSeverity, ClaimStatus, FraudRiskTier } from '@omniclaim/shared-types';
import { Can } from '@/components/auth/can';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import { Plus, Trash2, Crown, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function AdjusterWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const { isSystemAdmin, isMasterLogin, bypassAllPermissions, userName, userEmail } = usePermissions();
  const { claims, updateClaim, appendFieldAudit, addJournalEntry } = useDynamicStore();

  const claim = useMemo(
    () => claims.find((c) => c.id === unwrappedParams.id) || claims[0],
    [claims, unwrappedParams.id]
  );

  const [activeTab, setActiveTab] = useState<'evidence' | 'reconciliation' | 'fraud' | 'actuarial'>('evidence');
  const [toast, setToast] = useState<string | null>(null);

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
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Claim not found.</p>
        <Link href="/claims" className="text-xs text-primary underline mt-2 inline-block">
          Back to Claims Queue
        </Link>
      </div>
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

  const isSuperBypass = isSystemAdmin || isMasterLogin || bypassAllPermissions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/claims" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Claims Queue
        </Link>
        {toast && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{toast}</span>
          </div>
        )}
      </div>

      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black font-mono tracking-tight text-foreground">{claim.claimNumber}</h1>
            <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${CLAIM_STATUS_THEME[claim.status].badgeClass}`}>
              {CLAIM_STATUS_THEME[claim.status].label}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              v{claim.version} (OCC)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
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
                className="bg-transparent text-amber-400 font-bold text-xs focus:outline-none cursor-pointer"
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
                <span className="text-xs text-muted-foreground italic">
                  Approval rights required to authorize claim
                </span>
              }
            >
              <button
                onClick={() => handleStatusChange('APPROVED', 'Adjuster formal approval')}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs font-bold shadow transition"
              >
                Approve Assessment
              </button>
            </Can>
          )}

          {claim.status === 'APPROVED' && (
            <Can
              permission="claims:settle"
              fallback={
                <span className="text-xs text-muted-foreground italic">
                  Finance controller settlement authority required
                </span>
              }
            >
              <button
                onClick={() => handleStatusChange('SETTLED', 'Disbursement voucher posted')}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow transition"
              >
                Disburse Payout &amp; Post Ledger (${actuarial.netPayout.toFixed(2)})
              </button>
            </Can>
          )}

          {claim.status === 'SETTLED' && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-500">
              ✔ Balanced Ledger Vouchers Posted
            </div>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap border-b border-border text-xs font-semibold gap-6">
        <button onClick={() => setActiveTab('evidence')} className={`pb-3 border-b-2 transition ${activeTab === 'evidence' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Visual Damage Canvas ({claim.damages.length})
        </button>
        <button onClick={() => setActiveTab('reconciliation')} className={`pb-3 border-b-2 transition ${activeTab === 'reconciliation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Bill Reconciliation ({claim.reconciliationItems.length})
        </button>
        <button onClick={() => setActiveTab('fraud')} className={`pb-3 border-b-2 transition ${activeTab === 'fraud' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Fraud Scorecard ({claim.fraudScore}/100)
        </button>
        <button onClick={() => setActiveTab('actuarial')} className={`pb-3 border-b-2 transition ${activeTab === 'actuarial' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Actuarial Waterfall (${actuarial.netPayout.toFixed(2)})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <DamageCanvas
                imageUrl="https://images.unsplash.com/photo-1590362891988-f77804703088?auto=format&fit=crop&w=1200&q=80"
                damages={claim.damages}
              />
            </div>
            <div className="space-y-4">
              <CarWireframe damagedParts={claim.damages.map((d) => d.partType)} />
              <Can permission="claims:update">
                <form onSubmit={handleAddDamage} className="rounded-xl border border-border bg-card p-4 space-y-2.5 text-xs">
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
                  <button type="submit" className="w-full rounded-lg bg-primary text-primary-foreground py-1.5 font-bold flex items-center justify-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add Damage Part
                  </button>
                  {claim.damages.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1">
                      {claim.damages.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-[11px]">
                          <span className="font-mono">{d.partType} ({d.severity})</span>
                          <button type="button" onClick={() => handleDeleteDamage(d.id)} className="text-rose-500 p-0.5 hover:bg-rose-500/10 rounded">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              </Can>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <Can permission="claims:override_reconciliation">
            <form onSubmit={handleAddReconciliationItem} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3 text-xs">
              <input required placeholder="Add Garage Line Item Description..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-1.5" />
              <input required type="number" step="0.01" placeholder="Cost ($)" value={newCost} onChange={(e) => setNewCost(e.target.value)} className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
              <label className="flex items-center gap-1.5 font-semibold">
                <input type="checkbox" checked={newIsLabor} onChange={(e) => setNewIsLabor(e.target.checked)} />
                Labor
              </label>
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-3.5 py-1.5 font-bold flex items-center gap-1">
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

      {activeTab === 'fraud' && (
        <div className="space-y-4">
          <Can permission="fraud:override">
            <form onSubmit={handleAddFraudIndicator} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3 text-xs">
              <select value={newFlagType} onChange={(e) => setNewFlagType(e.target.value)} className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-1.5 font-mono">
                <option value="EXIF_GPS_MISMATCH">EXIF_GPS_MISMATCH</option>
                <option value="VECTOR_SIMILARITY_DUPLICATE">VECTOR_SIMILARITY_DUPLICATE</option>
                <option value="DEVICE_CLOCK_TAMPERING">DEVICE_CLOCK_TAMPERING</option>
                <option value="PHANTOM_ITEM_DETECTED">PHANTOM_ITEM_DETECTED</option>
                <option value="EXCESSIVE_LABOR_ESTIMATE">EXCESSIVE_LABOR_ESTIMATE</option>
              </select>
              <input type="number" value={newFlagPts} onChange={(e) => setNewFlagPts(e.target.value)} placeholder="Points" className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
              <button type="submit" className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 font-bold flex items-center gap-1">
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
  );
}
