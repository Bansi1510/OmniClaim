'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import {
  FileText,
  ShieldAlert,
  BookOpen,
  Settings,
  History,
  ChevronDown,
  ChevronRight,
  Circle,
  Zap,
  Crown,
  Layers,
  Wrench,
  ShieldCheck,
  FilePlus,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  ShieldAlert,
  BookOpen,
  Settings,
  History,
  Circle,
  Crown,
  Layers,
  Wrench,
  ShieldCheck,
  Zap,
  FilePlus,
  ClipboardCheck,
  SlidersHorizontal,
};

const FRIENDLY_MENU_LABELS: Record<string, string> = {
  'Claims Operations': 'Claims',
  'Triage Queue': 'All Claims',
  'Submit New Claim': 'File a Claim',
  'Fraud & SIU Unit': 'Fraud Review',
  'Scorecard Audits': 'Fraud Alerts',
  'pgvector Similarity': 'Duplicate Check',
  'Financial Ledger': 'Payments & Ledger',
  'General Journals': 'Transactions',
  'Setup & Access Control': 'Team & Access',
  'Roles & Rights Setup': 'Roles & Permissions',
  'Permission Matrix Grid': 'Access Matrix',
  'User Role Assignment': 'Users',
  'Audit & Compliance': 'Activity & Audit',
  'Field & Security Logs': 'Activity History',
  'Policies Portfolio': 'My Policies',
  'Underwriting Queue': 'Underwriting Review',
};

function friendlyLabel(label: string): string {
  return FRIENDLY_MENU_LABELS[label] || label;
}

const MASTER_SETUP_ITEMS: Array<{
  href: string;
  label: string;
  permissions: string[];
}> = [
  { href: '/master-setup/users', label: 'Users', permissions: ['rbac:users_assign', 'superadmin:access'] },
  { href: '/master-setup/roles', label: 'Roles & Rights', permissions: ['rbac:roles_create', 'rbac:roles_update', 'superadmin:access'] },
  { href: '/master-setup/permissions', label: 'Permissions', permissions: ['rbac:roles_create', 'rbac:roles_update', 'superadmin:access'] },
  { href: '/master-setup/categories', label: 'Policy Categories', permissions: ['products:manage', 'superadmin:access'] },
  { href: '/master-setup/vehicle-types', label: 'Vehicle Types', permissions: ['products:manage', 'superadmin:access'] },
  { href: '/master-setup/products', label: 'Policy Products', permissions: ['products:manage', 'superadmin:access'] },
  { href: '/master-setup/garages', label: 'Repair Garages', permissions: ['garages:manage', 'superadmin:access'] },
  { href: '/master-setup/parts', label: 'Parts Catalog', permissions: ['parts:manage', 'parts:update', 'superadmin:access'] },
];

const ADMIN_MENU_KEYS = new Set(['setup-rbac', 'audit-compliance']);

const MENU_ORDER: Record<string, number> = {
  apply_policy: 1,
  my_policies: 2,
  underwriting_queue: 3,
  'claims-ops': 4,
  'fraud-siu': 5,
  'ledger-accounting': 6,
  'setup-rbac': 7,
  'audit-compliance': 8,
};

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canView, isSystemAdmin, isMasterLogin, bypassAllPermissions } = usePermissions();
  const { menus } = useDynamicStore();

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'claims-ops': true,
    'fraud-siu': false,
    'ledger-accounting': pathname.startsWith('/ledger'),
    'setup-rbac': pathname.startsWith('/admin'),
    'audit-compliance': pathname.startsWith('/audit'),
    'master-setup': pathname.startsWith('/master-setup'),
  });

  useEffect(() => {
    if (pathname.startsWith('/master-setup')) {
      setOpenSubMenus((prev) => ({ ...prev, 'master-setup': true }));
    } else if (pathname.startsWith('/admin')) {
      setOpenSubMenus((prev) => ({ ...prev, 'setup-rbac': true }));
    } else if (pathname.startsWith('/ledger')) {
      setOpenSubMenus((prev) => ({ ...prev, 'ledger-accounting': true }));
    } else if (pathname.startsWith('/audit')) {
      setOpenSubMenus((prev) => ({ ...prev, 'audit-compliance': true }));
    }
  }, [pathname]);

  const activeMasterSection = pathname === '/master-setup' ? searchParams.get('section') || 'users' : '';

  const toggleSubMenu = (key: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Build hierarchical dynamic menu tree grouped into Operations & Administration
  const { operationsMenus, adminMenus } = useMemo(() => {
    const visibleMenus = menus.filter((m) => m.isVisible);
    const parents = visibleMenus
      .filter((m) => !m.parentKey)
      .sort((a, b) => (MENU_ORDER[a.menuKey] ?? a.sortOrder) - (MENU_ORDER[b.menuKey] ?? b.sortOrder));

    const enriched = parents.map((parent) => ({
      ...parent,
      subItems: visibleMenus
        .filter((child) => child.parentKey === parent.menuKey)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    return {
      operationsMenus: enriched.filter((m) => !ADMIN_MENU_KEYS.has(m.menuKey)),
      adminMenus: enriched.filter((m) => ADMIN_MENU_KEYS.has(m.menuKey)),
    };
  }, [menus]);

  const showSuperAdminShortcut = isSystemAdmin || bypassAllPermissions;

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 min-h-[calc(100vh-3.5rem)] select-none">
      {/* Admin Dashboard Quick Card */}
      {showSuperAdminShortcut && (
        <div className="p-3 border-b border-border bg-amber-500/5">
          <Link
            href="/super-admin"
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition border ${
              pathname === '/super-admin'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              <span>Admin Dashboard</span>
            </div>
            <span className="rounded bg-black/10 dark:bg-black/25 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
              Admin
            </span>
          </Link>
        </div>
      )}

      {/* Dynamic Navigation Sections */}
      <div className="p-4 flex-1 space-y-5 overflow-y-auto">
        {(() => {
          const renderMenuItem = (menu: (typeof operationsMenus)[number]) => {
            if (menu.requiredPermission && !canView(menu.requiredPermission)) {
              return null;
            }

            const IconComponent = ICON_MAP[menu.icon] || Layers;
            const hasSubItems = menu.subItems && menu.subItems.length > 0;
            const isOpen = openSubMenus[menu.menuKey] ?? false;

            const permittedSubItems = menu.subItems?.filter((sub) =>
              sub.requiredPermission ? canView(sub.requiredPermission) : true
            );

            if (hasSubItems && (!permittedSubItems || permittedSubItems.length === 0)) {
              return null;
            }

            if (!hasSubItems && menu.navLink) {
              const isActive = pathname === menu.navLink;
              return (
                <Link
                  key={menu.id}
                  href={menu.navLink}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComponent className="h-4 w-4 text-primary" />
                    <span>{friendlyLabel(menu.label)}</span>
                  </div>
                  {menu.badgeName && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${menu.badgeColor || 'bg-muted text-muted-foreground'}`}>
                      {menu.badgeName}
                    </span>
                  )}
                </Link>
              );
            }

            return (
              <div key={menu.id} className="space-y-0.5">
                <button
                  onClick={() => toggleSubMenu(menu.menuKey)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <div className="flex items-center gap-2.5">
                    <IconComponent className="h-4 w-4 text-primary" />
                    <span>{friendlyLabel(menu.label)}</span>
                  </div>
                  {hasSubItems && (
                    <div>
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                  )}
                </button>

                {hasSubItems && isOpen && (
                  <div className="pl-6 space-y-1 pt-1 border-l border-border/40 ml-4">
                    {permittedSubItems?.map((sub) => {
                      const baseLink = (sub.navLink || '/claims').split('?')[0];
                      const isActive = pathname === baseLink && !(sub.navLink || '').includes('?');
                      return (
                        <Link
                          key={sub.id}
                          href={sub.navLink || '/claims'}
                          className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                            isActive
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Circle
                              className={`h-1.5 w-1.5 ${
                                isActive ? 'fill-primary text-primary' : 'text-muted-foreground/60'
                              }`}
                            />
                            <span>{friendlyLabel(sub.label)}</span>
                          </div>
                          {sub.badgeName && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                sub.badgeColor || 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {sub.badgeName}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };

          const renderedOps = operationsMenus.map(renderMenuItem).filter(Boolean);
          const renderedAdmin = adminMenus.map(renderMenuItem).filter(Boolean);

          const masterAllowed = canView([
            'rbac:users_assign',
            'rbac:roles_create',
            'rbac:roles_update',
            'products:manage',
            'garages:manage',
            'parts:manage',
            'parts:update',
            'superadmin:access',
          ]);
          const visibleMasterItems = masterAllowed
            ? MASTER_SETUP_ITEMS.filter((item) => canView(item.permissions))
            : [];
          const hasMasterSetup = visibleMasterItems.length > 0;
          const isMasterOpen = openSubMenus['master-setup'] ?? pathname === '/master-setup';

          return (
            <>
              {renderedOps.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 block mb-2">
                    Operations
                  </span>
                  <nav className="space-y-1">{renderedOps}</nav>
                </div>
              )}

              {(hasMasterSetup || renderedAdmin.length > 0) && (
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 block mb-2">
                    Administration
                  </span>
                  <nav className="space-y-1">
                    {hasMasterSetup && (
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSubMenu('master-setup')}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            pathname.startsWith('/master-setup')
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            <span>Master Setup</span>
                          </div>
                          {isMasterOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isMasterOpen && (
                          <div className="pl-6 space-y-1 pt-1 border-l border-border/40 ml-4">
                            {visibleMasterItems.map((item) => {
                              const isActive = pathname === item.href;
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                                    isActive
                                      ? 'bg-primary/10 text-primary font-bold'
                                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Circle
                                      className={`h-1.5 w-1.5 ${
                                        isActive
                                          ? 'fill-primary text-primary'
                                          : 'text-muted-foreground/60'
                                      }`}
                                    />
                                    <span>{item.label}</span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {renderedAdmin}
                  </nav>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Sidebar Footer Status */}
      <div className="p-3 border-t border-border text-[11px] text-muted-foreground bg-muted/30">
        {showSuperAdminShortcut ? (
          <>
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold mb-1">
              <Crown className="h-3.5 w-3.5" />
              <span>Admin Access Active</span>
            </div>
            <span>Full portal controls unlocked</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
              <Zap className="h-3 w-3" />
              <span>Role-Based Access</span>
            </div>
            <span>Workspace tailored to your role</span>
          </>
        )}
      </div>
    </aside>
  );
}
