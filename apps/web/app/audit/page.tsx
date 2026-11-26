'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import {
  History,
  Lock,
  Unlock,
  Search,
  CheckCircle2,
  KeyRound,
  Activity,
  RefreshCw,
  Download,
  Eye,
  X,
  Crown,
  Trash2,
  ArrowRight,
  Clock,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { Can } from '@/components/auth/can';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import { usePermissions } from '@/hooks/use-permissions';
import { apiRequest } from '@/lib/api-client';
import type { SystemActivityAuditLogDto, AuditStatsDto } from '@omniclaim/shared-types';

const METHOD_BADGE: Record<string, string> = {
  GET: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  POST: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PUT: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

const MODULES = [
  'ALL',
  'CLAIMS',
  'POLICIES',
  'USERS',
  'ROLES',
  'GARAGES',
  'PARTS',
  'RULES',
  'DEPRECIATION',
  'MENUS',
  'PERMISSIONS',
  'SETTINGS',
  'LEDGER',
  'AUTH',
  'SUPER_ADMIN',
  'AUDIT',
];

function formatValuePreview(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string') return val.length > 42 ? `${val.slice(0, 42)}…` : val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    const str = JSON.stringify(val);
    return str.length > 42 ? `${str.slice(0, 42)}…` : str;
  } catch {
    return String(val);
  }
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 19);
}

export default function AuditCompliancePage() {
  const { auditLogs, presenceLeases, securityAuditLogs, releasePresenceLease } = useDynamicStore();
  const { isSystemAdmin, isMasterLogin, bypassAllPermissions } = usePermissions();
  const isSuper = isSystemAdmin || isMasterLogin || bypassAllPermissions;

  const [activeTab, setActiveTab] = useState<'activity' | 'field' | 'security'>('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Global HTTP Request & Change Diff Explorer state
  const [activityLogs, setActivityLogs] = useState<SystemActivityAuditLogDto[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityStats, setActivityStats] = useState<AuditStatsDto>({
    total: 0,
    byMethod: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    byModule: {},
    errorCount: 0,
    masterOverrideCount: 0,
    avgDurationMs: 0,
  });
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');
  const [page, setPage] = useState(1);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemActivityAuditLogDto | null>(null);
  const limit = 30;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const fetchActivityLogs = useCallback(async () => {
    setLoadingLogs(true);
    const params = new URLSearchParams();
    if (methodFilter !== 'ALL') params.set('method', methodFilter);
    if (moduleFilter !== 'ALL') params.set('module', moduleFilter);
    if (statusFilter !== 'ALL') params.set('statusGroup', statusFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));

    const res = await apiRequest<{
      items: SystemActivityAuditLogDto[];
      total: number;
      page: number;
      limit: number;
      stats: AuditStatsDto;
    }>('GET', `/api/v1/audit/logs?${params.toString()}`, undefined, { 'x-audit-silent': '1' });

    if (res.ok && res.data) {
      setActivityLogs(res.data.items || []);
      setActivityTotal(res.data.total || 0);
      if (res.data.stats) setActivityStats(res.data.stats);
    }
    setLoadingLogs(false);
  }, [methodFilter, moduleFilter, statusFilter, searchTerm, page]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  const handleForceUnlock = (claimId: string, claimNumber: string) => {
    releasePresenceLease(claimId);
    showToast(`Presence lease for claim ${claimNumber} revoked. Lock released.`);
  };

  const handleDeleteAuditRow = async (id: string) => {
    const res = await apiRequest('DELETE', `/api/v1/audit/logs/${id}`, undefined, { 'x-audit-silent': '1' });
    if (res.ok) {
      setActivityLogs((prev) => prev.filter((l) => l.id !== id));
      setActivityTotal((t) => Math.max(0, t - 1));
      if (selectedLog?.id === id) setSelectedLog(null);
      showToast('Audit log entry removed.');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Method',
      'StatusCode',
      'DurationMs',
      'Module',
      'Action',
      'Path',
      'EntityType',
      'EntityId',
      'Username',
      'UserFullName',
      'UserEmail',
      'UserRole',
      'MasterLogin',
      'IP',
      'ChangedFields',
      'OldValues',
      'NewValues',
      'Error',
    ];
    const escapeCsv = (v: unknown) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = activityLogs.map((l) =>
      [
        l.createdAt,
        l.method,
        l.statusCode,
        l.durationMs,
        l.module,
        l.action,
        l.path,
        l.entityType || '',
        l.entityId || '',
        l.username || '',
        l.userFullName || '',
        l.userEmail || '',
        l.userRole || '',
        l.isMasterLogin,
        l.ipAddress || '',
        l.changedFields || [],
        l.oldValues || {},
        l.newValues || {},
        l.errorMessage || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omniclaim-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${activityLogs.length} audit log records to CSV.`);
  };

  const filteredFieldLogs = auditLogs.filter(
    (l) =>
      l.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.field.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.modifiedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(activityTotal / limit));

  return (
    <div className="space-y-6">
      <Breadcrumb
        title="Enterprise Audit Trail, Request Tracker & Change Diffs"
        items={[{ label: 'Audit' }, { label: 'All Requests & Compliance' }]}
      />

      {/* Live Telemetry KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Requests', value: activityStats.total, color: 'text-foreground' },
          { label: 'GET Reads', value: activityStats.byMethod?.GET || 0, color: 'text-sky-400' },
          { label: 'POST Creates', value: activityStats.byMethod?.POST || 0, color: 'text-emerald-400' },
          {
            label: 'PATCH / PUT',
            value: (activityStats.byMethod?.PATCH || 0) + (activityStats.byMethod?.PUT || 0),
            color: 'text-amber-400',
          },
          { label: 'DELETE Ops', value: activityStats.byMethod?.DELETE || 0, color: 'text-rose-400' },
          { label: '4xx / 5xx Errors', value: activityStats.errorCount, color: 'text-rose-500' },
          { label: 'Avg Latency', value: `${activityStats.avgDurationMs}ms`, color: 'text-primary' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {kpi.label}
            </span>
            <span className={`text-xl font-black font-mono mt-1 block ${kpi.color}`}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Active Collaborative Presence Locks */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2.5 border-b border-border">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            <span>Active Adjuster Presence Leases ({presenceLeases.length})</span>
          </h2>
          {toastMessage && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
        <div className="pt-2.5">
          {presenceLeases.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active adjuster presence locks.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {presenceLeases.map((lease) => (
                <div key={lease.claimId} className="py-2 flex items-center justify-between text-xs">
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
                    fallback={<span className="text-[11px] text-muted-foreground italic">Admin unlock required</span>}
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

      {/* Audit View Tabs + Global Search + Export */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'activity'
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>All HTTP Requests &amp; Diffs ({activityTotal})</span>
          </button>
          <button
            onClick={() => setActiveTab('field')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'field'
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Claim Field Audit ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'security'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Master Password &amp; Security ({securityAuditLogs.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search username, path, action, entity..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card pl-9 pr-3.5 py-1.5 text-xs w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {activeTab === 'activity' && (
            <>
              <button
                onClick={fetchActivityLogs}
                disabled={loadingLogs}
                className="flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 px-3 py-1.5 text-xs font-bold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: GLOBAL HTTP REQUESTS (GET/POST/PUT/PATCH/DELETE) & FIELD-LEVEL DIFFS */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Method Pills + Module + Status Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMethodFilter(m);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold border transition ${
                    methodFilter === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : m === 'ALL'
                        ? 'bg-background border-border text-muted-foreground hover:text-foreground'
                        : `${METHOD_BADGE[m]} opacity-75 hover:opacity-100`
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold"
              >
                {MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    Module: {mod}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold"
              >
                <option value="ALL">Status: All</option>
                <option value="SUCCESS">2xx / 3xx Success</option>
                <option value="ERROR">4xx / 5xx Errors</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 px-3">Timestamp &amp; Latency</th>
                  <th className="py-3 px-3">Method &amp; Status</th>
                  <th className="py-3 px-3">Endpoint &amp; Action</th>
                  <th className="py-3 px-3">Who Changed (User &amp; IP)</th>
                  <th className="py-3 px-3">Field Changes (Old → New)</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      {loadingLogs ? 'Loading live HTTP audit stream...' : 'No audit logs match the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => {
                    const diffs = Array.isArray(log.changedFields) ? log.changedFields : [];
                    return (
                      <tr key={log.id} className="hover:bg-muted/20 align-top">
                        <td className="py-3 px-3 font-mono whitespace-nowrap">
                          <span className="text-foreground font-semibold block">{formatTimestamp(log.createdAt)}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                            <Clock className="h-2.5 w-2.5" /> {log.durationMs}ms
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-mono font-black ${
                                METHOD_BADGE[log.method] || 'bg-muted text-foreground border-border'
                              }`}
                            >
                              {log.method}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                log.statusCode >= 400
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {log.statusCode}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground block mt-1">
                            {log.module}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <span className="font-mono font-bold text-primary block truncate" title={log.path}>
                            {log.path}
                          </span>
                          <span className="text-[11px] font-semibold text-foreground block">{log.action}</span>
                          {log.entityType && (
                            <span className="text-[10px] font-mono text-muted-foreground block truncate">
                              {log.entityType}
                              {log.entityId ? ` · #${log.entityId.slice(0, 18)}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-foreground">
                              @{log.username || 'anonymous'}
                            </span>
                            {log.isMasterLogin && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 text-amber-400 px-1.5 py-0.5 text-[9px] font-black">
                                <Crown className="h-2.5 w-2.5" /> MASTER
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground block">
                            {log.userFullName || log.userEmail || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                            <Globe className="h-2.5 w-2.5" /> {log.ipAddress || '127.0.0.1'}
                            {log.userRole ? ` · ${log.userRole}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          {log.errorMessage ? (
                            <div className="inline-flex items-start gap-1.5 rounded bg-rose-500/10 border border-rose-500/25 px-2 py-1 text-[11px] text-rose-400 font-mono">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span className="break-all">{log.errorMessage}</span>
                            </div>
                          ) : diffs.length > 0 ? (
                            <div className="space-y-1">
                              {diffs.slice(0, 3).map((d, idx) => (
                                <div key={`${d.field}-${idx}`} className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
                                  <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">
                                    {d.field}
                                  </span>
                                  <span className="text-rose-400 line-through">
                                    {formatValuePreview(d.oldValue)}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-emerald-400 font-bold">
                                    {formatValuePreview(d.newValue)}
                                  </span>
                                </div>
                              ))}
                              {diffs.length > 3 && (
                                <span className="text-[10px] text-primary font-semibold">
                                  +{diffs.length - 3} more field change(s) — click Inspect
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              {log.method === 'GET' ? 'Read access (no mutation)' : 'Recorded request metadata'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 px-2.5 py-1 text-[11px] font-bold"
                            >
                              <Eye className="h-3 w-3" /> Diff
                            </button>
                            {isSuper && (
                              <button
                                onClick={() => handleDeleteAuditRow(log.id)}
                                className="rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 p-1.5"
                                title="Delete Audit Entry"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing page <strong className="text-foreground">{page}</strong> of{' '}
              <strong className="text-foreground">{totalPages}</strong> ({activityTotal} total audited requests)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border bg-card px-3 py-1 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-border bg-card px-3 py-1 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLAIM FIELD MODIFICATIONS */}
      {activeTab === 'field' && (
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
              {filteredFieldLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20">
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-bold text-primary block">{log.claimNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold">
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono">{log.field}</span>
                  </td>
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
      )}

      {/* TAB 3: MASTER PASSWORD & SECURITY LOG */}
      {activeTab === 'security' && (
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
                  <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">{log.createdAt}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                        log.eventType === 'LOGIN_SUPER_MASTER_PASSWORD'
                          ? 'bg-amber-500/20 text-amber-400'
                          : log.eventType === 'LOGIN_FAILED'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {log.eventType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-foreground">@{log.actorIdentifier}</td>
                  <td className="py-3.5 px-4 font-mono">{log.platform}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDIT DIFF INSPECTOR MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-mono font-black ${
                      METHOD_BADGE[selectedLog.method] || 'bg-muted text-foreground border-border'
                    }`}
                  >
                    {selectedLog.method}
                  </span>
                  <span className="font-mono font-bold text-sm text-primary">{selectedLog.path}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
                      selectedLog.statusCode >= 400
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    HTTP {selectedLog.statusCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                  Action: {selectedLog.action} · Module: {selectedLog.module} · Time: {formatTimestamp(selectedLog.createdAt)} · Duration: {selectedLog.durationMs}ms
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actor & Client Telemetry */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Who Changed / Accessed</span>
                <span className="font-mono font-bold text-foreground block mt-1">
                  @{selectedLog.username || 'anonymous'} {selectedLog.isMasterLogin ? '(MASTER OVERRIDE)' : ''}
                </span>
                <span className="text-muted-foreground block">{selectedLog.userFullName || '—'}</span>
                <span className="font-mono text-[11px] text-primary block">{selectedLog.userEmail || '—'}</span>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Role &amp; Entity</span>
                <span className="font-mono font-bold text-foreground block mt-1">{selectedLog.userRole || 'GUEST'}</span>
                <span className="text-muted-foreground block">Entity: {selectedLog.entityType || '—'}</span>
                <span className="font-mono text-[11px] text-muted-foreground block break-all">
                  ID: {selectedLog.entityId || '—'}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Client Telemetry</span>
                <span className="font-mono font-bold text-foreground block mt-1">IP: {selectedLog.ipAddress || '127.0.0.1'}</span>
                <span className="text-[10px] font-mono text-muted-foreground block break-all mt-0.5">
                  UA: {selectedLog.userAgent || '—'}
                </span>
              </div>
            </div>

            {/* Per-Field Diff Table */}
            {Array.isArray(selectedLog.changedFields) && selectedLog.changedFields.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Exact Field-by-Field Changes ({selectedLog.changedFields.length})
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Field</th>
                        <th className="py-2 px-3">Old Value (Before)</th>
                        <th className="py-2 px-3">New Value (After)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {selectedLog.changedFields.map((d, i) => (
                        <tr key={`${d.field}-${i}`}>
                          <td className="py-2 px-3 font-bold text-foreground">{d.field}</td>
                          <td className="py-2 px-3 text-rose-400 break-all">{JSON.stringify(d.oldValue)}</td>
                          <td className="py-2 px-3 text-emerald-400 font-bold break-all">{JSON.stringify(d.newValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Side-by-Side Old vs New JSON Snapshots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-rose-400 block">Old Value Snapshot (Before)</span>
                <pre className="rounded-xl border border-rose-500/20 bg-background p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                  {selectedLog.oldValues ? JSON.stringify(selectedLog.oldValues, null, 2) : 'null (No previous record)'}
                </pre>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-emerald-400 block">New Value Snapshot (After)</span>
                <pre className="rounded-xl border border-emerald-500/20 bg-background p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                  {selectedLog.newValues ? JSON.stringify(selectedLog.newValues, null, 2) : 'null (Deleted or Read-Only)'}
                </pre>
              </div>
            </div>

            {/* Request Payload & Query Params */}
            {(selectedLog.requestBody || selectedLog.queryParams || selectedLog.errorMessage) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLog.requestBody && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground block">
                      Request Body (Passwords Redacted)
                    </span>
                    <pre className="rounded-xl border border-border bg-background p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-48">
                      {JSON.stringify(selectedLog.requestBody, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.queryParams && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground block">Query Params</span>
                    <pre className="rounded-xl border border-border bg-background p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-48">
                      {JSON.stringify(selectedLog.queryParams, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.errorMessage && (
                  <div className="md:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-mono text-rose-400">
                    Error: {selectedLog.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
