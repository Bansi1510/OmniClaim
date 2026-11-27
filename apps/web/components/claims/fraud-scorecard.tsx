'use client';

import React from 'react';
import { FraudScorecardDto } from '@omniclaim/shared-types';
import { FRAUD_RISK_THEME } from '@/lib/theme-constants';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { usePermissions } from '@/hooks/use-permissions';
import { ShieldOff } from 'lucide-react';

type FraudIndicatorRow = FraudScorecardDto['indicators'][number];

interface FraudScorecardProps {
  scorecard: FraudScorecardDto;
  onOverrideIndicator?: (indicatorType: string) => void;
}

export function FraudScorecardView({ scorecard, onOverrideIndicator }: FraudScorecardProps) {
  const { hasPermission } = usePermissions();
  const canOverride = hasPermission('fraud:override') && Boolean(onOverrideIndicator);

  const riskTheme = FRAUD_RISK_THEME[scorecard.riskTier] || {
    label: scorecard.riskTier,
    badgeClass: 'bg-muted text-muted-foreground',
    bgClass: 'bg-muted',
  };

  const columns: GridColumn<FraudIndicatorRow>[] = [
    {
      id: 'type',
      header: 'Risk Indicator',
      minWidth: 200,
      accessor: (i) => i.type,
      summary: 'count',
      cell: (ind) => <span className="font-mono font-semibold text-foreground">{ind.type}</span>,
    },
    {
      id: 'riskContribution',
      header: 'Risk Pts',
      align: 'right',
      accessor: (i) => i.riskContribution,
      summary: (rows) => (
        <span className="font-mono text-rose-400">
          +{rows.filter((r) => !r.isOverridden).reduce((s, r) => s + r.riskContribution, 0)} active pts
        </span>
      ),
      cell: (ind) => (
        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-400">
          +{ind.riskContribution} pts
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      filterOptions: [
        { label: 'Active', value: 'Active' },
        { label: 'Overridden', value: 'Overridden' },
      ],
      accessor: (i) => (i.isOverridden ? 'Overridden' : 'Active'),
      cell: (ind) =>
        ind.isOverridden ? (
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
            OVERRIDDEN
          </span>
        ) : (
          <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
            ACTIVE FLAG
          </span>
        ),
    },
    {
      id: 'evidenceMetadata',
      header: 'Evidence Metadata',
      minWidth: 260,
      accessor: (i) => JSON.stringify(i.evidenceMetadata),
      cell: (ind) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {JSON.stringify(ind.evidenceMetadata)}
        </span>
      ),
    },
  ];

  const rowActions = (ind: FraudIndicatorRow): GridAction[] =>
    canOverride && !ind.isOverridden
      ? [
          {
            key: 'override',
            label: 'Override Flag',
            icon: ShieldOff,
            tone: 'warning',
            onClick: () => onOverrideIndicator!(ind.type),
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Multi-Factor Fraud Risk Engine</h3>
            <p className="text-xs text-muted-foreground">
              Geospatial telemetry, mock location &amp; pgvector visual similarity
            </p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-bold ${riskTheme.badgeClass}`}>
            {riskTheme.label}
          </div>
        </div>

        {/* Radial / Bar Risk Gauge */}
        <div className="mt-4 flex items-center justify-between gap-6 rounded-lg border border-border/50 bg-muted/40 p-4">
          <div>
            <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
              {scorecard.compositeScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
            </div>
            <span className="text-xs text-muted-foreground">Composite Multi-Factor Risk Score</span>
          </div>
          <div className="w-1/2">
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-500 ${riskTheme.bgClass}`}
                style={{ width: `${Math.min(100, scorecard.compositeScore)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <DataGrid<FraudIndicatorRow>
        title="Triggered Risk Indicators"
        subtitle="Role-wise SIU audit indicators and override controls"
        data={scorecard.indicators}
        columns={columns}
        rowKey={(ind) => `${ind.type}-${ind.riskContribution}-${ind.isOverridden ? '1' : '0'}`}
        actions={rowActions}
        compact
        pageSize={10}
        enableGrouping={false}
        exportFileName="fraud-indicators"
        rowClassName={(ind) => (ind.isOverridden ? 'opacity-60' : 'bg-rose-500/5')}
        emptyMessage="✔ No fraud anomalies detected. Clean submission."
      />
    </div>
  );
}
