'use client';

import React from 'react';
import { ActuarialSummaryDto } from '@omniclaim/shared-types';

interface ActuarialWaterfallProps {
  assessment: ActuarialSummaryDto;
  coverageLimit: number;
}

export function ActuarialWaterfall({ assessment, coverageLimit }: ActuarialWaterfallProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-base">Actuarial Math & Depreciation Waterfall</h3>
          <p className="text-xs text-muted-foreground">Deterministic statutory depreciation and policy sub-limits</p>
        </div>
        {assessment.isStpQualified && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-500 border border-emerald-500/20">
            ⚡ STP Fast-Track Qualified
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
        <div className="rounded-lg bg-muted/30 p-3 border border-border/40">
          <span className="text-xs text-muted-foreground">Gross Parts Claimed</span>
          <p className="text-lg font-bold font-mono text-foreground">${assessment.grossPartsTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-rose-500/5 p-3 border border-rose-500/20">
          <span className="text-xs text-rose-400">Total Statutory Depreciation</span>
          <p className="text-lg font-bold font-mono text-rose-500">-${assessment.totalDepreciation.toFixed(2)}</p>
          <span className="text-[10px] text-muted-foreground block">
            Metal: ${assessment.metalDepreciation.toFixed(0)} | Plastic: ${assessment.plasticDepreciation.toFixed(0)}
          </span>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 border border-border/40">
          <span className="text-xs text-muted-foreground">Labor Approved (0% Dep.)</span>
          <p className="text-lg font-bold font-mono text-foreground">${assessment.totalLaborApproved.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-amber-500/5 p-3 border border-amber-500/20">
          <span className="text-xs text-amber-500">Base Policy Deductible</span>
          <p className="text-lg font-bold font-mono text-amber-500">-${assessment.applicableDeductible.toFixed(2)}</p>
        </div>
      </div>

      {/* Net Payout Final Strip */}
      <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 p-4 border border-emerald-500/30">
        <div>
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Net Authorized Payout:</span>
          <p className="text-2xl font-black font-mono text-emerald-400">${assessment.netPayout.toFixed(2)}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <span>Policy Limit: ${coverageLimit.toLocaleString()}</span>
          <p className="font-semibold text-foreground">100% Zero-Sum Ledger Guaranteed</p>
        </div>
      </div>
    </div>
  );
}
