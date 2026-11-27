'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import { apiRequest } from '@/lib/api-client';
import { ClipboardCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function UnderwritingQueuePage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'DECLINED' | 'NEEDS_INFO'>('APPROVED');
  const [riskScore, setRiskScore] = useState('18');
  const [premiumLoading, setPremiumLoading] = useState('0');
  const [notes, setNotes] = useState('Risk dossier verified; eligible for binding quote.');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadApplications = useCallback(async () => {
    setLoading(true);
    const res = await apiRequest<any[]>('GET', '/api/v1/policy-applications');
    if (res.ok && res.data) {
      setApplications(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleSubmitDecision = async () => {
    if (!selectedApp) return;
    const res = await apiRequest(
      'POST',
      `/api/v1/policy-applications/${selectedApp.id}/underwriting`,
      {
        decision,
        riskScore: Number(riskScore),
        premiumLoading: Number(premiumLoading),
        notes,
      },
    );
    if (res.ok) {
      notify(`Underwriting decision ${decision} recorded for ${selectedApp.applicationNumber}.`);
      setSelectedApp(null);
      loadApplications();
    } else {
      notify(res.error || 'Failed to record underwriting decision.');
    }
  };

  const columns: GridColumn<any>[] = [
    {
      id: 'applicationNumber',
      header: 'App #',
      accessor: (r) => r.applicationNumber,
      cell: (r) => <span className="font-mono font-bold text-primary">{r.applicationNumber}</span>,
    },
    { id: 'applicant', header: 'Applicant', accessor: (r) => r.applicant?.fullName || '—' },
    { id: 'category', header: 'Category', accessor: (r) => r.product?.category?.code || '—' },
    { id: 'product', header: 'Product', accessor: (r) => r.product?.name || '—' },
    {
      id: 'coverage',
      header: 'Coverage',
      align: 'right',
      accessor: (r) => Number(r.requestedCoverage),
      cell: (r) => <span className="font-mono">${Number(r.requestedCoverage).toLocaleString()}</span>,
    },
    {
      id: 'docs',
      header: 'Docs',
      align: 'center',
      accessor: (r) => r.documents?.length || 0,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      cell: (r) => (
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <RequirePageAccess permission={['underwriting:review', 'underwriting:approve']} title="Underwriting Queue">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Underwriting Review
          </h1>
          <p className="text-sm text-muted-foreground">
            Review submitted applications, add risk adjustments if needed, and approve or decline coverage.
          </p>
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        )}

        <DataGrid
          data={applications}
          columns={columns}
          rowKey={(r) => r.id}
          loading={loading}
          onRefresh={loadApplications}
          title="Applications Awaiting Review"
          exportFileName="omniclaim-underwriting"
          actions={(row) => {
            const awaiting = ['SUBMITTED', 'UNDER_REVIEW', 'DOCS_REQUIRED'].includes(row.status);
            return [
              awaiting && {
                key: 'review',
                label: 'Review & Decide',
                icon: CheckCircle2,
                tone: 'primary' as const,
                onClick: () => {
                  setSelectedApp(row);
                  setDecision('APPROVED');
                },
              },
            ];
          }}
        />

        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-lg font-bold">Underwrite {selectedApp.applicationNumber}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedApp.product?.name} · Coverage ${Number(selectedApp.requestedCoverage).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDecision('APPROVED')}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-bold ${
                    decision === 'APPROVED' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-border'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Quote
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('NEEDS_INFO')}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-bold ${
                    decision === 'NEEDS_INFO' ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-border'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Request Docs
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('DECLINED')}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-bold ${
                    decision === 'DECLINED' ? 'border-rose-500 bg-rose-500/20 text-rose-300' : 'border-border'
                  }`}
                >
                  <XCircle className="h-3.5 w-3.5" /> Decline
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Underwriting Risk Score</label>
                  <input
                    type="number"
                    value={riskScore}
                    onChange={(e) => setRiskScore(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Premium Loading ($)</label>
                  <input
                    type="number"
                    value={premiumLoading}
                    onChange={(e) => setPremiumLoading(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Underwriter Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitDecision}
                  className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground"
                >
                  Submit Decision
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequirePageAccess>
  );
}
