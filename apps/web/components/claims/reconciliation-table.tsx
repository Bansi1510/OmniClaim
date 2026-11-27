'use client';

import React from 'react';
import { ReconciledLineItemDto } from '@omniclaim/shared-types';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { usePermissions } from '@/hooks/use-permissions';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ReconciliationTableProps {
  items: ReconciledLineItemDto[];
  totalBilled: number;
  totalApproved: number;
  totalPhantom: number;
  onOverrideItem?: (itemId: string, approved: boolean) => void;
}

export function ReconciliationTable({
  items,
  totalBilled,
  totalApproved,
  totalPhantom,
  onOverrideItem,
}: ReconciliationTableProps) {
  const { hasPermission } = usePermissions();
  const canOverride = hasPermission('claims:override_reconciliation') && Boolean(onOverrideItem);

  const columns: GridColumn<ReconciledLineItemDto>[] = [
    {
      id: 'rawDescription',
      header: 'Billed Description',
      minWidth: 220,
      accessor: (i) => i.rawDescription,
      summary: 'count',
      cell: (item) => (
        <div>
          <span className="font-medium text-foreground">{item.rawDescription}</span>
          {item.isManualOverride && (
            <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
              OVERRIDDEN
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      filterOptions: [
        { label: 'Part', value: 'Part' },
        { label: 'Labor', value: 'Labor' },
      ],
      accessor: (i) => (i.isLabor ? 'Labor' : 'Part'),
      cell: (item) => <span className="text-muted-foreground">{item.isLabor ? 'Labor' : 'Part'}</span>,
    },
    {
      id: 'claimedCost',
      header: 'Claimed',
      align: 'right',
      accessor: (i) => i.claimedCost,
      summary: (rows) => (
        <span className="font-mono">${rows.reduce((s, r) => s + r.claimedCost, 0).toFixed(2)}</span>
      ),
      cell: (item) => <span className="font-mono font-medium">${item.claimedCost.toFixed(2)}</span>,
    },
    {
      id: 'matchedDamagePart',
      header: 'AI Damage Match',
      accessor: (i) => i.matchedDamagePart || 'None',
      cell: (item) =>
        item.matchedDamagePart ? (
          <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {item.matchedDamagePart}
          </span>
        ) : (
          <span className="italic text-muted-foreground">None (No Damage Detected)</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      filterOptions: [
        { label: 'Verified', value: 'Verified' },
        { label: 'Phantom', value: 'Phantom' },
      ],
      accessor: (i) => (i.isVerifiedByDamage ? 'Verified' : 'Phantom'),
      cell: (item) =>
        item.isVerifiedByDamage ? (
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500">
            ✔ Verified
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-500">
            ⚠ Phantom
          </span>
        ),
    },
    {
      id: 'systemDeduction',
      header: 'Deduction',
      align: 'right',
      accessor: (i) => i.systemDeduction,
      summary: (rows) => (
        <span className="font-mono text-rose-500">
          -${rows.reduce((s, r) => s + r.systemDeduction, 0).toFixed(2)}
        </span>
      ),
      cell: (item) => (
        <span className="font-mono font-semibold text-rose-500">
          {item.systemDeduction > 0 ? `-$${item.systemDeduction.toFixed(2)}` : '$0.00'}
        </span>
      ),
    },
    {
      id: 'approvedCost',
      header: 'Approved',
      align: 'right',
      accessor: (i) => i.approvedCost,
      summary: (rows) => (
        <span className="font-mono text-emerald-500">
          ${rows.reduce((s, r) => s + r.approvedCost, 0).toFixed(2)}
        </span>
      ),
      cell: (item) => (
        <span className="font-mono font-bold text-emerald-500">${item.approvedCost.toFixed(2)}</span>
      ),
    },
  ];

  const rowActions = (item: ReconciledLineItemDto): GridAction[] =>
    canOverride
      ? [
          {
            key: item.isVerifiedByDamage ? 'reject' : 'approve',
            label: item.isVerifiedByDamage ? 'Mark Phantom' : 'Approve Item',
            icon: item.isVerifiedByDamage ? XCircle : CheckCircle2,
            tone: item.isVerifiedByDamage ? 'danger' : 'success',
            onClick: () => onOverrideItem!(item.id, !item.isVerifiedByDamage),
          },
        ]
      : [];

  return (
    <DataGrid<ReconciledLineItemDto>
      title="Bill Reconciliation & Phantom Item Diff"
      subtitle="Comparing garage invoice line items against AI-detected visual damage"
      data={items}
      columns={columns}
      rowKey={(i) => i.id}
      actions={rowActions}
      compact
      pageSize={10}
      exportFileName="claim-reconciliation"
      rowClassName={(item) => (!item.isVerifiedByDamage ? 'bg-rose-500/5' : undefined)}
      emptyMessage="No garage invoice line items on this claim."
      toolbar={
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <div className="rounded-md bg-muted px-2.5 py-1">
            Billed: <span className="font-bold text-foreground">${totalBilled.toFixed(2)}</span>
          </div>
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-500">
            Approved: ${totalApproved.toFixed(2)}
          </div>
          {totalPhantom > 0 && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 font-bold text-rose-500">
              Phantom: -${totalPhantom.toFixed(2)}
            </div>
          )}
        </div>
      }
    />
  );
}
