'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { History, Lock, Unlock, Search, CheckCircle2, UserCheck } from 'lucide-react';
import { Can } from '@/components/auth/can';
import { usePermissions } from '@/hooks/use-permissions';

interface AuditLogEntry {
  id: string;
  claimId: string;
  claimNumber: string;
  field: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedByEmail: string;
  timestamp: string;
  reason: string;
}

interface PresenceLease {
  claimId: string;
  claimNumber: string;
  adjusterName: string;
  adjusterEmail: string;
  leasedAt: string;
  expiresInSeconds: number;
}

const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-1',
    claimId: 'clm-001',
    claimNumber: 'CLM-202611-9102',
    field: 'reconciliation_override',
    oldValue: 'status: PHANTOM, approvedCost: 0.00',
    newValue: 'status: MANUAL_OVERRIDE, approvedCost: 180.00',
    modifiedBy: 'Sarah Jenkins',
    modifiedByEmail: 'adjuster.senior@omniclaim.internal',
    timestamp: '2026-11-24 15:42:19',
    reason: 'Garage validated supplemental visual proof of rear reinforcement bar hairline crack',
  },
  {
    id: 'aud-2',
    claimId: 'clm-001',
    claimNumber: 'CLM-202611-9102',
    field: 'status',
    oldValue: 'TRIAGE_PENDING (v1)',
    newValue: 'APPROVED (v2)',
    modifiedBy: 'Sarah Jenkins',
    modifiedByEmail: 'adjuster.senior@omniclaim.internal',
    timestamp: '2026-11-24 16:10:05',
    reason: 'Authorized actuarial waterfall payout after phantom reconciliation',
  },
  {
    id: 'aud-3',
    claimId: 'clm-003',
    claimNumber: 'CLM-202611-4092',
    field: 'fraud_scorecard_override',
    oldValue: 'riskTier: CRITICAL, compositeScore: 75',
    newValue: 'riskTier: HIGH, compositeScore: 50 (GPS Flag Cleared)',
    modifiedBy: 'Marcus Vance',
    modifiedByEmail: 'fraud.siu@omniclaim.internal',
    timestamp: '2026-11-23 11:22:30',
    reason: 'Verified cell tower triangulation discrepancy due to mountain tunnel reception',
  },
];

const MOCK_ACTIVE_LEASES: PresenceLease[] = [
  {
    claimId: 'clm-001',
    claimNumber: 'CLM-202611-9102',
    adjusterName: 'Sarah Jenkins',
    adjusterEmail: 'adjuster.senior@omniclaim.internal',
    leasedAt: '2026-11-25 15:58',
    expiresInSeconds: 142,
  },
];

export default function AuditCompliancePage() {
  const { isSystemAdmin, hasPermission } = usePermissions();
  const [logs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [leases, setLeases] = useState<PresenceLease[]>(MOCK_ACTIVE_LEASES);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleForceUnlock = (claimNumber: string) => {
    setLeases((prev) => prev.filter((l) => l.claimNumber !== claimNumber));
    showToast(`Presence lease for claim ${claimNumber} revoked. Lock released.`);
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.field.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.modifiedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        title="Audit Trail & Presence Leases"
        items={[{ label: 'Audit' }, { label: 'Compliance & History' }]}
      />

      {/* Active Collaborative Presence Locks Section */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <span>Active Redis Adjuster Presence Leases</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Prevents concurrent overwrite collisions across distributed adjusters (TTL 300s)
            </p>
          </div>
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>

        <div className="pt-3">
          {leases.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active adjuster presence locks.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {leases.map((lease) => (
                <div key={lease.claimId} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-primary">{lease.claimNumber}</span>
                    <span className="text-muted-foreground">
                      Locked by <strong className="text-foreground">{lease.adjusterName}</strong> ({lease.adjusterEmail})
                    </span>
                    <span className="rounded bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[10px] font-mono font-semibold">
                      Lease expires in {lease.expiresInSeconds}s
                    </span>
                  </div>

                  {/* Force Unlock Button - Gated by presence:unlock or SUPER_ADMIN */}
                  <Can
                    permission="presence:unlock"
                    fallback={
                      <span className="text-[11px] text-muted-foreground italic">
                        Admin unlock authority required
                      </span>
                    }
                  >
                    <button
                      onClick={() => handleForceUnlock(lease.claimNumber)}
                      className="flex items-center gap-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 px-2.5 py-1 text-xs font-semibold transition"
                    >
                      <Unlock className="h-3 w-3" />
                      <span>Force Unlock</span>
                    </button>
                  </Can>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span>Immutable Field Modification Audit Logs</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Cryptographically timestamped record of every status transition and manual override
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by claim, field, or adjuster..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-border bg-card pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-72 shadow-sm"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="py-3 px-4">Timestamp & Claim</th>
                <th className="py-3 px-4">Target Field</th>
                <th className="py-3 px-4">Old Value</th>
                <th className="py-3 px-4">New Value</th>
                <th className="py-3 px-4">Author / Adjuster</th>
                <th className="py-3 px-4">Audit Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition">
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-bold text-primary block">{log.claimNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-foreground">
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono">
                      {log.field}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-rose-500 font-mono text-[11px] max-w-xs truncate">
                    {log.oldValue}
                  </td>
                  <td className="py-3.5 px-4 text-emerald-500 font-mono text-[11px] max-w-xs truncate">
                    {log.newValue}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-foreground block">{log.modifiedBy}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{log.modifiedByEmail}</span>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground max-w-sm">
                    {log.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
