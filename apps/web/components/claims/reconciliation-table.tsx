'use client';

import React from 'react';
import { ReconciledLineItemDto } from '@omniclaim/shared-types';

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
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-base">Bill Reconciliation & Phantom Item Diff</h3>
          <p className="text-xs text-muted-foreground">
            Comparing garage invoice line items against AI-detected visual damage
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="rounded-md bg-muted px-3 py-1">
            Billed: <span className="font-bold text-foreground">${totalBilled.toFixed(2)}</span>
          </div>
          <div className="rounded-md bg-emerald-500/10 px-3 py-1 text-emerald-500 font-bold border border-emerald-500/20">
            Approved: ${totalApproved.toFixed(2)}
          </div>
          {totalPhantom > 0 && (
            <div className="rounded-md bg-rose-500/10 px-3 py-1 text-rose-500 font-bold border border-rose-500/20 animate-pulse">
              Phantom Deduction: -${totalPhantom.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pt-3">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase">
              <th className="py-2.5 px-3">Billed Description</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Claimed</th>
              <th className="py-2.5 px-3">AI Damage Match</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Deduction</th>
              <th className="py-2.5 px-3">Approved</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item) => (
              <tr
                key={item.id}
                className={`hover:bg-muted/30 transition ${
                  !item.isVerifiedByDamage ? 'bg-rose-500/5' : ''
                }`}
              >
                <td className="py-3 px-3 font-medium text-foreground">
                  {item.rawDescription}
                  {item.isManualOverride && (
                    <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-500 font-semibold">
                      OVERRIDDEN
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-xs text-muted-foreground">
                  {item.isLabor ? 'Labor' : 'Part'}
                </td>
                <td className="py-3 px-3 font-mono font-medium">${item.claimedCost.toFixed(2)}</td>
                <td className="py-3 px-3 text-xs">
                  {item.matchedDamagePart ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {item.matchedDamagePart}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">None (No Damage Detected)</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  {item.isVerifiedByDamage ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                      ✔ Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500 border border-rose-500/20">
                      ⚠ Phantom
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 font-mono text-xs text-rose-500 font-semibold">
                  {item.systemDeduction > 0 ? `-$${item.systemDeduction.toFixed(2)}` : '$0.00'}
                </td>
                <td className="py-3 px-3 font-mono text-xs text-emerald-500 font-bold">
                  ${item.approvedCost.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => onOverrideItem?.(item.id, !item.isVerifiedByDamage)}
                    className="rounded border border-border bg-secondary/80 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition"
                  >
                    {item.isVerifiedByDamage ? 'Mark Phantom' : 'Approve Item'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
