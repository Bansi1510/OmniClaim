'use client';

import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { Download, Plus, CheckCircle2, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { Can } from '@/components/auth/can';
import { usePermissions } from '@/hooks/use-permissions';
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
    refreshFromBackend,
  } = useDynamicStore();
  const { hasPermission } = usePermissions();

  const canOverrideLedger = hasPermission('ledger:override');
  const canReconcileLedger = hasPermission('ledger:reconcile') || canOverrideLedger;
  const canExportLedger = hasPermission('ledger:export') || hasPermission('reports:export');

  const [activeTab, setActiveTab] = useState<'journals' | 'accounts'>('journals');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'accounts') {
        setActiveTab('accounts');
      }
    }
  }, []);

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

  const journalColumns: GridColumn<DynamicJournalEntry>[] = [
    {
      id: 'voucher',
      header: 'Voucher & Date',
      minWidth: 165,
      accessor: (e) => `${e.voucherNumber} ${e.date}`,
      summary: 'count',
      cell: (entry) => (
        <div className="font-mono">
          <span className="block font-bold text-foreground">{entry.voucherNumber}</span>
          <span className="text-[11px] text-muted-foreground">{entry.date}</span>
        </div>
      ),
    },
    {
      id: 'claimNumber',
      header: 'Claim Ref',
      accessor: (e) => e.claimNumber,
      cell: (entry) => <span className="font-mono font-bold text-primary">{entry.claimNumber}</span>,
    },
    {
      id: 'account',
      header: 'Account',
      minWidth: 200,
      accessor: (e) => e.account,
      cell: (entry) => <span className="font-medium text-foreground">{entry.account}</span>,
    },
    {
      id: 'description',
      header: 'Description',
      minWidth: 210,
      accessor: (e) => e.description,
      cell: (entry) => <span className="text-muted-foreground">{entry.description}</span>,
    },
    {
      id: 'entryType',
      header: 'Type',
      align: 'center',
      filterOptions: [
        { label: 'DEBIT', value: 'DEBIT' },
        { label: 'CREDIT', value: 'CREDIT' },
      ],
      accessor: (e) => e.entryType,
      cell: (entry) => (
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
            entry.entryType === 'DEBIT' ? 'bg-sky-500/15 text-sky-400' : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          {entry.entryType}
        </span>
      ),
    },
    {
      id: 'debit',
      header: 'Debit ($)',
      align: 'right',
      accessor: (e) => (e.entryType === 'DEBIT' ? e.amount : 0),
      summary: (rows) => (
        <span className="font-mono">
          ${rows.filter((r) => r.entryType === 'DEBIT').reduce((s, r) => s + r.amount, 0).toFixed(2)}
        </span>
      ),
      cell: (entry) => (
        <span className="font-mono font-bold text-foreground">
          {entry.entryType === 'DEBIT' ? `$${entry.amount.toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      id: 'credit',
      header: 'Credit ($)',
      align: 'right',
      accessor: (e) => (e.entryType === 'CREDIT' ? e.amount : 0),
      summary: (rows) => (
        <span className="font-mono">
          ${rows.filter((r) => r.entryType === 'CREDIT').reduce((s, r) => s + r.amount, 0).toFixed(2)}
        </span>
      ),
      cell: (entry) => (
        <span className="font-mono font-bold text-foreground">
          {entry.entryType === 'CREDIT' ? `$${entry.amount.toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      id: 'isReconciled',
      header: 'Reconciled',
      align: 'center',
      filterOptions: [
        { label: 'Reconciled', value: 'Reconciled' },
        { label: 'Pending', value: 'Pending' },
      ],
      accessor: (e) => (e.isReconciled ? 'Reconciled' : 'Pending'),
      cell: (entry) => (
        <button
          type="button"
          disabled={!canReconcileLedger}
          onClick={() => {
            updateJournalEntry(entry.id, { isReconciled: !entry.isReconciled });
            showToast(`Voucher ${entry.voucherNumber} reconciliation toggled.`);
          }}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-70 ${
            entry.isReconciled
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-500'
          }`}
        >
          {entry.isReconciled ? 'Reconciled' : 'Pending'}
        </button>
      ),
    },
  ];

  const journalActions = (entry: DynamicJournalEntry): GridAction[] =>
    canOverrideLedger
      ? [
          {
            key: 'edit',
            label: 'Edit',
            title: 'Edit Voucher',
            icon: Edit2,
            onClick: () => handleOpenEditVoucher(entry),
          },
          {
            key: 'delete',
            label: 'Delete',
            title: 'Delete Voucher',
            icon: Trash2,
            tone: 'danger',
            onClick: () => {
              deleteJournalEntry(entry.id);
              showToast(`Voucher ${entry.voucherNumber} deleted.`);
            },
          },
        ]
      : [];

  const accountColumns: GridColumn<DynamicLedgerAccount>[] = [
    {
      id: 'accountNumber',
      header: 'Account #',
      accessor: (a) => a.accountNumber,
      summary: 'count',
      cell: (a) => <span className="font-mono font-bold text-primary">{a.accountNumber}</span>,
    },
    {
      id: 'name',
      header: 'Account Name',
      minWidth: 240,
      accessor: (a) => a.name,
      cell: (a) => <span className="font-semibold text-foreground">{a.name}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      filterOptions: [
        { label: 'ASSET', value: 'ASSET' },
        { label: 'LIABILITY', value: 'LIABILITY' },
        { label: 'EQUITY', value: 'EQUITY' },
        { label: 'REVENUE', value: 'REVENUE' },
        { label: 'EXPENSE', value: 'EXPENSE' },
      ],
      accessor: (a) => a.type,
      cell: (a) => <span className="font-mono">{a.type}</span>,
    },
    {
      id: 'isActive',
      header: 'Active',
      align: 'center',
      filterOptions: [
        { label: 'Active', value: 'Active' },
        { label: 'Disabled', value: 'Disabled' },
      ],
      accessor: (a) => (a.isActive ? 'Active' : 'Disabled'),
      cell: (a) => (
        <button
          type="button"
          disabled={!canOverrideLedger}
          onClick={() => updateLedgerAccount(a.id, { isActive: !a.isActive })}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-70 ${
            a.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
          }`}
        >
          {a.isActive ? 'Active' : 'Disabled'}
        </button>
      ),
    },
  ];

  const accountActions = (a: DynamicLedgerAccount): GridAction[] =>
    canOverrideLedger
      ? [
          {
            key: 'delete',
            label: 'Delete',
            title: 'Remove Account',
            icon: Trash2,
            tone: 'danger',
            onClick: () => {
              deleteLedgerAccount(a.id);
              showToast(`Account ${a.accountNumber} removed.`);
            },
          },
        ]
      : [];

  return (
    <RequirePageAccess permission="ledger:read" title="Double-Entry Financial Ledger">
      <div className="space-y-6">
        <Breadcrumb
          title="Double-Entry Financial Ledger"
          items={[{ label: 'Financial' }, { label: 'General Ledger' }]}
        />

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">Total Debits</span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">${totalDebits.toFixed(2)}</div>
            <span className="mt-1 block text-[11px] text-muted-foreground">Incurred claim loss expenses</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">Total Credits</span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">${totalCredits.toFixed(2)}</div>
            <span className="mt-1 block text-[11px] text-muted-foreground">Settlement payouts disbursed</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">Ledger Invariant Status</span>
            <div className="mt-1 flex items-center gap-2">
              {isBalanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="font-mono text-lg font-bold text-emerald-500">Balanced ($0.00 Diff)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-rose-500" />
                  <span className="font-mono text-lg font-bold text-rose-500">
                    Unbalanced (${Math.abs(totalDebits - totalCredits).toFixed(2)})
                  </span>
                </>
              )}
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">Strict double-entry mathematical invariant</span>
          </div>
        </div>

        {/* Tabs + Toast */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('journals')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${
                activeTab === 'journals' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'
              }`}
            >
              Journal Vouchers ({journalEntries.length})
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${
                activeTab === 'accounts' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'
              }`}
            >
              Chart of Accounts ({ledgerAccounts.length})
            </button>
          </div>

          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>

        {activeTab === 'journals' && (
          <DataGrid<DynamicJournalEntry>
            title="General Ledger Journal Vouchers"
            subtitle="Double-entry settlement postings and manual adjustment vouchers"
            data={journalEntries}
            columns={journalColumns}
            rowKey={(e) => e.id}
            actions={journalActions}
            selectable={canExportLedger}
            allowExport={canExportLedger}
            pageSize={25}
            exportFileName="omniclaim-gaap-journals"
            searchPlaceholder="Search voucher, claim ref, account..."
            onRefresh={() => refreshFromBackend()}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Can permission={['ledger:export', 'reports:export']}>
                  <button
                    onClick={() => showToast('GAAP double-entry ledger statement ready via Export menu.')}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" /> GAAP Ready
                  </button>
                </Can>
                <Can permission="ledger:override">
                  <button
                    onClick={handleOpenAddVoucher}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                  >
                    <Plus className="h-3.5 w-3.5" /> Manual Voucher
                  </button>
                </Can>
              </div>
            }
          />
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <Can permission="ledger:override">
              <form onSubmit={handleAddAccount} className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 text-xs sm:grid-cols-4">
                <input required placeholder="Account # (e.g. 6010)" value={acctNum} onChange={(e) => setAcctNum(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                <input required placeholder="Account Name" value={acctName} onChange={(e) => setAcctName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
                <select value={acctType} onChange={(e) => setAcctType(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-1.5">
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
                <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">
                  + Add Account
                </button>
              </form>
            </Can>

            <DataGrid<DynamicLedgerAccount>
              title="Chart of Accounts"
              subtitle="General ledger account master"
              data={ledgerAccounts}
              columns={accountColumns}
              rowKey={(a) => a.id}
              actions={accountActions}
              allowExport={canExportLedger}
              pageSize={25}
              exportFileName="omniclaim-chart-of-accounts"
              searchPlaceholder="Search account #, name, type..."
              onRefresh={() => refreshFromBackend()}
            />
          </div>
        )}

        {showVoucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
              <h2 className="mb-1 text-lg font-bold text-foreground">
                {editingEntry ? `Edit Voucher ${editingEntry.voucherNumber}` : 'Post Manual Adjustment Voucher'}
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Controller / Super Admin journal debit or credit modification.
              </p>

              <form onSubmit={handleSaveVoucher} className="space-y-4 text-xs">
                <div>
                  <label className="mb-1 block font-semibold">Claim Reference #</label>
                  <input type="text" placeholder="e.g. CLM-202611-9102" value={claimNum} onChange={(e) => setClaimNum(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold">Entry Type</label>
                    <select value={entryType} onChange={(e) => setEntryType(e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5">
                      <option value="DEBIT">Debit (Expense)</option>
                      <option value="CREDIT">Credit (Disbursement)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold">Amount ($) *</label>
                    <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Account</label>
                  <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5">
                    {ledgerAccounts.map((a) => (
                      <option key={a.id} value={a.name}>{a.accountNumber} — {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Audit Justification</label>
                  <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5" />
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-3">
                  <button type="button" onClick={() => setShowVoucherModal(false)} className="rounded-lg border border-border bg-muted/60 px-4 py-1.5 font-semibold">Cancel</button>
                  <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 font-bold text-primary-foreground">
                    {editingEntry ? 'Update Voucher' : 'Post Voucher'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RequirePageAccess>
  );
}
