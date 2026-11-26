'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { Download, Plus, CheckCircle2, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { Can } from '@/components/auth/can';
import { useDynamicStore, DynamicJournalEntry, DynamicLedgerAccount } from '@/hooks/use-dynamic-store';

export default function FinancialLedgerPage() {
  const {
    journalEntries,
    ledgerAccounts,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    addLedgerAccount,
    updateLedgerAccount,
    deleteLedgerAccount,
  } = useDynamicStore();

  const [activeTab, setActiveTab] = useState<'journals' | 'accounts'>('journals');
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DynamicJournalEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Journal Form
  const [claimNum, setClaimNum] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('Claims Incurred Losses (Expense)');
  const [entryType, setEntryType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [desc, setDesc] = useState('');

  // Account Form
  const [acctNum, setAcctNum] = useState('');
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState<DynamicLedgerAccount['type']>('ASSET');

  const totalDebits = journalEntries
    .filter((e) => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCredits = journalEntries
    .filter((e) => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAddVoucher = () => {
    setEditingEntry(null);
    setClaimNum('');
    setAmount('');
    setAccount(ledgerAccounts[0]?.name || 'Claims Incurred Losses (Expense)');
    setEntryType('DEBIT');
    setDesc('');
    setShowVoucherModal(true);
  };

  const handleOpenEditVoucher = (entry: DynamicJournalEntry) => {
    setEditingEntry(entry);
    setClaimNum(entry.claimNumber);
    setAmount(String(entry.amount));
    setAccount(entry.account);
    setEntryType(entry.entryType);
    setDesc(entry.description);
    setShowVoucherModal(true);
  };

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    if (editingEntry) {
      updateJournalEntry(editingEntry.id, {
        claimNumber: claimNum || 'MANUAL-ADJ',
        account,
        entryType,
        amount: val,
        description: desc,
      });
      showToast(`Voucher ${editingEntry.voucherNumber} updated.`);
    } else {
      const vchr = `VCHR-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      addJournalEntry({
        voucherNumber: vchr,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        claimNumber: claimNum || 'MANUAL-ADJ',
        account,
        entryType,
        amount: val,
        description: desc || 'Manual ledger adjustment',
        isReconciled: false,
      });
      showToast(`Manual voucher ${vchr} posted.`);
    }
    setShowVoucherModal(false);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acctNum.trim() || !acctName.trim()) return;
    addLedgerAccount({
      accountNumber: acctNum.trim(),
      name: acctName.trim(),
      type: acctType,
      isActive: true,
    });
    setAcctNum('');
    setAcctName('');
    showToast(`Chart of Accounts entry ${acctNum} created.`);
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
          <div className="text-2xl font-black font-mono text-foreground mt-1">${totalDebits.toFixed(2)}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Incurred claim loss expenses</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold">Total Credits</span>
          <div className="text-2xl font-black font-mono text-foreground mt-1">${totalCredits.toFixed(2)}</div>
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
          <span className="text-[11px] text-muted-foreground mt-1 block">Strict double-entry mathematical invariant</span>
        </div>
      </div>

      {/* Tabs + Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('journals')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${
              activeTab === 'journals' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            Journal Vouchers ({journalEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${
              activeTab === 'accounts' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            Chart of Accounts ({ledgerAccounts.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}

          <Can permission="reports:export">
            <button
              onClick={() => showToast('Exported GAAP double-entry ledger statement.')}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground px-3.5 py-1.5 text-xs font-semibold shadow-sm"
            >
              <Download className="h-3.5 w-3.5" /> Export GAAP
            </button>
          </Can>

          <Can permission="ledger:override">
            <button
              onClick={handleOpenAddVoucher}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-semibold shadow"
            >
              <Plus className="h-3.5 w-3.5" /> Manual Voucher
            </button>
          </Can>
        </div>
      </div>

      {activeTab === 'journals' && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="py-3 px-4">Voucher &amp; Date</th>
                <th className="py-3 px-4">Claim Ref</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Debit ($)</th>
                <th className="py-3 px-4 text-right">Credit ($)</th>
                <th className="py-3 px-4 text-center">Reconciled</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {journalEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/20 transition">
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-bold text-foreground block">{entry.voucherNumber}</span>
                    <span className="text-[11px] text-muted-foreground">{entry.date}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">{entry.claimNumber}</td>
                  <td className="py-3.5 px-4 font-medium text-foreground">{entry.account}</td>
                  <td className="py-3.5 px-4 text-muted-foreground max-w-xs">{entry.description}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                    {entry.entryType === 'DEBIT' ? `$${entry.amount.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                    {entry.entryType === 'CREDIT' ? `$${entry.amount.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => {
                        updateJournalEntry(entry.id, { isReconciled: !entry.isReconciled });
                        showToast(`Voucher ${entry.voucherNumber} reconciliation toggled.`);
                      }}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        entry.isReconciled
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}
                    >
                      {entry.isReconciled ? 'Reconciled' : 'Pending'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Can permission="ledger:override">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => handleOpenEditVoucher(entry)} className="rounded bg-muted p-1.5"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { deleteJournalEntry(entry.id); showToast(`Voucher ${entry.voucherNumber} deleted.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <Can permission="ledger:override">
            <form onSubmit={handleAddAccount} className="rounded-xl border border-border bg-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <input required placeholder="Account # (e.g. 6010)" value={acctNum} onChange={(e) => setAcctNum(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
              <input required placeholder="Account Name" value={acctName} onChange={(e) => setAcctName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
              <select value={acctType} onChange={(e) => setAcctType(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-1.5">
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="REVENUE">REVENUE</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground font-bold px-3 py-1.5">
                + Add Account
              </button>
            </form>
          </Can>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 px-4">Account #</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ledgerAccounts.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{a.accountNumber}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">{a.name}</td>
                    <td className="py-3 px-4 font-mono">{a.type}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => updateLedgerAccount(a.id, { isActive: !a.isActive })}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          a.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Can permission="ledger:override">
                        <button onClick={() => { deleteLedgerAccount(a.id); showToast(`Account ${a.accountNumber} removed.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Can>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-1">
              {editingEntry ? `Edit Voucher ${editingEntry.voucherNumber}` : 'Post Manual Adjustment Voucher'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Controller / Super Admin journal debit or credit modification.
            </p>

            <form onSubmit={handleSaveVoucher} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Claim Reference #</label>
                <input type="text" placeholder="e.g. CLM-202611-9102" value={claimNum} onChange={(e) => setClaimNum(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Entry Type</label>
                  <select value={entryType} onChange={(e) => setEntryType(e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5">
                    <option value="DEBIT">Debit (Expense)</option>
                    <option value="CREDIT">Credit (Disbursement)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Amount ($) *</label>
                  <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Account</label>
                <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5">
                  {ledgerAccounts.map((a) => (
                    <option key={a.id} value={a.name}>{a.accountNumber} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Audit Justification</label>
                <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowVoucherModal(false)} className="rounded-lg border border-border bg-muted/60 px-4 py-1.5 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">
                  {editingEntry ? 'Update Voucher' : 'Post Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
