'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import { apiRequest } from '@/lib/api-client';
import { ShieldCheck, Plus, RefreshCw, Ban, Edit3, CreditCard } from 'lucide-react';

export default function PoliciesPortfolioPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'policies' | 'applications'>('policies');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [polRes, appRes] = await Promise.all([
      apiRequest<any[]>('GET', '/api/v1/policies'),
      apiRequest<any[]>('GET', '/api/v1/policy-applications'),
    ]);
    if (polRes.ok && polRes.data) setPolicies(polRes.data);
    if (appRes.ok && appRes.data) setApplications(appRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRenew = async (policy: any) => {
    const res = await apiRequest('POST', `/api/v1/policies/${policy.id}/renew`, {});
    if (res.ok) {
      notify(`Renewed policy ${policy.policyNumber} for +12 months.`);
      loadData();
    } else {
      notify(res.error || 'Renewal failed.');
    }
  };

  const handleEndorseCoverage = async (policy: any) => {
    const newLimit = Number(policy.coverageLimit) + 10000;
    const res = await apiRequest('POST', `/api/v1/policies/${policy.id}/endorsements`, {
      endorsementType: 'COVERAGE_CHANGE',
      description: `Coverage limit upgraded by +$10,000 to $${newLimit.toLocaleString()}`,
      newCoverageLimit: newLimit,
      premiumDelta: 85,
    });
    if (res.ok) {
      notify(`Endorsement applied on ${policy.policyNumber}.`);
      loadData();
    } else {
      notify(res.error || 'Endorsement failed.');
    }
  };

  const handleCancel = async (policy: any) => {
    const res = await apiRequest('POST', `/api/v1/policies/${policy.id}/cancel`, {
      reason: 'Cancelled by policyholder / admin via Policy Portfolio',
    });
    if (res.ok) {
      notify(`Cancelled policy ${policy.policyNumber}.`);
      loadData();
    } else {
      notify(res.error || 'Cancellation failed.');
    }
  };

  const handlePayQuotedApp = async (app: any) => {
    const res = await apiRequest('POST', `/api/v1/policy-applications/${app.id}/pay-and-issue`, {
      paymentMethod: 'CARD',
      idempotencyKey: `POLPAY-${app.id}`,
    });
    if (res.ok) {
      notify(`Payment completed & Policy issued for ${app.applicationNumber}!`);
      loadData();
    } else {
      notify(res.error || 'Payment failed.');
    }
  };

  const policyColumns: GridColumn<any>[] = [
    {
      id: 'policyNumber',
      header: 'Policy #',
      accessor: (r) => r.policyNumber,
      cell: (r) => <span className="font-mono font-bold text-primary">{r.policyNumber}</span>,
    },
    { id: 'categoryCode', header: 'Category', accessor: (r) => r.categoryCode || 'AUTO' },
    {
      id: 'asset',
      header: 'Covered Asset / Plan',
      accessor: (r) => `${r.vehicleYear} ${r.vehicleMake} ${r.vehicleModel}`,
    },
    {
      id: 'coverageLimit',
      header: 'Coverage',
      align: 'right',
      accessor: (r) => Number(r.coverageLimit),
      cell: (r) => <span className="font-mono">${Number(r.coverageLimit).toLocaleString()}</span>,
    },
    {
      id: 'annualPremium',
      header: 'Annual Premium',
      align: 'right',
      accessor: (r) => Number(r.annualPremium || 1200),
      cell: (r) => <span className="font-mono">${Number(r.annualPremium || 1200).toLocaleString()}</span>,
    },
    {
      id: 'lifecycleStatus',
      header: 'Status',
      accessor: (r) => r.lifecycleStatus || (r.isActive ? 'ACTIVE' : 'CANCELLED'),
      cell: (r) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            r.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {r.lifecycleStatus || (r.isActive ? 'ACTIVE' : 'CANCELLED')}
        </span>
      ),
    },
    {
      id: 'endDate',
      header: 'Expires',
      accessor: (r) => String(r.endDate).slice(0, 10),
    },
  ];

  const applicationColumns: GridColumn<any>[] = [
    {
      id: 'applicationNumber',
      header: 'Application #',
      accessor: (r) => r.applicationNumber,
      cell: (r) => <span className="font-mono font-bold text-primary">{r.applicationNumber}</span>,
    },
    { id: 'product', header: 'Product', accessor: (r) => r.product?.name || '—' },
    { id: 'applicant', header: 'Applicant', accessor: (r) => r.applicant?.fullName || '—' },
    {
      id: 'requestedCoverage',
      header: 'Requested Cover',
      align: 'right',
      accessor: (r) => Number(r.requestedCoverage),
      cell: (r) => <span className="font-mono">${Number(r.requestedCoverage).toLocaleString()}</span>,
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
    {
      id: 'quote',
      header: 'Latest Quote',
      align: 'right',
      accessor: (r) => (r.quotes?.[0] ? Number(r.quotes[0].totalPremium) : 0),
      cell: (r) =>
        r.quotes?.[0] ? (
          <span className="font-mono font-bold text-emerald-400">
            ${Number(r.quotes[0].totalPremium).toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        ),
    },
  ];

  return (
    <RequirePageAccess permission="policies:read" title="Policy Portfolio">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              My Policies &amp; Applications
            </h1>
            <p className="text-sm text-muted-foreground">
              View your active insurance policies, update coverage, renew, or track open applications.
            </p>
          </div>
          <Link
            href="/policies/apply"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Apply for New Policy
          </Link>
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('policies')}
            className={`rounded-lg px-4 py-2 text-xs font-bold ${
              tab === 'policies' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            Issued Policies ({policies.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('applications')}
            className={`rounded-lg px-4 py-2 text-xs font-bold ${
              tab === 'applications' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            Policy Applications ({applications.length})
          </button>
        </div>

        {tab === 'policies' ? (
          <DataGrid
            data={policies}
            columns={policyColumns}
            rowKey={(r) => r.id}
            loading={loading}
            onRefresh={loadData}
            title="Active & Historical Policies"
            exportFileName="omniclaim-policies"
            actions={(row) => [
              row.isActive && {
                key: 'endorse',
                label: 'Endorse (+$10k)',
                icon: Edit3,
                tone: 'primary' as const,
                onClick: () => handleEndorseCoverage(row),
              },
              row.isActive && {
                key: 'renew',
                label: 'Renew (+1 Yr)',
                icon: RefreshCw,
                tone: 'success' as const,
                onClick: () => handleRenew(row),
              },
              row.isActive && {
                key: 'cancel',
                label: 'Cancel Policy',
                icon: Ban,
                tone: 'danger' as const,
                onClick: () => handleCancel(row),
              },
            ]}
          />
        ) : (
          <DataGrid
            data={applications}
            columns={applicationColumns}
            rowKey={(r) => r.id}
            loading={loading}
            onRefresh={loadData}
            title="Policy Applications"
            exportFileName="omniclaim-policy-applications"
            actions={(row) => [
              (row.status === 'QUOTED' || row.status === 'QUOTE_ACCEPTED') && {
                key: 'pay-issue',
                label: 'Pay & Issue Policy',
                icon: CreditCard,
                tone: 'success' as const,
                onClick: () => handlePayQuotedApp(row),
              },
            ]}
          />
        )}
      </div>
    </RequirePageAccess>
  );
}
