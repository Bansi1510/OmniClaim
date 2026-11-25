'use client';

import React from 'react';
import { FraudScorecardDto } from '@omniclaim/shared-types';
import { FRAUD_RISK_THEME } from '@/lib/theme-constants';

interface FraudScorecardProps {
  scorecard: FraudScorecardDto;
  onOverrideIndicator?: (indicatorType: string) => void;
}

export function FraudScorecardView({ scorecard, onOverrideIndicator }: FraudScorecardProps) {
  const riskTheme = FRAUD_RISK_THEME[scorecard.riskTier] || {
    label: scorecard.riskTier,
    badgeClass: 'bg-muted text-muted-foreground',
    bgClass: 'bg-muted',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-base">Multi-Factor Fraud Risk Engine</h3>
          <p className="text-xs text-muted-foreground">Geospatial telemetry, mock location & pgvector visual similarity</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-bold ${riskTheme.badgeClass}`}>
          {riskTheme.label}
        </div>
      </div>

      {/* Radial / Bar Risk Gauge */}
      <div className="my-5 flex items-center justify-between gap-6 rounded-lg bg-muted/40 p-4 border border-border/50">
        <div>
          <div className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {scorecard.compositeScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
          </div>
          <span className="text-xs text-muted-foreground">Composite Multi-Factor Risk Score</span>
        </div>
        <div className="w-1/2">
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${riskTheme.bgClass}`}
              style={{ width: `${Math.min(100, scorecard.compositeScore)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Triggered Indicator Flags List */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Triggered Risk Indicators:</span>
        {scorecard.indicators.length === 0 ? (
          <p className="text-xs text-emerald-500 font-medium">✔ No fraud anomalies detected. Clean submission.</p>
        ) : (
          scorecard.indicators.map((ind, idx) => (
            <div
              key={idx}
              className={`flex items-start justify-between rounded-lg border p-3 text-xs ${
                ind.isOverridden
                  ? 'border-border/40 bg-muted/20 opacity-60'
                  : 'border-rose-500/20 bg-rose-500/5'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{ind.type}</span>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 font-mono">
                    +{ind.riskContribution} pts
                  </span>
                  {ind.isOverridden && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                      OVERRIDDEN
                    </span>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground font-mono text-[11px]">
                  {JSON.stringify(ind.evidenceMetadata)}
                </p>
              </div>
              {!ind.isOverridden && onOverrideIndicator && (
                <button
                  onClick={() => onOverrideIndicator(ind.type)}
                  className="rounded border border-border bg-secondary px-2 py-1 text-[11px] font-medium hover:bg-secondary/80 transition"
                >
                  Override Flag
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
