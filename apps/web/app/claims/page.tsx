'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CLAIM_STATUS_THEME, FRAUD_RISK_THEME } from '@/lib/theme-constants';
import { ClaimStatus, FraudRiskTier } from '@omniclaim/shared-types';
import { Can } from '@/components/auth/can';
import { Plus } from 'lucide-react';

interface ClaimRow {
  id: string;
  claimNumber: string;
  policyNumber: string;
  vehicle: string;
  incidentDate: string;
  status: ClaimStatus;
  version: number;
  fraudScore: number;
  riskTier: FraudRiskTier;
  netPayout: number;
  adjuster: string;
}

const MOCK_CLAIMS: ClaimRow[] = [
  {
    id: 'clm-001',
    claimNumber: 'CLM-202611-9102',
    policyNumber: 'POL-OMNI-2026-9081',
    vehicle: '2022 Honda Accord Touring (VIN: 1HGCR2F83HA001928)',
    incidentDate: '2026-11-24 14:30',
    status: 'TRIAGE_PENDING',
    version: 1,
    fraudScore: 25,
    riskTier: 'MEDIUM',
    netPayout: 675.00,
    adjuster: 'Sarah Jenkins',
  },
  {
    id: 'clm-002',
    claimNumber: 'CLM-202611-8401',
    policyNumber: 'POL-OMNI-2026-3120',
    vehicle: '2024 Toyota RAV4 Hybrid (VIN: 2T3C1RFV5PC082194)',
    incidentDate: '2026-11-23 09:15',
    status: 'SETTLED',
    version: 3,
    fraudScore: 8,
    riskTier: 'LOW',
    netPayout: 520.00,
    adjuster: 'Autonomous STP',
  },
  {
    id: 'clm-003',
    claimNumber: 'CLM-202611-4092',
    policyNumber: 'POL-OMNI-2026-7782',
    vehicle: '2020 Ford F-150 Lariat (VIN: 1FTFW1E84LFA99021)',
    incidentDate: '2026-11-22 18:45',
    status: 'MANUAL_REVIEW',
    version: 2,
    fraudScore: 75,
    riskTier: 'CRITICAL',
    netPayout: 3450.00,
    adjuster: 'Marcus Vance (SIU)',
  },
];

export default function ClaimsQueuePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredClaims = MOCK_CLAIMS.filter((c) => {
    const matchesSearch =
      c.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.policyNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Adjuster Triage Queue</h1>
          <p className="text-xs text-muted-foreground">
            Real-time multi-modal claim verification, phantom diffing, and risk auditing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by Claim #, Policy, or VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-64 shadow-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="TRIAGE_PENDING">Triage Pending</option>
            <option value="MANUAL_REVIEW">Manual Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SETTLED">Settled</option>
          </select>

          {/* New Claim Intake Button - Gated by claims:create */}
          <Can permission="claims:create">
            <button
              onClick={() => alert('Opening new claim submission modal...')}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-semibold shadow transition whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Submit Claim</span>
            </button>
          </Can>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">Claim Dossier</th>
              <th className="py-3 px-4">Insured Vehicle & Policy</th>
              <th className="py-3 px-4">Lifecycle Status</th>
              <th className="py-3 px-4">Fraud Risk Score</th>
              <th className="py-3 px-4">Net Authorized Payout</th>
              <th className="py-3 px-4">Assigned Adjuster</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredClaims.map((claim) => {
              const statusTheme = CLAIM_STATUS_THEME[claim.status];
              const riskTheme = FRAUD_RISK_THEME[claim.riskTier];

              return (
                <tr key={claim.id} className="hover:bg-muted/30 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-foreground font-mono">{claim.claimNumber}</span>
                    <span className="text-[11px] text-muted-foreground block">{claim.incidentDate}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-foreground">{claim.vehicle}</span>
                    <span className="text-[11px] font-mono text-muted-foreground block">{claim.policyNumber}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusTheme.badgeClass}`}>
                      {statusTheme.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{claim.fraudScore}/100</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${riskTheme.badgeClass}`}>
                        {riskTheme.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                    ${claim.netPayout.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    {claim.adjuster}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/claims/${claim.id}`}
                      className="inline-flex items-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1 text-xs font-semibold transition"
                    >
                      Open Workspace →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
