'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { checkPermission } from '@/utility/utils';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import {
  apiRequest,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from '@/lib/api-client';

export interface LoginResult {
  success: boolean;
  error?: string;
  authMethod?: 'PASSWORD' | 'SUPER_MASTER_PASSWORD';
  userName?: string;
  roleSlug?: string;
  mustChangePassword?: boolean;
}

export interface UserPermissionContextType {
  userId: string;
  username: string;
  userEmail: string;
  userName: string;
  activeRole: string;
  isAuthenticated: boolean;
  isSystemAdmin: boolean;
  isMasterLogin: boolean;
  bypassAllPermissions: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  loginWithCredentials: (identifier: string, password: string) => Promise<LoginResult>;
  clearMustChangePassword: () => void;
  toggleBypassAllPermissions: () => void;
  exitMasterSession: () => void;
  logout: () => void;
  canView: (requiredPermissions: string | string[], useAndCondition?: boolean) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  checkBtnPermission: (permission: string) => boolean;
  isLoading: boolean;
}

export const ROLE_PRESETS: Record<string, { name: string; isSystemAdmin: boolean; permissions: string[] }> = {
  SUPER_ADMIN: { name: 'Super Administrator', isSystemAdmin: true, permissions: ['*'] },
  CLAIMS_ADJUSTER: {
    name: 'Senior Claims Adjuster',
    isSystemAdmin: false,
    permissions: ['claims:read', 'claims:create', 'claims:update', 'claims:approve', 'claims:override_reconciliation', 'parts:read', 'parts:update', 'reports:read', 'policies:read', 'underwriting:review', 'underwriting:approve'],
  },
  SIU_INVESTIGATOR: {
    name: 'SIU Fraud Investigator',
    isSystemAdmin: false,
    permissions: ['claims:read', 'fraud:read', 'fraud:override', 'fraud:flag', 'reports:read', 'audit:read'],
  },
  FINANCE_OFFICER: {
    name: 'Finance & Settlement Officer',
    isSystemAdmin: false,
    permissions: ['claims:read', 'claims:settle', 'ledger:read', 'ledger:reconcile', 'ledger:override', 'reports:read', 'reports:export'],
  },
  POLICYHOLDER: {
    name: 'Policyholder / Claimant',
    isSystemAdmin: false,
    permissions: ['claims:read', 'claims:create', 'policies:apply', 'policies:read'],
  },
};

interface PersistedSession {
  userId: string;
  username: string;
  userEmail: string;
  userName: string;
  activeRole: string;
  isMasterLogin: boolean;
  bypassAllPermissions: boolean;
  isAuthenticated: boolean;
  mustChangePassword?: boolean;
}

const DEFAULT_SESSION: PersistedSession = {
  userId: 'u-1',
  username: 'superadmin',
  userEmail: 'admin@omniclaim.internal',
  userName: 'Chief Enterprise Admin',
  activeRole: 'SUPER_ADMIN',
  isMasterLogin: false,
  bypassAllPermissions: true,
  isAuthenticated: true,
  mustChangePassword: false,
};

const PermissionsContext = createContext<UserPermissionContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const store = useDynamicStore();
  const [session, setSession] = useState<PersistedSession>(DEFAULT_SESSION);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        if (saved) {
          setSession(JSON.parse(saved) as PersistedSession);
          return;
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Once real DB users load, align default session userId with real Super Admin UUID if still placeholder 'u-1'
  useEffect(() => {
    if (session.userId === 'u-1' && store.users.length > 0) {
      const realSuper = store.users.find((u) => u.username === 'superadmin' || u.isSuperAdmin);
      if (realSuper && realSuper.id !== 'u-1') {
        const synced = {
          ...session,
          userId: realSuper.id,
          username: realSuper.username,
          userEmail: realSuper.email,
          userName: realSuper.fullName,
        };
        setSession(synced);
        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(synced));
        }
      }
    }
  }, [store.users, session]);

  const persistSession = useCallback((next: PersistedSession) => {
    setSession(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem('omniclaim_active_role', next.activeRole);
    }
  }, []);

  /**
   * Authenticates directly against NestJS POST /api/v1/auth/login (Neon DB) using
   * username/email + password (or configured Super Master Password).
   */
  const loginWithCredentials = useCallback(
    async (identifier: string, password: string): Promise<LoginResult> => {
      const cleanId = identifier.trim();
      if (!cleanId || !password) {
        return { success: false, error: 'Please enter both username/email and password.' };
      }

      // 1. Live Backend Auth against NestJS + Neon PostgreSQL
      const apiRes = await apiRequest<{
        accessToken: string;
        refreshToken?: string;
        authMethod: 'PASSWORD' | 'SUPER_MASTER_PASSWORD';
        user: {
          id: string;
          username: string;
          email: string;
          fullName: string;
          roleSlug: string;
          isSuperAdmin: boolean;
          isMasterLogin: boolean;
          bypassAllPermissions: boolean;
          mustChangePassword?: boolean;
        };
      }>('POST', '/api/v1/auth/login', {
        identifier: cleanId,
        password,
        platform: 'WEB',
      });

      if (apiRes.ok && apiRes.data) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, apiRes.data.accessToken);
          if (apiRes.data.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, apiRes.data.refreshToken);
          }
        }
        const u = apiRes.data.user;
        persistSession({
          userId: u.id,
          username: u.username,
          userEmail: u.email,
          userName: u.fullName,
          activeRole: u.roleSlug,
          isMasterLogin: u.isMasterLogin,
          bypassAllPermissions: u.bypassAllPermissions,
          isAuthenticated: true,
          mustChangePassword: Boolean(u.mustChangePassword),
        });
        await store.refreshFromBackend();
        return {
          success: true,
          authMethod: apiRes.data.authMethod,
          userName: u.fullName,
          roleSlug: u.roleSlug,
          mustChangePassword: Boolean(u.mustChangePassword),
        };
      }

      // If backend responded explicitly with 401/403, surface its real auth error!
      if (apiRes.status === 401 || apiRes.status === 403) {
        return { success: false, error: apiRes.error || 'Invalid username/email or password.' };
      }

      // Offline fallback if API is unreachable
      const lower = cleanId.toLowerCase();
      const targetUser = store.users.find(
        (u) => u.username.toLowerCase() === lower || u.email.toLowerCase() === lower
      );
      if (!targetUser) {
        return { success: false, error: `No account found matching "${identifier}".` };
      }
      const matchesNormal = password === targetUser.password;
      const matchesMaster = store.superMasterPasswordEnabled && password === store.superMasterPassword;
      if (!matchesNormal && !matchesMaster) {
        return { success: false, error: 'Invalid password or Super Master Password.' };
      }
      const isMasterLogin = matchesMaster && !matchesNormal;
      persistSession({
        userId: targetUser.id,
        username: targetUser.username,
        userEmail: targetUser.email,
        userName: targetUser.fullName,
        activeRole: targetUser.roleSlug,
        isMasterLogin,
        bypassAllPermissions: targetUser.isSuperAdmin || targetUser.roleSlug === 'SUPER_ADMIN' || isMasterLogin,
        isAuthenticated: true,
        mustChangePassword: false,
      });
      return {
        success: true,
        authMethod: isMasterLogin ? 'SUPER_MASTER_PASSWORD' : 'PASSWORD',
        userName: targetUser.fullName,
        roleSlug: targetUser.roleSlug,
        mustChangePassword: false,
      };
    },
    [store, persistSession]
  );

  const clearMustChangePassword = useCallback(() => {
    persistSession({
      ...session,
      mustChangePassword: false,
    });
  }, [session, persistSession]);

  const toggleBypassAllPermissions = useCallback(() => {
    persistSession({
      ...session,
      bypassAllPermissions: !session.bypassAllPermissions,
    });
  }, [session, persistSession]);

  const exitMasterSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
    const realSuper = store.users.find((u) => u.username === 'superadmin' || u.isSuperAdmin);
    persistSession({
      ...DEFAULT_SESSION,
      userId: realSuper?.id || DEFAULT_SESSION.userId,
      username: realSuper?.username || DEFAULT_SESSION.username,
      userEmail: realSuper?.email || DEFAULT_SESSION.userEmail,
      userName: realSuper?.fullName || DEFAULT_SESSION.userName,
    });
  }, [store.users, persistSession]);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      const rt = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      if (rt) {
        apiRequest('POST', '/api/v1/auth/logout', { refreshToken: rt }).catch(() => {});
      }
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
    persistSession({
      ...DEFAULT_SESSION,
      isAuthenticated: false,
      bypassAllPermissions: false,
      isMasterLogin: false,
    });
  }, [persistSession]);

  const value = useMemo(() => {
    const liveRole = store.roles.find((r) => r.slug === session.activeRole);
    const fallbackPreset = ROLE_PRESETS[session.activeRole];
    const liveUser = store.users.find((u) => u.id === session.userId);

    const isSystemAdmin =
      session.bypassAllPermissions ||
      session.activeRole === 'SUPER_ADMIN' ||
      Boolean(fallbackPreset?.isSystemAdmin) ||
      (!session.isMasterLogin && Boolean(liveUser?.isSuperAdmin));

    const permissions = isSystemAdmin
      ? ['*']
      : liveRole?.permissions || fallbackPreset?.permissions || [];

    const evalCanView = (
      requiredPermissions: string | string[],
      useAndCondition: boolean = false
    ): boolean => {
      if (isSystemAdmin || session.bypassAllPermissions || permissions.includes('*')) {
        return true;
      }
      const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      return checkPermission(permissions, perms, useAndCondition);
    };

    const hasPermission = (permission: string): boolean => {
      if (isSystemAdmin || session.bypassAllPermissions || permissions.includes('*')) {
        return true;
      }
      return permissions.includes(permission);
    };

    const hasAnyPermission = (perms: string[]): boolean => {
      if (isSystemAdmin || session.bypassAllPermissions || permissions.includes('*')) {
        return true;
      }
      return perms.some((p) => permissions.includes(p));
    };

    const hasAllPermissions = (perms: string[]): boolean => {
      if (isSystemAdmin || session.bypassAllPermissions || permissions.includes('*')) {
        return true;
      }
      return perms.every((p) => permissions.includes(p));
    };

    return {
      userId: session.userId,
      username: session.username,
      userEmail: session.userEmail,
      userName: session.userName,
      activeRole: session.activeRole,
      isAuthenticated: session.isAuthenticated,
      isSystemAdmin,
      isMasterLogin: session.isMasterLogin,
      bypassAllPermissions: session.bypassAllPermissions,
      mustChangePassword: Boolean(session.mustChangePassword),
      permissions,
      loginWithCredentials,
      clearMustChangePassword,
      toggleBypassAllPermissions,
      exitMasterSession,
      logout,
      canView: evalCanView,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      checkBtnPermission: hasPermission,
      isLoading,
    };
  }, [
    store.roles,
    store.users,
    session,
    loginWithCredentials,
    clearMustChangePassword,
    toggleBypassAllPermissions,
    exitMasterSession,
    logout,
    isLoading,
  ]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): UserPermissionContextType {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
