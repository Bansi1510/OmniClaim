'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { History, Lock, Unlock, Search, CheckCircle2, KeyRound } from 'lucide-react';
import { Can } from '@/components/auth/can';
import { useDynamicStore } from '@/hooks/use-dynamic-store';

export default function AuditCompliancePage() {
  const { auditLogs, presenceLeases, securityAuditLogs, releasePresenceLease } = useDynamicStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'field' | 'security'>('field');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleForceUnlock = (claimId: string, claimNumber: string) => {
    releasePresenceLease(claimId);
    showToast(`Presence lease for claim ${claimNumber} revoked. Lock released.`);
  };

  const filteredLogs = auditLogs.filter(
    (l) =>
      l.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.field.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.modifiedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        title="Audit Trail, Security Log & Presence Leases"
        items={[{ label: 'Audit' }, { label: 'Compliance & History' }]}
      />

      {/* Active Collaborative Presence Locks */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <span>Active Redis Adjuster Presence Leases</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Prevents concurrent overwrite collisions across distributed adjusters
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
          {presenceLeases.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active adjuster presence locks.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {presenceLeases.map((lease) => (
                <div key={lease.claimId} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-primary">{lease.claimNumber}</span>
                    <span className="text-muted-foreground">
                      Locked by <strong className="text-foreground">{lease.adjusterName}</strong> ({lease.adjusterEmail})
                    </span>
                    <span className="rounded bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[10px] font-mono font-semibold">
                      Expires in {lease.expiresInSeconds}s
                    </span>
                  </div>

                  <Can
                    permission="presence:unlock"
                    fallback={
                      <span className="text-[11px] text-muted-foreground italic">Admin unlock required</span>
                    }
                  >
                    <button
                      onClick={() => handleForceUnlock(lease.claimId, lease.claimNumber)}
                      className="flex items-center gap-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 px-2.5 py-1 text-xs font-semibold"
                    >
                      <Unlock className="h-3 w-3" /> Force Unlock
                    </button>
                  </Can>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('field')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold ${
              activeTab === 'field' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            <History className="h-3.5 w-3.5" /> Field Modifications ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold ${
              activeTab === 'security' ? 'bg-amber-500 text-slate-950' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" /> Master Password &amp; Security Log ({securityAuditLogs.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-border bg-card pl-9 pr-3.5 py-1.5 text-xs w-72 shadow-sm"
          />
        </div>
      </div>

      {activeTab === 'field' ? (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="py-3 px-4">Timestamp &amp; Claim</th>
                <th className="py-3 px-4">Target Field</th>
                <th className="py-3 px-4">Old Value</th>
                <th className="py-3 px-4">New Value</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20">
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-bold text-primary block">{log.claimNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold"><span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono">{log.field}</span></td>
                  <td className="py-3.5 px-4 text-rose-500 font-mono text-[11px]">{log.oldValue}</td>
                  <td className="py-3.5 px-4 text-emerald-500 font-mono text-[11px]">{log.newValue}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-foreground block">{log.modifiedBy}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{log.modifiedByEmail}</span>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground max-w-sm">{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor / Target Username</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {securityAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">{log.createdAt}</td>
                  <td className="py-3 px-4">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                      log.eventType === 'LOGIN_SUPER_MASTER_PASSWORD'
                        ? 'bg-amber-500/20 text-amber-400'
                        : log.eventType === 'LOGIN_FAILED'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {log.eventType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">@{log.actorIdentifier}</td>
                  <td className="py-3 px-4 font-mono">{log.platform}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
