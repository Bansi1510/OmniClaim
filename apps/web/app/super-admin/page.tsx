'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/common/breadcrumb';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
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
  Settings,
  Wrench,
  Sliders,
  Building2,
  Menu as MenuIcon,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  LogIn,
  Lock,
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
    isSystemAdmin,
    isMasterLogin,
    bypassAllPermissions,
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

  const hasSuperAccess = isSystemAdmin || isMasterLogin || bypassAllPermissions;

  if (!hasSuperAccess) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-rose-500/30 bg-card p-8 text-center space-y-4">
        <Lock className="h-10 w-10 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Super Admin Authority Required</h1>
        <p className="text-xs text-muted-foreground">
          This command center skips all RBAC permission gates and is exclusively restricted to Super Administrators or Super Master Password sessions.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-slate-950 font-bold px-4 py-2 text-xs hover:bg-amber-400 transition"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Sign In via Super Master Password</span>
        </Link>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <Breadcrumb
        title="Super Admin Command Center"
        items={[{ label: 'Super Admin' }, { label: 'All-Access Dynamic Control' }]}
      />

      {/* Super Admin God Mode Hero Banner */}
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-slate-950 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider">
              <Crown className="h-3.5 w-3.5" />
              All Permissions Bypassed
            </span>
            <span className="text-xs font-mono text-amber-400 font-semibold">
              @{username}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Enterprise Super Admin Dashboard
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Full unrestricted access skipping all RBAC checks. Add, edit, update, or delete any setting, policy, part, depreciation bracket, fraud/STP rule, garage, menu, role, user, claim, or rotate the Super Master Password in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/claims" className="rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
            Claims <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/admin/users" className="rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
            Users <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/admin/roles" className="rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
            Roles <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/ledger" className="rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
            Ledger <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={() => {
              if (confirm('Reset all dynamic local demo changes back to factory seed defaults?')) {
                store.resetStoreToDefaults();
                notify('All dynamic stores reset to factory seed defaults.');
              }
            }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
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
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                <span>{kpi.label}</span>
                <IconComp className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
              <div className="text-xl font-black font-mono text-foreground mt-1">{kpi.value}</div>
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
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* One-Click Impersonation Launchpad */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <LogIn className="h-4 w-4 text-amber-400" />
                <span>One-Click Impersonate Any User Account</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Instantly enter the website as any user — choose God Mode (skip all permissions) or Target View (exact role rights).
              </p>
            </div>
            <div className="space-y-2">
              {store.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 p-3 text-xs">
                  <div>
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <span>{u.fullName}</span>
                      {u.isSuperAdmin && <Crown className="h-3 w-3 text-amber-400" />}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      @{u.username} · {u.email} · {u.roleSlug}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        impersonateUser(u.id, true);
                        notify(`Entered as @${u.username} with Super Admin God Mode active.`);
                        router.push('/claims');
                      }}
                      className="rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold"
                    >
                      God Mode
                    </button>
                    <button
                      onClick={() => {
                        impersonateUser(u.id, false);
                        notify(`Viewing exact permissions of @${u.username} (${u.roleSlug}).`);
                        router.push('/claims');
                      }}
                      className="rounded bg-muted hover:bg-muted/80 text-foreground px-2.5 py-1 text-[11px] font-semibold"
                    >
                      Target View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security & Super Master Password Audit Stream */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span>Security &amp; Master Password Audit Stream</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Live cryptographic log of all logins, Master Password overrides, impersonations, and key rotations.
              </p>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {store.securityAuditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                          log.eventType === 'LOGIN_SUPER_MASTER_PASSWORD'
                            ? 'bg-amber-500/20 text-amber-400'
                            : log.eventType === 'LOGIN_FAILED'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {log.eventType}
                      </span>
                      <span className="font-mono font-bold text-foreground">@{log.actorIdentifier}</span>
                      <span className="text-[10px] text-muted-foreground">({log.platform})</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {log.metadata ? JSON.stringify(log.metadata) : 'Authenticated session'}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {log.createdAt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPER MASTER PASSWORD & DYNAMIC SYSTEM SETTINGS */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Master Password Configuration Card */}
          <form
            onSubmit={handleSaveMasterPassword}
            className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  <span>Super Master Password Control</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Super Admin can enter ANY user&apos;s username/email with this master password to enter the website or mobile app immediately.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={masterEnabled}
                  onChange={(e) => setMasterEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-amber-500"
                />
                <span>Master Login Enabled</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type={showMasterPwd ? 'text' : 'password'}
                  required
                  value={newMasterPwd}
                  onChange={(e) => setNewMasterPwd(e.target.value)}
                  placeholder="Enter new Super Master Password..."
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 pr-10 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2 text-xs shadow transition"
              >
                Rotate Master Password Now
              </button>
            </div>
          </form>

          {/* Dynamic System Settings CRUD */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <span>Dynamic System Settings (Edit Values Live Anytime)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Change brand name, STP limits, fraud thresholds, maintenance mode, or add custom keys.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSetting} className="rounded-xl border border-border bg-muted/20 p-3 grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
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
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground font-bold px-3 py-1.5 flex items-center justify-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add / Update Key
              </button>
            </form>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Key &amp; Label</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Live Editable Value</th>
                    <th className="py-2.5 px-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {store.settings.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-primary block">{s.key}</span>
                        <span className="text-muted-foreground text-[11px]">{s.label}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">{s.category}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {s.valueType === 'BOOLEAN' ? (
                          <button
                            onClick={() => {
                              const next = s.value === 'true' ? 'false' : 'true';
                              store.upsertSetting({ ...s, value: next });
                              notify(`${s.label} set to ${next.toUpperCase()}.`);
                            }}
                            className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${
                              s.value === 'true'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
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
                            className="w-60 rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            store.deleteSetting(s.id);
                            notify(`Setting ${s.key} deleted.`);
                          }}
                          className="rounded bg-rose-500/10 text-rose-500 p-1.5 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  );
}
