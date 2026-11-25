'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { BookOpen, DollarSign, Download, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Can } from '@/components/auth/can';
import { usePermissions } from '@/hooks/use-permissions';

interface JournalEntry {
  id: string;
  voucherNumber: string;
  date: string;
  claimNumber: string;
  account: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
  isReconciled: boolean;
}

const MOCK_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'je-1',
    voucherNumber: 'VCHR-2026-91823',
    date: '2026-11-24 16:45',
    claimNumber: 'CLM-202611-9102',
    account: 'Claims Incurred Losses (Expense)',
    entryType: 'DEBIT',
    amount: 675.00,
    description: 'Statutory net payout approved for 2022 Honda Accord claim',
    isReconciled: true,
  },
  {
    id: 'je-2',
    voucherNumber: 'VCHR-2026-91823',
    date: '2026-11-24 16:45',
    claimNumber: 'CLM-202611-9102',
    account: 'Settlement Disbursement Clearing (Cash)',
    entryType: 'CREDIT',
    amount: 675.00,
    description: 'ACH direct payout disbursement voucher to insured claimant',
    isReconciled: true,
  },
  {
    id: 'je-3',
    voucherNumber: 'VCHR-2026-88102',
    date: '2026-11-23 10:12',
    claimNumber: 'CLM-202611-8401',
    account: 'Claims Incurred Losses (Expense)',
    entryType: 'DEBIT',
    amount: 520.00,
    description: 'Autonomous STP fast-track minor settlement (bumper & reflector)',
    isReconciled: true,
  },
  {
    id: 'je-4',
    voucherNumber: 'VCHR-2026-88102',
    date: '2026-11-23 10:12',
    claimNumber: 'CLM-202611-8401',
    account: 'Settlement Disbursement Clearing (Cash)',
    entryType: 'CREDIT',
    amount: 520.00,
    description: 'Real-time card push transfer to policyholder wallet',
    isReconciled: true,
  },
];

export default function FinancialLedgerPage() {
  const { isSystemAdmin, hasPermission } = usePermissions();
  const [entries, setEntries] = useState<JournalEntry[]>(MOCK_JOURNAL_ENTRIES);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [claimNum, setClaimNum] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('Claims Incurred Losses (Expense)');
  const [entryType, setEntryType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [desc, setDesc] = useState('');

  const totalDebits = entries
    .filter((e) => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCredits = entries
    .filter((e) => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    const newEntry: JournalEntry = {
      id: `je-${Date.now()}`,
      voucherNumber: `VCHR-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      claimNumber: claimNum || 'MANUAL-ADJ',
      account,
      entryType,
      amount: val,
      description: desc || 'Manual ledger adjustment authorized by controller',
      isReconciled: false,
    };

    setEntries((prev) => [newEntry, ...prev]);
    showToast(`Manual voucher ${newEntry.voucherNumber} posted.`);
    setShowVoucherModal(false);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        title="Double-Entry Financial Ledger"
        items={[{ label: 'Financial' }, { label: 'General Ledger' }]}
      />

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold">Total Debits</span>
          <div className="text-2xl font-black font-mono text-foreground mt-1">
            ${totalDebits.toFixed(2)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Incurred claim loss expenses</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold">Total Credits</span>
          <div className="text-2xl font-black font-mono text-foreground mt-1">
            ${totalCredits.toFixed(2)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Settlement payouts disbursed</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold">Ledger Invariant Status</span>
          <div className="flex items-center gap-2 mt-1">
            {isBalanced ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-lg font-bold text-emerald-500 font-mono">Balanced ($0.00 Diff)</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-rose-500" />
                <span className="text-lg font-bold text-rose-500 font-mono">
                  Unbalanced (${Math.abs(totalDebits - totalCredits).toFixed(2)})
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Strict double-entry mathematical invariant
          </span>
        </div>
      </div>

      {/* Action Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">General Journal Entries</h2>
          <p className="text-xs text-muted-foreground">
            Immutable settlement disbursement vouchers and insurance reserves
          </p>
        </div>

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Export Statement Button - Gated by reports:export */}
          <Can permission="reports:export">
            <button
              onClick={() => showToast('Exporting GAAP statement as Excel workbook...')}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export GAAP</span>
            </button>
          </Can>

          {/* Manual Voucher Button - Gated by ledger:override */}
          <Can permission="ledger:override">
            <button
              onClick={() => setShowVoucherModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-semibold shadow transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Manual Voucher</span>
            </button>
          </Can>
        </div>
      </div>

      {/* Table of Journal Entries */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">Voucher & Date</th>
              <th className="py-3 px-4">Claim Reference</th>
              <th className="py-3 px-4">Account Designation</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-right">Debit ($)</th>
              <th className="py-3 px-4 text-right">Credit ($)</th>
              <th className="py-3 px-4 text-center">Reconciled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/20 transition">
                <td className="py-3.5 px-4 font-mono">
                  <span className="font-bold text-foreground block">{entry.voucherNumber}</span>
                  <span className="text-[11px] text-muted-foreground">{entry.date}</span>
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-primary">
                  {entry.claimNumber}
                </td>
                <td className="py-3.5 px-4 font-medium text-foreground">
                  {entry.account}
                </td>
                <td className="py-3.5 px-4 text-muted-foreground max-w-xs">
                  {entry.description}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                  {entry.entryType === 'DEBIT' ? `$${entry.amount.toFixed(2)}` : '—'}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                  {entry.entryType === 'CREDIT' ? `$${entry.amount.toFixed(2)}` : '—'}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      entry.isReconciled
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}
                  >
                    {entry.isReconciled ? 'Reconciled' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manual Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-1">Post Manual Adjustment Voucher</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Restricted controller action: manual debit or credit adjustments to the general ledger.
            </p>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Claim Reference #
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLM-202611-9102"
                  value={claimNum}
                  onChange={(e) => setClaimNum(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Entry Type
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="DEBIT">Debit (Expense)</option>
                    <option value="CREDIT">Credit (Disbursement)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Amount ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Account
                </label>
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Claims Incurred Losses (Expense)">Claims Incurred Losses (Expense)</option>
                  <option value="Settlement Disbursement Clearing (Cash)">Settlement Disbursement Clearing (Cash)</option>
                  <option value="Salvage Recovery Receivable">Salvage Recovery Receivable</option>
                  <option value="Subrogation Recovery Account">Subrogation Recovery Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Audit Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for manual journal adjustment..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-1.5 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 text-xs font-semibold shadow transition"
                >
                  Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
