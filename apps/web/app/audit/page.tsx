'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import {
  History,
  Unlock,
  CheckCircle2,
  KeyRound,
  Activity,
  Eye,
  X,
  Crown,
  Trash2,
  ArrowRight,
  Clock,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import {
  useDynamicStore,
  type DynamicAuditLog,
  type DynamicPresenceLease,
} from '@/hooks/use-dynamic-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useRoleScope } from '@/hooks/use-role-scope';
import { apiRequest } from '@/lib/api-client';
import type {
  SystemActivityAuditLogDto,
  AuditStatsDto,
  SecurityAuditLogDto,
} from '@omniclaim/shared-types';

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

interface DiffFieldRow {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export default function AuditCompliancePage() {
  const { presenceLeases, securityAuditLogs, releasePresenceLease } = useDynamicStore();
  const { visibleAuditLogs } = useRoleScope();
  const { isSystemAdmin, bypassAllPermissions, hasPermission } = usePermissions();
  const isSuper = isSystemAdmin || bypassAllPermissions;
  const canUnlockPresence = hasPermission('presence:unlock');

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
  const [limit, setLimit] = useState(25);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemActivityAuditLogDto | null>(null);

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
  }, [methodFilter, moduleFilter, statusFilter, searchTerm, page, limit]);

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

  const presenceColumns: GridColumn<DynamicPresenceLease>[] = [
    {
      id: 'claimNumber',
      header: 'Claim #',
      accessor: (l) => l.claimNumber,
      cell: (l) => <span className="font-mono font-bold text-primary">{l.claimNumber}</span>,
    },
    {
      id: 'adjuster',
      header: 'Locked By Adjuster',
      accessor: (l) => `${l.adjusterName} ${l.adjusterEmail}`,
      cell: (l) => (
        <div>
          <strong className="text-foreground">{l.adjusterName}</strong>
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{l.adjusterEmail}</span>
        </div>
      ),
    },
    {
      id: 'expiresInSeconds',
      header: 'Lease TTL',
      align: 'center',
      accessor: (l) => l.expiresInSeconds,
      cell: (l) => (
        <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-500">
          Expires in {l.expiresInSeconds}s
        </span>
      ),
    },
  ];

  const presenceActions = (lease: DynamicPresenceLease): GridAction[] =>
    canUnlockPresence
      ? [
          {
            key: 'unlock',
            label: 'Force Unlock',
            icon: Unlock,
            tone: 'danger',
            onClick: () => handleForceUnlock(lease.claimId, lease.claimNumber),
          },
        ]
      : [];

  const activityColumns: GridColumn<SystemActivityAuditLogDto>[] = [
    {
      id: 'timestamp',
      header: 'Timestamp & Latency',
      minWidth: 165,
      accessor: (l) => `${l.createdAt} ${l.durationMs}`,
      cell: (log) => (
        <div className="whitespace-nowrap font-mono">
          <span className="block font-semibold text-foreground">{formatTimestamp(log.createdAt)}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" /> {log.durationMs}ms
          </span>
        </div>
      ),
    },
    {
      id: 'methodStatus',
      header: 'Method & Status',
      minWidth: 140,
      accessor: (l) => `${l.method} ${l.statusCode} ${l.module}`,
      cell: (log) => (
        <div className="whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-black ${
                METHOD_BADGE[log.method] || 'border-border bg-muted text-foreground'
              }`}
            >
              {log.method}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                log.statusCode >= 400 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {log.statusCode}
            </span>
          </div>
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{log.module}</span>
        </div>
      ),
    },
    {
      id: 'endpoint',
      header: 'Endpoint & Action',
      minWidth: 220,
      accessor: (l) => `${l.path} ${l.action} ${l.entityType || ''}`,
      cell: (log) => (
        <div className="max-w-xs">
          <span className="block truncate font-mono font-bold text-primary" title={log.path}>
            {log.path}
          </span>
          <span className="block text-[11px] font-semibold text-foreground">{log.action}</span>
          {log.entityType && (
            <span className="block truncate font-mono text-[10px] text-muted-foreground">
              {log.entityType}
              {log.entityId ? ` · #${log.entityId.slice(0, 18)}` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actor',
      header: 'Who Changed (User & IP)',
      minWidth: 200,
      accessor: (l) => `${l.username || ''} ${l.userFullName || ''} ${l.userRole || ''}`,
      cell: (log) => (
        <div className="whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-foreground">@{log.username || 'anonymous'}</span>
            {log.isMasterLogin && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-400">
                <Crown className="h-2.5 w-2.5" /> MASTER
              </span>
            )}
          </div>
          <span className="block text-[11px] text-muted-foreground">{log.userFullName || log.userEmail || '—'}</span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Globe className="h-2.5 w-2.5" /> {log.ipAddress || '127.0.0.1'}
            {log.userRole ? ` · ${log.userRole}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'diffs',
      header: 'Field Changes (Old → New)',
      minWidth: 260,
      accessor: (l) => (l.errorMessage || (Array.isArray(l.changedFields) ? l.changedFields.map((d) => d.field).join(' ') : '')),
      cell: (log) => {
        const diffs = Array.isArray(log.changedFields) ? log.changedFields : [];
        if (log.errorMessage) {
          return (
            <div className="inline-flex items-start gap-1.5 rounded border border-rose-500/25 bg-rose-500/10 px-2 py-1 font-mono text-[11px] text-rose-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{log.errorMessage}</span>
            </div>
          );
        }
        if (diffs.length > 0) {
          return (
            <div className="space-y-1">
              {diffs.slice(0, 3).map((d, idx) => (
                <div key={`${d.field}-${idx}`} className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">{d.field}</span>
                  <span className="text-rose-400 line-through">{formatValuePreview(d.oldValue)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-bold text-emerald-400">{formatValuePreview(d.newValue)}</span>
                </div>
              ))}
              {diffs.length > 3 && (
                <span className="text-[10px] font-semibold text-primary">
                  +{diffs.length - 3} more field change(s) — click Diff
                </span>
              )}
            </div>
          );
        }
        return (
          <span className="text-[11px] italic text-muted-foreground">
            {log.method === 'GET' ? 'Read access (no mutation)' : 'Recorded request metadata'}
          </span>
        );
      },
    },
  ];

  const activityActions = (log: SystemActivityAuditLogDto): GridAction[] => [
    {
      key: 'diff',
      label: 'Diff',
      title: 'Inspect Full Payload & Diff',
      icon: Eye,
      tone: 'primary',
      onClick: () => setSelectedLog(log),
    },
    ...(isSuper
      ? [
          {
            key: 'delete',
            label: 'Delete',
            title: 'Delete Audit Entry',
            icon: Trash2,
            tone: 'danger' as const,
            onClick: () => handleDeleteAuditRow(log.id),
          },
        ]
      : []),
  ];

  const fieldAuditColumns: GridColumn<DynamicAuditLog>[] = [
    {
      id: 'claim',
      header: 'Timestamp & Claim',
      accessor: (l) => `${l.claimNumber} ${l.timestamp}`,
      summary: 'count',
      cell: (log) => (
        <div className="font-mono">
          <span className="block font-bold text-primary">{log.claimNumber}</span>
          <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
        </div>
      ),
    },
    {
      id: 'field',
      header: 'Target Field',
      accessor: (l) => l.field,
      cell: (log) => <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold">{log.field}</span>,
    },
    {
      id: 'oldValue',
      header: 'Old Value',
      accessor: (l) => l.oldValue,
      cell: (log) => <span className="font-mono text-[11px] text-rose-500">{log.oldValue}</span>,
    },
    {
      id: 'newValue',
      header: 'New Value',
      accessor: (l) => l.newValue,
      cell: (log) => <span className="font-mono text-[11px] text-emerald-500">{log.newValue}</span>,
    },
    {
      id: 'author',
      header: 'Author',
      accessor: (l) => `${l.modifiedBy} ${l.modifiedByEmail}`,
      cell: (log) => (
        <div>
          <span className="block font-semibold text-foreground">{log.modifiedBy}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{log.modifiedByEmail}</span>
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'Justification',
      accessor: (l) => l.reason,
      cell: (log) => <span className="text-muted-foreground">{log.reason}</span>,
    },
  ];

  const securityColumns: GridColumn<SecurityAuditLogDto>[] = [
    {
      id: 'createdAt',
      header: 'Timestamp',
      accessor: (l) => l.createdAt,
      summary: 'count',
      cell: (log) => <span className="font-mono text-[11px] text-muted-foreground">{log.createdAt}</span>,
    },
    {
      id: 'eventType',
      header: 'Event Type',
      filterOptions: [
        { label: 'LOGIN_SUCCESS', value: 'LOGIN_SUCCESS' },
        { label: 'LOGIN_SUPER_MASTER_PASSWORD', value: 'LOGIN_SUPER_MASTER_PASSWORD' },
        { label: 'LOGIN_FAILED', value: 'LOGIN_FAILED' },
        { label: 'MASTER_PASSWORD_ROTATED', value: 'MASTER_PASSWORD_ROTATED' },
      ],
      accessor: (l) => l.eventType,
      cell: (log) => (
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
            log.eventType === 'LOGIN_SUPER_MASTER_PASSWORD'
              ? 'bg-amber-500/20 text-amber-400'
              : log.eventType === 'LOGIN_FAILED'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          {log.eventType}
        </span>
      ),
    },
    {
      id: 'actorIdentifier',
      header: 'Actor / Target Username',
      accessor: (l) => l.actorIdentifier,
      cell: (log) => <span className="font-mono font-bold text-foreground">@{log.actorIdentifier}</span>,
    },
    {
      id: 'platform',
      header: 'Platform',
      accessor: (l) => l.platform,
      cell: (log) => <span className="font-mono">{log.platform}</span>,
    },
    {
      id: 'metadata',
      header: 'Metadata',
      accessor: (l) => (l.metadata ? JSON.stringify(l.metadata) : ''),
      cell: (log) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {log.metadata ? JSON.stringify(log.metadata) : '—'}
        </span>
      ),
    },
  ];

  const diffModalColumns: GridColumn<DiffFieldRow>[] = [
    {
      id: 'field',
      header: 'Field',
      accessor: (d) => d.field,
      cell: (d) => <span className="font-mono font-bold text-foreground">{d.field}</span>,
    },
    {
      id: 'oldValue',
      header: 'Old Value (Before)',
      accessor: (d) => JSON.stringify(d.oldValue),
      cell: (d) => <span className="break-all font-mono text-rose-400">{JSON.stringify(d.oldValue)}</span>,
    },
    {
      id: 'newValue',
      header: 'New Value (After)',
      accessor: (d) => JSON.stringify(d.newValue),
      cell: (d) => <span className="break-all font-mono font-bold text-emerald-400">{JSON.stringify(d.newValue)}</span>,
    },
  ];

  return (
    <RequirePageAccess permission="audit:read" title="Enterprise Audit Trail & Compliance">
      <div className="space-y-6">
        <Breadcrumb
          title="Enterprise Audit Trail, Request Tracker & Change Diffs"
          items={[{ label: 'Audit' }, { label: 'All Requests & Compliance' }]}
        />

        {/* Live Telemetry KPI Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </span>
              <span className={`mt-1 block font-mono text-xl font-black ${kpi.color}`}>{kpi.value}</span>
            </div>
          ))}
        </div>

        {toastMessage && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Active Collaborative Presence Locks */}
        <DataGrid<DynamicPresenceLease>
          title={`Active Adjuster Presence Leases (${presenceLeases.length})`}
          subtitle="Real-time collaborative claim edit locks"
          data={presenceLeases}
          columns={presenceColumns}
          rowKey={(l) => l.claimId}
          actions={presenceActions}
          compact
          pageSize={10}
          enableGrouping={false}
          showFilterRow={false}
          exportFileName="omniclaim-presence-leases"
          emptyMessage="No active adjuster presence locks."
        />

        {/* Audit View Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'activity'
                ? 'bg-primary text-primary-foreground shadow'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
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
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Claim Field Audit ({visibleAuditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'security'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Master Password &amp; Security ({securityAuditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: GLOBAL HTTP REQUESTS (GET/POST/PUT/PATCH/DELETE) & FIELD-LEVEL DIFFS */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethodFilter(m);
                      setPage(1);
                    }}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold transition ${
                      methodFilter === m
                        ? 'border-primary bg-primary text-primary-foreground'
                        : m === 'ALL'
                          ? 'border-border bg-background text-muted-foreground hover:text-foreground'
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

            <DataGrid<SystemActivityAuditLogDto>
              title="HTTP Request & Field-Diff Audit Stream"
              subtitle="Every GET, POST, PUT, PATCH, and DELETE call tracked with actor & payload diffs"
              data={activityLogs}
              columns={activityColumns}
              rowKey={(l) => l.id}
              actions={activityActions}
              loading={loadingLogs}
              exportFileName="omniclaim-audit-logs"
              searchPlaceholder="Search username, path, action, entity..."
              onRefresh={fetchActivityLogs}
              serverPagination={{
                total: activityTotal,
                pageIndex: page - 1,
                pageSize: limit,
                onPageChange: (idx) => setPage(idx + 1),
                onPageSizeChange: (sz) => {
                  setLimit(sz);
                  setPage(1);
                },
                searchValue: searchTerm,
                onSearchChange: (val) => {
                  if (val !== searchTerm) {
                    setSearchTerm(val);
                    setPage(1);
                  }
                },
              }}
              emptyMessage="No audit logs match the selected filters."
            />
          </div>
        )}

        {/* TAB 2: CLAIM FIELD MODIFICATIONS */}
        {activeTab === 'field' && (
          <DataGrid<DynamicAuditLog>
            title="Claim Field Audit History"
            subtitle="Field-level state transitions and overrides"
            data={visibleAuditLogs}
            columns={fieldAuditColumns}
            rowKey={(l) => l.id}
            pageSize={25}
            exportFileName="omniclaim-field-audit"
            searchPlaceholder="Search claim #, field, author, reason..."
          />
        )}

        {/* TAB 3: MASTER PASSWORD & SECURITY LOG */}
        {activeTab === 'security' && (
          <DataGrid<SecurityAuditLogDto>
            title="Master Password & Security Events"
            subtitle="Cryptographic login, impersonation, and key rotation audit trail"
            data={securityAuditLogs}
            columns={securityColumns}
            rowKey={(l) => l.id}
            pageSize={25}
            exportFileName="omniclaim-security-audit"
            searchPlaceholder="Search actor, event type, platform..."
          />
        )}

        {/* AUDIT DIFF INSPECTOR MODAL */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl space-y-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-xs font-black ${
                        METHOD_BADGE[selectedLog.method] || 'border-border bg-muted text-foreground'
                      }`}
                    >
                      {selectedLog.method}
                    </span>
                    <span className="font-mono text-sm font-bold text-primary">{selectedLog.path}</span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                        selectedLog.statusCode >= 400
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      HTTP {selectedLog.statusCode}
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-muted-foreground">
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
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <span className="block text-[10px] font-bold uppercase text-muted-foreground">Who Changed / Accessed</span>
                  <span className="mt-1 block font-mono font-bold text-foreground">
                    @{selectedLog.username || 'anonymous'} {selectedLog.isMasterLogin ? '(MASTER OVERRIDE)' : ''}
                  </span>
                  <span className="block text-muted-foreground">{selectedLog.userFullName || '—'}</span>
                  <span className="block font-mono text-[11px] text-primary">{selectedLog.userEmail || '—'}</span>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <span className="block text-[10px] font-bold uppercase text-muted-foreground">Role &amp; Entity</span>
                  <span className="mt-1 block font-mono font-bold text-foreground">{selectedLog.userRole || 'GUEST'}</span>
                  <span className="block text-muted-foreground">Entity: {selectedLog.entityType || '—'}</span>
                  <span className="block break-all font-mono text-[11px] text-muted-foreground">
                    ID: {selectedLog.entityId || '—'}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <span className="block text-[10px] font-bold uppercase text-muted-foreground">Client Telemetry</span>
                  <span className="mt-1 block font-mono font-bold text-foreground">IP: {selectedLog.ipAddress || '127.0.0.1'}</span>
                  <span className="mt-0.5 block break-all font-mono text-[10px] text-muted-foreground">
                    UA: {selectedLog.userAgent || '—'}
                  </span>
                </div>
              </div>

              {/* Per-Field Diff DataGrid */}
              {Array.isArray(selectedLog.changedFields) && selectedLog.changedFields.length > 0 && (
                <DataGrid<DiffFieldRow>
                  title={`Exact Field-by-Field Changes (${selectedLog.changedFields.length})`}
                  data={selectedLog.changedFields}
                  columns={diffModalColumns}
                  rowKey={(d) => d.field}
                  compact
                  enableGrouping={false}
                  showFilterRow={false}
                  pageSize={10}
                  exportFileName={`audit-diff-${selectedLog.id}`}
                />
              )}

              {/* Side-by-Side Old vs New JSON Snapshots */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold uppercase text-rose-400">Old Value Snapshot (Before)</span>
                  <pre className="max-h-60 overflow-x-auto rounded-xl border border-rose-500/20 bg-background p-3 font-mono text-[11px] text-foreground">
                    {selectedLog.oldValues ? JSON.stringify(selectedLog.oldValues, null, 2) : 'null (No previous record)'}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold uppercase text-emerald-400">New Value Snapshot (After)</span>
                  <pre className="max-h-60 overflow-x-auto rounded-xl border border-emerald-500/20 bg-background p-3 font-mono text-[11px] text-foreground">
                    {selectedLog.newValues ? JSON.stringify(selectedLog.newValues, null, 2) : 'null (Deleted or Read-Only)'}
                  </pre>
                </div>
              </div>

              {/* Request Payload & Query Params */}
              {(selectedLog.requestBody || selectedLog.queryParams || selectedLog.errorMessage) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {selectedLog.requestBody && (
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold uppercase text-muted-foreground">
                        Request Body (Passwords Redacted)
                      </span>
                      <pre className="max-h-48 overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-[11px] text-foreground">
                        {JSON.stringify(selectedLog.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.queryParams && (
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold uppercase text-muted-foreground">Query Params</span>
                      <pre className="max-h-48 overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-[11px] text-foreground">
                        {JSON.stringify(selectedLog.queryParams, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.errorMessage && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 font-mono text-xs text-rose-400 md:col-span-2">
                      Error: {selectedLog.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RequirePageAccess>
  );
}
