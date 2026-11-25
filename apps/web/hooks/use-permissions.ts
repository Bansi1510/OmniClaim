'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { checkPermission } from '@/utility/utils';

export interface UserPermissionContextType {
  userId: string;
  userEmail: string;
  userName: string;
  activeRole: string;
  isSystemAdmin: boolean;
  permissions: string[];
  switchRole: (role: string) => void;
  canView: (requiredPermissions: string | string[], useAndCondition?: boolean) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  checkBtnPermission: (permission: string) => boolean;
  isLoading: boolean;
}

export const ROLE_PRESETS: Record<string, { name: string; isSystemAdmin: boolean; permissions: string[] }> = {
  SUPER_ADMIN: {
    name: 'Super Administrator',
    isSystemAdmin: true,
    permissions: ['*'], // Wildcard - can do everything
  },
  CLAIMS_ADJUSTER: {
    name: 'Senior Claims Adjuster',
    isSystemAdmin: false,
    permissions: [
      'claims:read',
      'claims:create',
      'claims:update',
      'claims:approve',
      'claims:override_reconciliation',
      'parts:read',
      'parts:update',
      'reports:read',
    ],
  },
  SIU_INVESTIGATOR: {
    name: 'SIU Fraud Investigator',
    isSystemAdmin: false,
    permissions: [
      'claims:read',
      'fraud:read',
      'fraud:override',
      'fraud:flag',
      'reports:read',
      'audit:read',
    ],
  },
  FINANCE_OFFICER: {
    name: 'Finance & Settlement Officer',
    isSystemAdmin: false,
    permissions: [
      'claims:read',
      'claims:settle',
      'ledger:read',
      'ledger:reconcile',
      'ledger:override',
      'reports:read',
      'reports:export',
    ],
  },
  POLICYHOLDER: {
    name: 'Policyholder / Claimant',
    isSystemAdmin: false,
    permissions: [
      'claims:read',
      'claims:create',
    ],
  },
};

const PermissionsContext = createContext<UserPermissionContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [activeRole, setActiveRole] = useState<string>('SUPER_ADMIN');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load active role from localStorage on mount if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('omniclaim_active_role');
      if (savedRole && ROLE_PRESETS[savedRole]) {
        setActiveRole(savedRole);
      }
    }
  }, []);

  const switchRole = (newRole: string) => {
    if (ROLE_PRESETS[newRole]) {
      setIsLoading(true);
      setActiveRole(newRole);
      if (typeof window !== 'undefined') {
        localStorage.setItem('omniclaim_active_role', newRole);
      }
      setTimeout(() => setIsLoading(false), 150);
    }
  };

  const currentConfig = ROLE_PRESETS[activeRole] || ROLE_PRESETS.SUPER_ADMIN;

  const value = useMemo(() => {
    const isSystemAdmin = currentConfig.isSystemAdmin || activeRole === 'SUPER_ADMIN';
    const permissions = currentConfig.permissions;

    const evalCanView = (requiredPermissions: string | string[], useAndCondition: boolean = false): boolean => {
      if (isSystemAdmin || permissions.includes('*')) return true;
      const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      return checkPermission(permissions, perms, useAndCondition);
    };

    const hasPermission = (permission: string): boolean => {
      if (isSystemAdmin || permissions.includes('*')) return true;
      return permissions.includes(permission);
    };

    const hasAnyPermission = (perms: string[]): boolean => {
      if (isSystemAdmin || permissions.includes('*')) return true;
      return perms.some((p) => permissions.includes(p));
    };

    const hasAllPermissions = (perms: string[]): boolean => {
      if (isSystemAdmin || permissions.includes('*')) return true;
      return perms.every((p) => permissions.includes(p));
    };

    return {
      userId: 'usr_mock_001',
      userEmail: 'admin@omniclaim.internal',
      userName: 'Alexander Wright',
      activeRole,
      isSystemAdmin,
      permissions,
      switchRole,
      canView: evalCanView,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      checkBtnPermission: hasPermission,
      isLoading,
    };
  }, [activeRole, currentConfig, isLoading]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): UserPermissionContextType {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
