'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { checkPermission } from '@/utility/utils';
import { useDynamicStore } from '@/hooks/use-dynamic-store';

export interface LoginResult {
  success: boolean;
  error?: string;
  authMethod?: 'PASSWORD' | 'SUPER_MASTER_PASSWORD';
  userName?: string;
  roleSlug?: string;
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
  permissions: string[];
  switchRole: (role: string) => void;
  loginWithCredentials: (identifier: string, password: string) => Promise<LoginResult>;
  impersonateUser: (userId: string, bypassAll?: boolean) => boolean;
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
  SUPER_ADMIN: {
    name: 'Super Administrator',
    isSystemAdmin: true,
    permissions: ['*'],
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
    permissions: ['claims:read', 'claims:create'],
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
}

const SESSION_KEY = 'omniclaim_auth_session_v2';

const DEFAULT_SESSION: PersistedSession = {
  userId: 'u-1',
  username: 'superadmin',
  userEmail: 'admin@omniclaim.internal',
  userName: 'Chief Enterprise Admin',
  activeRole: 'SUPER_ADMIN',
  isMasterLogin: false,
  bypassAllPermissions: true,
  isAuthenticated: true,
};

const PermissionsContext = createContext<UserPermissionContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const store = useDynamicStore();
  const [session, setSession] = useState<PersistedSession>(DEFAULT_SESSION);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
          setSession(JSON.parse(saved) as PersistedSession);
          return;
        }
        const legacyRole = localStorage.getItem('omniclaim_active_role');
        if (legacyRole && ROLE_PRESETS[legacyRole]) {
          setSession((prev) => ({
            ...prev,
            activeRole: legacyRole,
            bypassAllPermissions: legacyRole === 'SUPER_ADMIN',
          }));
        }
      } catch {
        // Use default
      }
    }
  }, []);

  const persistSession = useCallback((next: PersistedSession) => {
    setSession(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      localStorage.setItem('omniclaim_active_role', next.activeRole);
    }
  }, []);

  const switchRole = useCallback(
    (newRole: string) => {
      setIsLoading(true);
      const matchedRole = store.roles.find((r) => r.slug === newRole) || ROLE_PRESETS[newRole];
      if (matchedRole) {
        const matchedUser = store.users.find((u) => u.roleSlug === newRole);
        persistSession({
          userId: matchedUser?.id || session.userId,
          username: matchedUser?.username || newRole.toLowerCase(),
          userEmail: matchedUser?.email || session.userEmail,
          userName: matchedUser?.fullName || matchedRole.name,
          activeRole: newRole,
          isMasterLogin: false,
          bypassAllPermissions: newRole === 'SUPER_ADMIN',
          isAuthenticated: true,
        });
      }
      setTimeout(() => setIsLoading(false), 100);
    },
    [store.roles, store.users, session.userId, session.userEmail, persistSession]
  );

  /**
   * Authenticates using ANY user's username or email with EITHER their normal password
   * OR the dynamic Super Master Password (which grants instant entry + Super Admin God Mode!).
   */
  const loginWithCredentials = useCallback(
    async (identifier: string, password: string): Promise<LoginResult> => {
      const cleanId = identifier.trim().toLowerCase();
      if (!cleanId || !password) {
        return { success: false, error: 'Please enter both username/email and password.' };
      }

      const targetUser = store.users.find(
        (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
      );

      if (!targetUser) {
        store.appendSecurityAudit({
          eventType: 'LOGIN_FAILED',
          actorIdentifier: identifier,
          platform: 'WEB',
          metadata: { reason: 'USERNAME_NOT_FOUND' },
        });
        return { success: false, error: `No account found matching username or email "${identifier}".` };
      }

      const matchesNormal = password === targetUser.password;
      const matchesMaster =
        store.superMasterPasswordEnabled && password === store.superMasterPassword;

      if (!matchesNormal && !matchesMaster) {
        store.appendSecurityAudit({
          eventType: 'LOGIN_FAILED',
          targetUserId: targetUser.id,
          actorIdentifier: identifier,
          platform: 'WEB',
          metadata: { reason: 'INVALID_PASSWORD' },
        });
        return { success: false, error: 'Invalid password or Super Master Password.' };
      }

      if (!targetUser.isActive && !matchesMaster) {
        return { success: false, error: 'This user account is deactivated. Contact a Super Admin.' };
      }

      const isMasterLogin = matchesMaster && !matchesNormal;
      const isSuper = targetUser.isSuperAdmin || targetUser.roleSlug === 'SUPER_ADMIN';
      const bypassAll = isSuper || isMasterLogin;

      persistSession({
        userId: targetUser.id,
        username: targetUser.username,
        userEmail: targetUser.email,
        userName: targetUser.fullName,
        activeRole: targetUser.roleSlug,
        isMasterLogin,
        bypassAllPermissions: bypassAll,
        isAuthenticated: true,
      });

      store.appendSecurityAudit({
        eventType: isMasterLogin ? 'LOGIN_SUPER_MASTER_PASSWORD' : 'LOGIN_PASSWORD',
        targetUserId: targetUser.id,
        actorIdentifier: targetUser.username,
        platform: 'WEB',
        metadata: {
          targetEmail: targetUser.email,
          targetRole: targetUser.roleSlug,
          bypassAllPermissions: bypassAll,
        },
      });

      // Best-effort live sync with NestJS backend if online
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        fetch(`${apiUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password, platform: 'WEB' }),
        }).catch(() => {});
      } catch {
        // Offline-safe
      }

      return {
        success: true,
        authMethod: isMasterLogin ? 'SUPER_MASTER_PASSWORD' : 'PASSWORD',
        userName: targetUser.fullName,
        roleSlug: targetUser.roleSlug,
      };
    },
    [store, persistSession]
  );

  const impersonateUser = useCallback(
    (userId: string, bypassAll: boolean = true): boolean => {
      const targetUser = store.users.find((u) => u.id === userId);
      if (!targetUser) return false;

      persistSession({
        userId: targetUser.id,
        username: targetUser.username,
        userEmail: targetUser.email,
        userName: targetUser.fullName,
        activeRole: targetUser.roleSlug,
        isMasterLogin: true,
        bypassAllPermissions: bypassAll,
        isAuthenticated: true,
      });

      store.appendSecurityAudit({
        eventType: 'IMPERSONATION_START',
        targetUserId: targetUser.id,
        actorIdentifier: session.username,
        platform: 'WEB',
        metadata: { targetUsername: targetUser.username, bypassAllPermissions: bypassAll },
      });

      return true;
    },
    [store, session.username, persistSession]
  );

  const toggleBypassAllPermissions = useCallback(() => {
    persistSession({
      ...session,
      bypassAllPermissions: !session.bypassAllPermissions,
    });
  }, [session, persistSession]);

  const exitMasterSession = useCallback(() => {
    persistSession(DEFAULT_SESSION);
  }, [persistSession]);

  const logout = useCallback(() => {
    persistSession({
      ...DEFAULT_SESSION,
      isAuthenticated: false,
      bypassAllPermissions: false,
      isMasterLogin: false,
    });
  }, [persistSession]);

  const value = useMemo(() => {
    const liveRole = store.roles.find((r) => r.slug === session.activeRole);
    const fallbackPreset = ROLE_PRESETS[session.activeRole] || ROLE_PRESETS.SUPER_ADMIN;
    const liveUser = store.users.find((u) => u.id === session.userId);

    const isSystemAdmin =
      session.activeRole === 'SUPER_ADMIN' ||
      Boolean(liveUser?.isSuperAdmin) ||
      Boolean(fallbackPreset?.isSystemAdmin) ||
      session.bypassAllPermissions;

    const permissions = isSystemAdmin
      ? ['*']
      : liveRole?.permissions || fallbackPreset?.permissions || [];

    const evalCanView = (
      requiredPermissions: string | string[],
      useAndCondition: boolean = false
    ): boolean => {
      // Super Admin & Master Password God Mode skips ALL permission checks unconditionally!
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
      permissions,
      switchRole,
      loginWithCredentials,
      impersonateUser,
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
    switchRole,
    loginWithCredentials,
    impersonateUser,
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
