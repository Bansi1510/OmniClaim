'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import type { GridAction } from '@/components/common/grid-action-menu';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore, type DynamicUser } from '@/hooks/use-dynamic-store';
import type { SystemSettingDto, SecurityAuditLogDto } from '@omniclaim/shared-types';
import {
  PoliciesCrudTab,
  PartsAndDepreciationTab,
  AutomationRulesTab,
  GaragesCrudTab,
  MenusAndPermissionsTab,
} from '@/components/super-admin/master-crud-tabs';
import {
  Crown,
  KeyRound,
  ShieldCheck,
  Users,
  FileText,
  Wrench,
  Sliders,
  Building2,
  Menu as MenuIcon,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  LogIn,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'security'
  | 'policies'
  | 'parts'
  | 'rules'
  | 'garages'
  | 'menus';

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const {
    username,
    impersonateUser,
  } = usePermissions();
  const store = useDynamicStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [toast, setToast] = useState<string | null>(null);

  // Master Password rotation state
  const [newMasterPwd, setNewMasterPwd] = useState(store.superMasterPassword);
  const [masterEnabled, setMasterEnabled] = useState(store.superMasterPasswordEnabled);
  const [showMasterPwd, setShowMasterPwd] = useState(false);

  React.useEffect(() => {
    setMasterEnabled(store.superMasterPasswordEnabled);
  }, [store.superMasterPasswordEnabled]);

  // Dynamic System Setting add/edit state
  const [settingKey, setSettingKey] = useState('');
  const [settingLabel, setSettingLabel] = useState('');
  const [settingVal, setSettingVal] = useState('');
  const [settingCat, setSettingCat] = useState('GENERAL');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveMasterPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMasterPwd.trim().length < 6) {
      notify('Master password must be at least 6 characters.');
      return;
    }
    store.updateSuperMasterPassword(newMasterPwd.trim(), masterEnabled, username);
    notify('⚡ Super Master Password updated dynamically! Active immediately on Web & Mobile.');
  };

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingKey.trim() || !settingLabel.trim()) return;
    store.upsertSetting({
      key: settingKey.toUpperCase().replace(/\s+/g, '_'),
      label: settingLabel,
      value: settingVal,
      valueType: 'STRING',
      category: settingCat,
      isEditable: true,
    });
    setSettingKey('');
    setSettingLabel('');
    setSettingVal('');
    notify(`Dynamic setting "${settingKey.toUpperCase()}" saved.`);
  };

  const TABS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview & Impersonation', icon: Crown },
    { id: 'security', label: 'Master Password & Settings', icon: KeyRound },
    { id: 'policies', label: 'Policies Master', icon: ShieldCheck },
    { id: 'parts', label: 'Parts & Depreciation', icon: Wrench },
    { id: 'rules', label: 'STP & Fraud Rules', icon: Sliders },
    { id: 'garages', label: 'Repair Garages', icon: Building2 },
    { id: 'menus', label: 'Dynamic Menus & Perms', icon: MenuIcon },
  ];

  const impersonateColumns: GridColumn<DynamicUser>[] = [
    {
      id: 'user',
      header: 'User & Handle',
      minWidth: 180,
      accessor: (u) => `${u.fullName} @${u.username} ${u.email}`,
      cell: (u) => (
        <div>
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <span>{u.fullName}</span>
            {u.isSuperAdmin && <Crown className="h-3 w-3 text-amber-400" />}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">@{u.username} · {u.email}</div>
        </div>
      ),
    },
    {
      id: 'roleSlug',
      header: 'Role',
      accessor: (u) => u.roleSlug,
      cell: (u) => <span className="font-mono text-[11px] text-primary">{u.roleSlug}</span>,
    },
    {
      id: 'isActive',
      header: 'Status',
      align: 'center',
      filterOptions: [
        { label: 'Active', value: 'Active' },
        { label: 'Inactive', value: 'Inactive' },
      ],
      accessor: (u) => (u.isActive ? 'Active' : 'Inactive'),
      cell: (u) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            u.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
          }`}
        >
          {u.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const impersonateActions = (u: DynamicUser): GridAction[] => [
    {
      key: 'god-mode',
      label: 'God Mode',
      title: 'Enter account with all permissions bypassed',
      icon: Crown,
      tone: 'warning',
      onClick: () => {
        impersonateUser(u.id, true);
        notify(`Entered as @${u.username} with Super Admin God Mode active.`);
        router.push('/claims');
      },
    },
    {
      key: 'target-view',
      label: 'Target View',
      title: 'Preview exact permissions of this user',
      icon: LogIn,
      tone: 'primary',
      onClick: () => {
        impersonateUser(u.id, false);
        notify(`Viewing exact permissions of @${u.username} (${u.roleSlug}).`);
        router.push('/claims');
      },
    },
  ];

  const securityColumns: GridColumn<SecurityAuditLogDto>[] = [
    {
      id: 'eventType',
      header: 'Event',
      accessor: (l) => l.eventType,
      cell: (log) => (
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
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
      header: 'Actor',
      accessor: (l) => `@${l.actorIdentifier} ${l.platform}`,
      cell: (log) => (
        <div>
          <span className="font-mono font-bold text-foreground">@{log.actorIdentifier}</span>
          <span className="ml-1.5 text-[10px] text-muted-foreground">({log.platform})</span>
        </div>
      ),
    },
    {
      id: 'createdAt',
      header: 'Time',
      accessor: (l) => l.createdAt,
      cell: (log) => <span className="font-mono text-[10px] text-muted-foreground">{log.createdAt}</span>,
    },
  ];

  const categoryFilterOptions = useMemo(() => {
    const cats = Array.from(new Set(store.settings.map((s) => s.category))).sort();
    return cats.map((c) => ({ label: c, value: c }));
  }, [store.settings]);

  const settingColumns: GridColumn<SystemSettingDto>[] = [
    {
      id: 'keyLabel',
      header: 'Key & Label',
      minWidth: 220,
      accessor: (s) => `${s.key} ${s.label}`,
      summary: 'count',
      cell: (s) => (
        <div>
          <span className="block font-mono font-bold text-primary">{s.key}</span>
          <span className="text-[11px] text-muted-foreground">{s.label}</span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      filterOptions: categoryFilterOptions,
      accessor: (s) => s.category,
      cell: (s) => <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">{s.category}</span>,
    },
    {
      id: 'value',
      header: 'Live Editable Value',
      minWidth: 240,
      accessor: (s) => s.value,
      cell: (s) =>
        s.valueType === 'BOOLEAN' ? (
          <button
            type="button"
            onClick={() => {
              const next = s.value === 'true' ? 'false' : 'true';
              store.upsertSetting({ ...s, value: next });
              notify(`${s.label} set to ${next.toUpperCase()}.`);
            }}
            className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${
              s.value === 'true'
                ? 'border border-amber-500/30 bg-amber-500/20 text-amber-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {s.value === 'true' ? 'ENABLED (true)' : 'DISABLED (false)'}
          </button>
        ) : (
          <input
            type="text"
            value={s.value}
            onChange={(e) => store.upsertSetting({ ...s, value: e.target.value })}
            className="w-60 rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        ),
    },
  ];

  const settingActions = (s: SystemSettingDto): GridAction[] => [
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: () => {
        store.deleteSetting(s.id);
        notify(`Setting ${s.key} deleted.`);
      },
    },
  ];

  return (
    <RequirePageAccess superAdminOnly title="Super Admin Command Center">
      <div className="space-y-6">
        <Breadcrumb
          title="Super Admin Command Center"
          items={[{ label: 'Super Admin' }, { label: 'All-Access Dynamic Control' }]}
        />

        {/* Super Admin God Mode Hero Banner */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-card p-6 shadow-sm lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-950">
                <Crown className="h-3.5 w-3.5" />
                All Permissions Bypassed
              </span>
              <span className="font-mono text-xs font-semibold text-amber-400">@{username}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Enterprise Super Admin Dashboard
            </h1>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Full unrestricted access skipping all RBAC checks. Add, edit, update, or delete any setting, policy, part, depreciation bracket, fraud/STP rule, garage, menu, role, user, claim, or rotate the Super Master Password in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/claims" className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              Claims <ExternalLink className="h-3 w-3" />
            </Link>
            <Link href="/admin/users" className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              Users <ExternalLink className="h-3 w-3" />
            </Link>
            <Link href="/admin/roles" className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              Roles <ExternalLink className="h-3 w-3" />
            </Link>
            <Link href="/ledger" className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              Ledger <ExternalLink className="h-3 w-3" />
            </Link>
            <Link href="/audit" className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20">
              Audit Logs <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={() => {
                if (confirm('Reset all dynamic local demo changes back to factory seed defaults?')) {
                  store.resetStoreToDefaults();
                  notify('All dynamic stores reset to factory seed defaults.');
                }
              }}
              className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20"
            >
              <RotateCcw className="h-3 w-3" /> Reset Defaults
            </button>
          </div>
        </div>

        {/* Live Toast */}
        {toast && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Real-Time Telemetry KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: 'Total Claims', value: store.claims.length, icon: FileText, color: 'text-primary' },
            { label: 'System Users', value: store.users.length, icon: Users, color: 'text-emerald-400' },
            { label: 'Active Policies', value: store.policies.filter((p) => p.isActive).length, icon: ShieldCheck, color: 'text-sky-400' },
            { label: 'Parts Catalog', value: store.partsCatalog.length, icon: Wrench, color: 'text-indigo-400' },
            { label: 'Engine Rules', value: store.automationRules.length + store.depreciationRules.length, icon: Sliders, color: 'text-amber-400' },
            { label: 'Master Password', value: store.superMasterPasswordEnabled ? 'ACTIVE' : 'OFF', icon: KeyRound, color: store.superMasterPasswordEnabled ? 'text-amber-400' : 'text-rose-400' },
          ].map((kpi) => {
            const IconComp = kpi.icon;
            return (
              <div key={kpi.label} className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>{kpi.label}</span>
                  <IconComp className={`h-3.5 w-3.5 ${kpi.color}`} />
                </div>
                <div className="mt-1 font-mono text-xl font-black text-foreground">{kpi.value}</div>
              </div>
            );
          })}
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {TABS.map((t) => {
            const IconComp = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'border border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & ONE-CLICK USER IMPERSONATION */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DataGrid<DynamicUser>
              title="One-Click Impersonate Any User Account"
              subtitle="Enter as any user with God Mode (skip permissions) or Target View (exact role rights)"
              data={store.users}
              columns={impersonateColumns}
              rowKey={(u) => u.id}
              actions={impersonateActions}
              compact
              pageSize={10}
              enableGrouping={false}
              exportFileName="omniclaim-impersonate-users"
              searchPlaceholder="Search user, @username, role..."
            />

            <DataGrid<SecurityAuditLogDto>
              title="Security & Master Password Audit Stream"
              subtitle="Live cryptographic log of logins, overrides, impersonations, and rotations"
              data={store.securityAuditLogs}
              columns={securityColumns}
              rowKey={(l) => l.id}
              compact
              pageSize={10}
              enableGrouping={false}
              exportFileName="omniclaim-security-stream"
              searchPlaceholder="Search event or actor..."
            />
          </div>
        )}

        {/* TAB 2: SUPER MASTER PASSWORD & DYNAMIC SYSTEM SETTINGS */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <form
              onSubmit={handleSaveMasterPassword}
              className="space-y-4 rounded-xl border border-amber-500/35 bg-amber-500/5 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-amber-400">
                    <KeyRound className="h-4 w-4" />
                    <span>Super Master Password Control</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Super Admin can enter ANY user&apos;s username/email with this master password to enter the website or mobile app immediately.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={masterEnabled}
                    onChange={(e) => setMasterEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-amber-500"
                  />
                  <span>Master Login Enabled</span>
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    type={showMasterPwd ? 'text' : 'password'}
                    required
                    value={newMasterPwd}
                    onChange={(e) => setNewMasterPwd(e.target.value)}
                    placeholder="Enter new Super Master Password..."
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2 pr-10 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPwd((v) => !v)}
                    className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
                  >
                    {showMasterPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-black text-slate-950 shadow transition hover:bg-amber-400"
                >
                  Rotate Master Password Now
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <form onSubmit={handleAddSetting} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs md:grid-cols-5">
                <input required placeholder="Setting KEY" value={settingKey} onChange={(e) => setSettingKey(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono uppercase" />
                <input required placeholder="Human Label" value={settingLabel} onChange={(e) => setSettingLabel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
                <input required placeholder="Value" value={settingVal} onChange={(e) => setSettingVal(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
                <select value={settingCat} onChange={(e) => setSettingCat(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5">
                  <option value="GENERAL">GENERAL</option>
                  <option value="BRANDING">BRANDING</option>
                  <option value="STP">STP</option>
                  <option value="FRAUD">FRAUD</option>
                  <option value="SECURITY">SECURITY</option>
                </select>
                <button type="submit" className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" /> Add / Update Key
                </button>
              </form>

              <DataGrid<SystemSettingDto>
                title="Dynamic System Settings (Edit Values Live Anytime)"
                subtitle="Change brand name, STP limits, fraud thresholds, maintenance mode, or custom keys"
                data={store.settings}
                columns={settingColumns}
                rowKey={(s) => s.id}
                actions={settingActions}
                pageSize={25}
                exportFileName="omniclaim-settings"
                searchPlaceholder="Search key, label, category..."
              />
            </div>
          </div>
        )}

        {/* TAB 3-7: MODULAR DYNAMIC MASTER CRUD CONSOLES */}
        {activeTab === 'policies' && <PoliciesCrudTab onNotify={notify} />}
        {activeTab === 'parts' && <PartsAndDepreciationTab onNotify={notify} />}
        {activeTab === 'rules' && <AutomationRulesTab onNotify={notify} />}
        {activeTab === 'garages' && <GaragesCrudTab onNotify={notify} />}
        {activeTab === 'menus' && <MenusAndPermissionsTab onNotify={notify} />}
      </div>
    </RequirePageAccess>
  );
}
