'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
};

export function Sidebar() {
  const pathname = usePathname();
  const { canView, isSystemAdmin, isMasterLogin, bypassAllPermissions } = usePermissions();
  const { menus } = useDynamicStore();

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'claims-ops': true,
    'setup-rbac': true,
    'fraud-siu': true,
    'ledger-accounting': true,
    'audit-compliance': true,
  });

  const toggleSubMenu = (key: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Build hierarchical dynamic menu tree from live store (respecting sortOrder & isVisible)
  const menuTree = useMemo(() => {
    const visibleMenus = menus.filter((m) => m.isVisible);
    const parents = visibleMenus
      .filter((m) => !m.parentKey)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return parents.map((parent) => ({
      ...parent,
      subItems: visibleMenus
        .filter((child) => child.parentKey === parent.menuKey)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [menus]);

  const showSuperAdminShortcut = isSystemAdmin || bypassAllPermissions;

  return (
    <aside className="w-64 border-r border-border/60 bg-card/60 flex flex-col shrink-0 min-h-[calc(100vh-3.5rem)] select-none">
      {/* Super Admin Command Center Quick Card (Skips ALL permissions) */}
      {showSuperAdminShortcut && (
        <div className="p-3 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent">
          <Link
            href="/super-admin"
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition border ${
              pathname === '/super-admin'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
            }`}
          >
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              <span>Super Admin Center</span>
            </div>
            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
              ALL ACCESS
            </span>
          </Link>
        </div>
      )}

      {/* Dynamic Navigation Section */}
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 block mb-2">
            Main Navigation
          </span>
          <nav className="space-y-1">
            {menuTree.map((menu) => {
              // 1. Check if user is authorized to view this master menu section (Super Admin skips all checks!)
              if (menu.requiredPermission && !canView(menu.requiredPermission)) {
                return null;
              }

              const IconComponent = ICON_MAP[menu.icon] || Layers;
              const hasSubItems = menu.subItems && menu.subItems.length > 0;
              const isOpen = openSubMenus[menu.menuKey] ?? true;

              const permittedSubItems = menu.subItems?.filter((sub) =>
                sub.requiredPermission ? canView(sub.requiredPermission) : true
              );

              if (hasSubItems && (!permittedSubItems || permittedSubItems.length === 0)) {
                return null;
              }

              // Direct leaf link if no subitems
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
                      <span>{menu.label}</span>
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
                              <span>{sub.label}</span>
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
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer Status */}
      <div className="p-3 border-t border-border/50 text-[11px] text-muted-foreground bg-muted/20">
        {showSuperAdminShortcut ? (
          <>
            <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
              <Crown className="h-3.5 w-3.5" />
              <span>Super Admin Bypass Active</span>
            </div>
            <span>All permission checks skipped — unrestricted access</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-emerald-500 font-semibold mb-1">
              <Zap className="h-3 w-3" />
              <span>Dynamic RBAC Active</span>
            </div>
            <span>Menus & buttons adapt automatically per role rights</span>
          </>
        )}
      </div>
    </aside>
  );
}
