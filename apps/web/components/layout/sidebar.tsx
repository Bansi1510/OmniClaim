'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
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
} from 'lucide-react';

interface SidebarMenuItem {
  id: string;
  label: string;
  icon: any;
  requiredPermission?: string;
  navLink?: string;
  subItems?: Array<{
    id: string;
    label: string;
    navLink: string;
    requiredPermission?: string;
    badgeName?: string;
    badgeColor?: string;
  }>;
}

// Master Menu Navigation declaration matching LayoutMenuData.jsx from College ERP
const MASTER_MENU_ITEMS: SidebarMenuItem[] = [
  {
    id: 'claims-ops',
    label: 'Claims Operations',
    icon: FileText,
    requiredPermission: 'claims:read',
    subItems: [
      {
        id: 'triage-queue',
        label: 'Triage Queue',
        navLink: '/claims',
        requiredPermission: 'claims:read',
      },
      {
        id: 'initiate-claim',
        label: 'Submit New Claim',
        navLink: '/claims',
        requiredPermission: 'claims:create',
        badgeName: 'Intake',
        badgeColor: 'bg-primary/20 text-primary',
      },
    ],
  },
  {
    id: 'fraud-siu',
    label: 'Fraud & SIU Unit',
    icon: ShieldAlert,
    requiredPermission: 'fraud:read',
    subItems: [
      {
        id: 'fraud-scorecards',
        label: 'Scorecard Audits',
        navLink: '/claims',
        requiredPermission: 'fraud:read',
      },
      {
        id: 'pgvector-search',
        label: 'pgvector Similarity',
        navLink: '/claims',
        requiredPermission: 'fraud:read',
        badgeName: 'Vector',
        badgeColor: 'bg-teal-500/20 text-teal-400',
      },
    ],
  },
  {
    id: 'ledger-accounting',
    label: 'Financial Ledger',
    icon: BookOpen,
    requiredPermission: 'ledger:read',
    subItems: [
      {
        id: 'general-journals',
        label: 'General Journals',
        navLink: '/ledger',
        requiredPermission: 'ledger:read',
      },
      {
        id: 'payout-vouchers',
        label: 'Settlement Vouchers',
        navLink: '/ledger',
        requiredPermission: 'ledger:read',
      },
    ],
  },
  {
    id: 'setup-rbac',
    label: 'Setup & Access Control',
    icon: Settings,
    requiredPermission: 'rbac:roles_create',
    subItems: [
      {
        id: 'roles-rights',
        label: 'Roles & Rights Setup',
        navLink: '/admin/roles',
        requiredPermission: 'rbac:roles_create',
      },
      {
        id: 'permission-matrix',
        label: 'Permission Matrix Grid',
        navLink: '/admin/rbac',
        requiredPermission: 'rbac:roles_create',
      },
      {
        id: 'user-access',
        label: 'User Role Assignment',
        navLink: '/admin/users',
        requiredPermission: 'rbac:users_assign',
      },
    ],
  },
  {
    id: 'audit-compliance',
    label: 'Audit & Compliance',
    icon: History,
    requiredPermission: 'audit:read',
    subItems: [
      {
        id: 'field-audit',
        label: 'Field Modification Logs',
        navLink: '/audit',
        requiredPermission: 'audit:read',
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { canView } = usePermissions();

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'claims-ops': true,
    'setup-rbac': true,
    'fraud-siu': true,
  });

  const toggleSubMenu = (id: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="w-64 border-r border-border/60 bg-card/60 flex flex-col shrink-0 min-h-[calc(100vh-3.5rem)] select-none">
      {/* Sidebar Navigation Section */}
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 block mb-2">
            Main Navigation
          </span>
          <nav className="space-y-1">
            {MASTER_MENU_ITEMS.map((menu) => {
              // 1. Check if user is authorized to view this master menu section
              if (menu.requiredPermission && !canView(menu.requiredPermission)) {
                return null; // Menu is completely hidden when user lacks permission!
              }

              const IconComponent = menu.icon;
              const hasSubItems = menu.subItems && menu.subItems.length > 0;
              const isOpen = openSubMenus[menu.id] ?? false;

              // Filter permitted subitems
              const permittedSubItems = menu.subItems?.filter((sub) =>
                sub.requiredPermission ? canView(sub.requiredPermission) : true
              );

              // If parent has subitems but all are hidden by RBAC, hide parent
              if (hasSubItems && (!permittedSubItems || permittedSubItems.length === 0)) {
                return null;
              }

              return (
                <div key={menu.id} className="space-y-0.5">
                  <button
                    onClick={() => toggleSubMenu(menu.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className="h-4 w-4 text-primary" />
                      <span>{menu.label}</span>
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

                  {/* Render SubItems matching navigationIndex.jsx renderSubMenu */}
                  {hasSubItems && isOpen && (
                    <div className="pl-6 space-y-1 pt-1 border-l border-border/40 ml-4">
                      {permittedSubItems?.map((sub) => {
                        const isActive = pathname === sub.navLink;
                        return (
                          <Link
                            key={sub.id}
                            href={sub.navLink}
                            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                              isActive
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Circle className={`h-1.5 w-1.5 ${isActive ? 'fill-primary text-primary' : 'text-muted-foreground/60'}`} />
                              <span>{sub.label}</span>
                            </div>
                            {sub.badgeName && (
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${sub.badgeColor || 'bg-muted text-muted-foreground'}`}
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
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer Info */}
      <div className="p-3 border-t border-border/50 text-[11px] text-muted-foreground bg-muted/20">
        <div className="flex items-center gap-1.5 text-emerald-500 font-semibold mb-1">
          <Zap className="h-3 w-3" />
          <span>Dynamic RBAC Active</span>
        </div>
        <span>Menus hide/show automatically per role permissions</span>
      </div>
    </aside>
  );
}
