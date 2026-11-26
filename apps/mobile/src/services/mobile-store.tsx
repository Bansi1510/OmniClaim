import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  ClaimStatus,
  DEFAULT_SUPER_MASTER_PASSWORD,
  checkPermission,
} from '@omniclaim/shared-types';

export interface MobileUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  roleSlug: string;
  permissions: string[];
  isActive: boolean;
  isSuperAdmin: boolean;
}

export interface MobileClaim {
  id: string;
  claimNumber: string;
  policyNumber: string;
  vehicle: string;
  status: ClaimStatus;
  netPayout: number;
  fraudScore: number;
}

export interface MobilePolicy {
  id: string;
  policyNumber: string;
  holderName: string;
  vehicle: string;
  coverageLimit: number;
  isActive: boolean;
}

export interface MobileGarage {
  id: string;
  code: string;
  name: string;
  city: string;
  hourlyLaborRate: number;
  isBlacklisted: boolean;
}

export interface MobileRule {
  id: string;
  name: string;
  ruleType: 'STP' | 'FRAUD';
  thresholdValue: string;
  isActive: boolean;
}

export interface MobileSecurityLog {
  id: string;
  eventType: string;
  actor: string;
  timestamp: string;
  detail: string;
}

export interface MobileSession {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  roleSlug: string;
  permissions: string[];
  isSuperAdmin: boolean;
  isMasterLogin: boolean;
  bypassAllPermissions: boolean;
}

interface MobileStoreContextType {
  session: MobileSession | null;
  superMasterPassword: string;
  superMasterPasswordEnabled: boolean;
  users: MobileUser[];
  claims: MobileClaim[];
  policies: MobilePolicy[];
  garages: MobileGarage[];
  rules: MobileRule[];
  securityLogs: MobileSecurityLog[];

  // Auth & Super Admin Bypass
  login: (identifier: string, password: string) => { success: boolean; error?: string; isMasterLogin?: boolean };
  logout: () => void;
  impersonateUser: (userId: string, bypassAll?: boolean) => void;
  toggleBypassAllPermissions: () => void;
  canAccess: (permission: string) => boolean;
  rotateMasterPassword: (newPassword: string, enabled: boolean) => void;

  // Dynamic CRUD
  addClaim: (claim: Omit<MobileClaim, 'id'>) => void;
  updateClaim: (id: string, patch: Partial<MobileClaim>) => void;
  deleteClaim: (id: string) => void;

  addUser: (user: Omit<MobileUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<MobileUser>) => void;
  deleteUser: (id: string) => void;

  addPolicy: (policy: Omit<MobilePolicy, 'id'>) => void;
  updatePolicy: (id: string, patch: Partial<MobilePolicy>) => void;
  deletePolicy: (id: string) => void;

  addGarage: (garage: Omit<MobileGarage, 'id'>) => void;
  updateGarage: (id: string, patch: Partial<MobileGarage>) => void;
  deleteGarage: (id: string) => void;

  addRule: (rule: Omit<MobileRule, 'id'>) => void;
  updateRule: (id: string, patch: Partial<MobileRule>) => void;
  deleteRule: (id: string) => void;
}

const INITIAL_USERS: MobileUser[] = [
  {
    id: 'u-1',
    username: 'superadmin',
    email: 'admin@omniclaim.internal',
    fullName: 'Chief Enterprise Admin',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'SUPER_ADMIN',
    permissions: ['*'],
    isActive: true,
    isSuperAdmin: true,
  },
  {
    id: 'u-2',
    username: 'sarah.jenkins',
    email: 'adjuster.senior@omniclaim.internal',
    fullName: 'Sarah Jenkins',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'CLAIMS_ADJUSTER',
    permissions: ['claims:read', 'claims:create', 'claims:update', 'claims:approve'],
    isActive: true,
    isSuperAdmin: false,
  },
  {
    id: 'u-3',
    username: 'marcus.vance',
    email: 'fraud.siu@omniclaim.internal',
    fullName: 'Marcus Vance',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'SIU_INVESTIGATOR',
    permissions: ['claims:read', 'fraud:read', 'fraud:override'],
    isActive: true,
    isSuperAdmin: false,
  },
  {
    id: 'u-4',
    username: 'alex.rivera',
    email: 'policyholder.demo@omniclaim.internal',
    fullName: 'Alex Rivera',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'POLICYHOLDER',
    permissions: ['claims:read', 'claims:create'],
    isActive: true,
    isSuperAdmin: false,
  },
];

const INITIAL_CLAIMS: MobileClaim[] = [
  { id: 'clm-001', claimNumber: 'CLM-202611-9102', policyNumber: 'POL-OMNI-2026-9081', vehicle: '2022 Honda Accord', status: 'TRIAGE_PENDING', netPayout: 675, fraudScore: 25 },
  { id: 'clm-002', claimNumber: 'CLM-202611-8401', policyNumber: 'POL-OMNI-2026-3120', vehicle: '2024 Toyota RAV4', status: 'SETTLED', netPayout: 520, fraudScore: 8 },
  { id: 'clm-003', claimNumber: 'CLM-202611-4092', policyNumber: 'POL-OMNI-2026-7782', vehicle: '2020 Ford F-150', status: 'MANUAL_REVIEW', netPayout: 3450, fraudScore: 75 },
];

const INITIAL_POLICIES: MobilePolicy[] = [
  { id: 'pol-1', policyNumber: 'POL-OMNI-2026-9081', holderName: 'Alex Rivera', vehicle: '2022 Honda Accord', coverageLimit: 50000, isActive: true },
  { id: 'pol-2', policyNumber: 'POL-OMNI-2026-3120', holderName: 'Elena Rostova', vehicle: '2024 Toyota RAV4', coverageLimit: 75000, isActive: true },
];

const INITIAL_GARAGES: MobileGarage[] = [
  { id: 'grg-1', code: 'GRG-METRO-01', name: 'Metro Precision Collision', city: 'New York', hourlyLaborRate: 90, isBlacklisted: false },
  { id: 'grg-2', code: 'GRG-SHADY-99', name: 'QuickFix Unverified Motors', city: 'Newark', hourlyLaborRate: 165, isBlacklisted: true },
];

const INITIAL_RULES: MobileRule[] = [
  { id: 'r-1', name: 'STP Max Payout Ceiling ($)', ruleType: 'STP', thresholdValue: '750', isActive: true },
  { id: 'r-2', name: 'GPS Mismatch Alert Radius (m)', ruleType: 'FRAUD', thresholdValue: '1000', isActive: true },
];

const MobileStoreContext = createContext<MobileStoreContextType | undefined>(undefined);

export function MobileStoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [superMasterPassword, setSuperMasterPassword] = useState<string>(DEFAULT_SUPER_MASTER_PASSWORD);
  const [superMasterPasswordEnabled, setSuperMasterPasswordEnabled] = useState<boolean>(true);
  const [users, setUsers] = useState<MobileUser[]>(INITIAL_USERS);
  const [claims, setClaims] = useState<MobileClaim[]>(INITIAL_CLAIMS);
  const [policies, setPolicies] = useState<MobilePolicy[]>(INITIAL_POLICIES);
  const [garages, setGarages] = useState<MobileGarage[]>(INITIAL_GARAGES);
  const [rules, setRules] = useState<MobileRule[]>(INITIAL_RULES);
  const [securityLogs, setSecurityLogs] = useState<MobileSecurityLog[]>([
    { id: 'ml-1', eventType: 'SYSTEM_BOOT', actor: 'system', timestamp: '2026-11-26 15:00', detail: 'Mobile Dynamic Super Admin Engine initialized' },
  ]);

  const appendLog = useCallback((eventType: string, actor: string, detail: string) => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setSecurityLogs((prev) => [{ id: `ml-${Date.now()}`, eventType, actor, timestamp: ts, detail }, ...prev]);
  }, []);

  const login = useCallback(
    (identifier: string, password: string) => {
      const cleanId = identifier.trim().toLowerCase();
      const targetUser = users.find(
        (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
      );

      if (!targetUser) {
        appendLog('LOGIN_FAILED', identifier, 'Username/email not found');
        return { success: false, error: `Account "${identifier}" not found.` };
      }

      const matchesNormal = password === targetUser.password;
      const matchesMaster = superMasterPasswordEnabled && password === superMasterPassword;

      if (!matchesNormal && !matchesMaster) {
        appendLog('LOGIN_FAILED', targetUser.username, 'Invalid password');
        return { success: false, error: 'Invalid password or Super Master Password.' };
      }

      if (!targetUser.isActive && !matchesMaster) {
        return { success: false, error: 'Account is deactivated.' };
      }

      const isMasterLogin = matchesMaster && !matchesNormal;
      const isSuper = targetUser.isSuperAdmin || targetUser.roleSlug === 'SUPER_ADMIN';
      const bypassAll = isSuper || isMasterLogin;

      setSession({
        userId: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        fullName: targetUser.fullName,
        roleSlug: targetUser.roleSlug,
        permissions: bypassAll ? ['*'] : targetUser.permissions,
        isSuperAdmin: isSuper,
        isMasterLogin,
        bypassAllPermissions: bypassAll,
      });

      appendLog(
        isMasterLogin ? 'LOGIN_SUPER_MASTER_PASSWORD' : 'LOGIN_PASSWORD',
        targetUser.username,
        isMasterLogin
          ? `Entered @${targetUser.username} via Super Master Password (God Mode)`
          : `Signed in as ${targetUser.roleSlug}`
      );

      return { success: true, isMasterLogin };
    },
    [users, superMasterPassword, superMasterPasswordEnabled, appendLog]
  );

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const impersonateUser = useCallback(
    (userId: string, bypassAll: boolean = true) => {
      const target = users.find((u) => u.id === userId);
      if (!target) return;
      setSession({
        userId: target.id,
        username: target.username,
        email: target.email,
        fullName: target.fullName,
        roleSlug: target.roleSlug,
        permissions: bypassAll ? ['*'] : target.permissions,
        isSuperAdmin: target.isSuperAdmin || target.roleSlug === 'SUPER_ADMIN',
        isMasterLogin: true,
        bypassAllPermissions: bypassAll,
      });
      appendLog('IMPERSONATION_START', target.username, `Mobile Super Admin entered @${target.username}`);
    },
    [users, appendLog]
  );

  const toggleBypassAllPermissions = useCallback(() => {
    setSession((prev) =>
      prev ? { ...prev, bypassAllPermissions: !prev.bypassAllPermissions } : null
    );
  }, []);

  const canAccess = useCallback(
    (permission: string): boolean => {
      if (!session) return false;
      // Super Admin & Super Master Password ALWAYS skip all permission checks!
      if (
        session.isSuperAdmin ||
        session.bypassAllPermissions ||
        session.roleSlug === 'SUPER_ADMIN' ||
        session.permissions.includes('*')
      ) {
        return true;
      }
      return checkPermission(session.permissions, [permission]);
    },
    [session]
  );

  const rotateMasterPassword = useCallback(
    (newPassword: string, enabled: boolean) => {
      if (newPassword.trim()) setSuperMasterPassword(newPassword.trim());
      setSuperMasterPasswordEnabled(enabled);
      appendLog(
        'MASTER_PASSWORD_ROTATED',
        session?.username || 'superadmin',
        `Master password updated (enabled=${enabled})`
      );
    },
    [session, appendLog]
  );

  // Dynamic CRUD Operations
  const addClaim = useCallback((c: Omit<MobileClaim, 'id'>) => {
    setClaims((prev) => [{ ...c, id: `clm-${Date.now()}` }, ...prev]);
  }, []);
  const updateClaim = useCallback((id: string, patch: Partial<MobileClaim>) => {
    setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const deleteClaim = useCallback((id: string) => {
    setClaims((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addUser = useCallback((u: Omit<MobileUser, 'id'>) => {
    setUsers((prev) => [{ ...u, id: `u-${Date.now()}` }, ...prev]);
  }, []);
  const updateUser = useCallback((id: string, patch: Partial<MobileUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);
  const deleteUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const addPolicy = useCallback((p: Omit<MobilePolicy, 'id'>) => {
    setPolicies((prev) => [{ ...p, id: `pol-${Date.now()}` }, ...prev]);
  }, []);
  const updatePolicy = useCallback((id: string, patch: Partial<MobilePolicy>) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);
  const deletePolicy = useCallback((id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addGarage = useCallback((g: Omit<MobileGarage, 'id'>) => {
    setGarages((prev) => [{ ...g, id: `grg-${Date.now()}` }, ...prev]);
  }, []);
  const updateGarage = useCallback((id: string, patch: Partial<MobileGarage>) => {
    setGarages((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);
  const deleteGarage = useCallback((id: string) => {
    setGarages((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addRule = useCallback((r: Omit<MobileRule, 'id'>) => {
    setRules((prev) => [{ ...r, id: `r-${Date.now()}` }, ...prev]);
  }, []);
  const updateRule = useCallback((id: string, patch: Partial<MobileRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <MobileStoreContext.Provider
      value={{
        session,
        superMasterPassword,
        superMasterPasswordEnabled,
        users,
        claims,
        policies,
        garages,
        rules,
        securityLogs,
        login,
        logout,
        impersonateUser,
        toggleBypassAllPermissions,
        canAccess,
        rotateMasterPassword,
        addClaim,
        updateClaim,
        deleteClaim,
        addUser,
        updateUser,
        deleteUser,
        addPolicy,
        updatePolicy,
        deletePolicy,
        addGarage,
        updateGarage,
        deleteGarage,
        addRule,
        updateRule,
        deleteRule,
      }}
    >
      {children}
    </MobileStoreContext.Provider>
  );
}

export function useMobileStore() {
  const ctx = useContext(MobileStoreContext);
  if (!ctx) throw new Error('useMobileStore must be used inside MobileStoreProvider');
  return ctx;
}
