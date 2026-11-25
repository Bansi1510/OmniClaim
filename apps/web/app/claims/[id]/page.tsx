'use client';

import React, { useState } from 'react';
import { DamageCanvas } from '@/components/claims/damage-canvas';
import { CarWireframe } from '@/components/claims/car-wireframe';
import { ReconciliationTable } from '@/components/claims/reconciliation-table';
import { ActuarialWaterfall } from '@/components/claims/actuarial-waterfall';
import { FraudScorecardView } from '@/components/claims/fraud-scorecard';
import { CLAIM_STATUS_THEME } from '@/lib/theme-constants';
import { VehiclePartType, ClaimStatus } from '@omniclaim/shared-types';
import { Can } from '@/components/auth/can';

export default function AdjusterWorkspacePage({ params }: { params: { id: string } }) {
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('TRIAGE_PENDING');
  const [version, setVersion] = useState(1);
  const [activeTab, setActiveTab] = useState<'evidence' | 'reconciliation' | 'fraud' | 'actuarial'>('evidence');

  // Sample multi-modal claim data
  const [damages, setDamages] = useState([
    {
      id: 'dmg-1',
      evidenceId: 'ev-1',
      partType: 'BUMPER_FRONT' as VehiclePartType,
      materialType: 'PLASTIC' as const,
      severity: 'DENT' as const,
      confidence: 0.94,
      boundingBox: { xmin: 0.18, ymin: 0.48, xmax: 0.82, ymax: 0.90 },
      repairAction: 'REPLACE' as const,
    },
    {
      id: 'dmg-2',
      evidenceId: 'ev-1',
      partType: 'HEADLIGHT_LEFT' as VehiclePartType,
      materialType: 'GLASS' as const,
      severity: 'SHATTERED' as const,
      confidence: 0.88,
      boundingBox: { xmin: 0.22, ymin: 0.38, xmax: 0.38, ymax: 0.52 },
      repairAction: 'REPLACE' as const,
    },
  ]);

  const [reconciliationItems, setReconciliationItems] = useState([
    {
      id: 'rec-1',
      billLineItemId: 'bli-1',
      rawDescription: 'OEM Front Bumper Assembly Replacement',
      claimedCost: 450.00,
      isLabor: false,
      isVerifiedByDamage: true,
      matchedDamagePart: 'BUMPER_FRONT' as VehiclePartType,
      systemDeduction: 0,
      approvedCost: 450.00,
      rejectionReason: null,
      isManualOverride: false,
      overrideReason: null,
    },
    {
      id: 'rec-2',
      billLineItemId: 'bli-2',
      rawDescription: 'Body Panel Paint & Refinish Labor 2.5 hrs',
      claimedCost: 225.00,
      isLabor: true,
      isVerifiedByDamage: true,
      matchedDamagePart: null,
      systemDeduction: 0,
      approvedCost: 225.00,
      rejectionReason: null,
      isManualOverride: false,
      overrideReason: null,
    },
    {
      id: 'rec-3',
      billLineItemId: 'bli-3',
      rawDescription: 'Rear Bumper Impact Reinforcement Bar',
      claimedCost: 180.00,
      isLabor: false,
      isVerifiedByDamage: false, // Phantom Item!
      matchedDamagePart: null,
      systemDeduction: 180.00,
      approvedCost: 0,
      rejectionReason: 'Phantom charge: No damage detected on rear bumper',
      isManualOverride: false,
      overrideReason: null,
    },
  ]);

  const fraudScorecard = {
    compositeScore: 25,
    riskTier: 'MEDIUM' as const,
    indicators: [
      {
        type: 'EXIF_GPS_MISMATCH',
        riskContribution: 25,
        evidenceMetadata: { distanceMeters: 1820, reason: 'Device EXIF GPS is 1.8km from claimed accident location' },
        isOverridden: false,
      },
    ],
  };

  const actuarial = {
    grossPartsTotal: 450.00,
    metalDepreciation: 0,
    plasticDepreciation: 225.00, // 50% on front bumper
    glassDepreciation: 0,
    totalDepreciation: 225.00,
    totalLaborApproved: 225.00,
    applicableDeductible: 500.00,
    salvageValue: 0,
    netPayout: 675.00,
    isStpQualified: true,
  };

  const handleApprove = () => {
    setClaimStatus('APPROVED');
    setVersion((v) => v + 1);
  };

  const handleSettle = () => {
    setClaimStatus('SETTLED');
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black font-mono tracking-tight text-foreground">CLM-202611-9102</h1>
            <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${CLAIM_STATUS_THEME[claimStatus].badgeClass}`}>
              {CLAIM_STATUS_THEME[claimStatus].label}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              v{version} (Optimistic OCC)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Policy: POL-OMNI-2026-9081 | 2022 Honda Accord Touring | VIN: 1HGCR2F83HA001928 | Deductible: $500.00
          </p>
        </div>

        {/* Action Settlement Bar with Granular RBAC Permissions Gating */}
        <div className="flex items-center gap-3">
          {claimStatus === 'TRIAGE_PENDING' && (
            <Can
              permission="claims:approve"
              fallback={
                <span className="text-xs text-muted-foreground italic">
                  Approval rights required to authorize claim
                </span>
              }
            >
              <button
                onClick={handleApprove}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs font-bold shadow transition"
              >
                Approve Assessment
              </button>
            </Can>
          )}

          {claimStatus === 'APPROVED' && (
            <Can
              permission="claims:settle"
              fallback={
                <span className="text-xs text-muted-foreground italic">
                  Finance controller settlement authority required
                </span>
              }
            >
              <button
                onClick={handleSettle}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span>Disburse Payout & Post Ledger ($675.00)</span>
              </button>
            </Can>
          )}

          {claimStatus === 'SETTLED' && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-500">
              ✔ Balanced Ledger Vouchers Posted (VCHR-2026-91823)
            </div>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-border text-xs font-semibold gap-6">
        <button
          onClick={() => setActiveTab('evidence')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'evidence' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Visual Damage Canvas & Schematic
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'reconciliation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Bill Reconciliation (Phantom Diff)
        </button>
        <button
          onClick={() => setActiveTab('fraud')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'fraud' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Fraud Risk Scorecard & Telemetry
        </button>
        <button
          onClick={() => setActiveTab('actuarial')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'actuarial' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Actuarial Math Waterfall
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <DamageCanvas
              imageUrl="https://images.unsplash.com/photo-1590362891988-f77804703088?auto=format&fit=crop&w=1200&q=80"
              damages={damages}
            />
          </div>
          <div>
            <CarWireframe damagedParts={damages.map((d) => d.partType)} />
          </div>
        </div>
      )}

      {activeTab === 'reconciliation' && (
        <ReconciliationTable
          items={reconciliationItems}
          totalBilled={855.00}
          totalApproved={675.00}
          totalPhantom={180.00}
        />
      )}

      {activeTab === 'fraud' && (
        <FraudScorecardView scorecard={fraudScorecard} />
      )}

      {activeTab === 'actuarial' && (
        <ActuarialWaterfall assessment={actuarial} coverageLimit={50000.00} />
      )}
    </div>
  );
}
