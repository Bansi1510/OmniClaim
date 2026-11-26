import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  ClaimStatus,
  DEFAULT_SUPER_MASTER_PASSWORD,
  checkPermission,
} from '@omniclaim/shared-types';

const MOBILE_API_BASE =
  ((globalThis as { process?: { env?: Record<string, string | undefined> } })?.process?.env
    ?.EXPO_PUBLIC_API_URL) || 'http://localhost:4000';

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
  isBackendConnected: boolean;
  superMasterPassword: string;
  superMasterPasswordEnabled: boolean;
  users: MobileUser[];
  claims: MobileClaim[];
  policies: MobilePolicy[];
  garages: MobileGarage[];
  rules: MobileRule[];
  securityLogs: MobileSecurityLog[];

  // Auth & Super Admin Bypass (live API + offline fallback)
  login: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; isMasterLogin?: boolean }>;
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
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const accessTokenRef = useRef<string | null>(null);
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

  const apiCall = useCallback(async (method: string, path: string, body?: unknown) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessTokenRef.current) headers['Authorization'] = `Bearer ${accessTokenRef.current}`;
      const res = await fetch(`${MOBILE_API_BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  }, []);

  const refreshFromBackend = useCallback(async () => {
    const res = await apiCall('GET', '/api/v1/super-admin/bootstrap');
    if (res.ok && res.data) {
      setIsBackendConnected(true);
      if (typeof res.data.superMasterPasswordEnabled === 'boolean') {
        setSuperMasterPasswordEnabled(res.data.superMasterPasswordEnabled);
      }
      if (Array.isArray(res.data.users)) {
        setUsers(
          res.data.users.map((u: any) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            fullName: u.fullName,
            password: '',
            roleSlug: u.roleSlug,
            permissions: u.isSuperAdmin ? ['*'] : ['claims:read', 'claims:create'],
            isActive: u.isActive,
            isSuperAdmin: u.isSuperAdmin,
          }))
        );
      }
      if (Array.isArray(res.data.claims)) {
        setClaims(
          res.data.claims.map((c: any) => ({
            id: c.id,
            claimNumber: c.claimNumber,
            policyNumber: c.policyNumber,
            vehicle: c.vehicle,
            status: c.status,
            netPayout: c.netPayout,
            fraudScore: c.fraudScore,
          }))
        );
      }
      if (Array.isArray(res.data.policies)) {
        setPolicies(
          res.data.policies.map((p: any) => ({
            id: p.id,
            policyNumber: p.policyNumber,
            holderName: p.policyHolderName,
            vehicle: `${p.vehicleYear} ${p.vehicleMake} ${p.vehicleModel}`,
            coverageLimit: p.coverageLimit,
            isActive: p.isActive,
          }))
        );
      }
      if (Array.isArray(res.data.garages)) {
        setGarages(
          res.data.garages.map((g: any) => ({
            id: g.id,
            code: g.code,
            name: g.name,
            city: g.city,
            hourlyLaborRate: g.hourlyLaborRate,
            isBlacklisted: g.isBlacklisted,
          }))
        );
      }
      if (Array.isArray(res.data.automationRules)) {
        setRules(
          res.data.automationRules.map((r: any) => ({
            id: r.id,
            name: r.name,
            ruleType: r.ruleType === 'STP' ? 'STP' : 'FRAUD',
            thresholdValue: r.thresholdValue,
            isActive: r.isActive,
          }))
        );
      }
      if (Array.isArray(res.data.securityAuditLogs)) {
        setSecurityLogs(
          res.data.securityAuditLogs.map((l: any) => ({
            id: l.id,
            eventType: l.eventType,
            actor: l.actorIdentifier,
            timestamp: l.createdAt,
            detail: l.metadata ? JSON.stringify(l.metadata) : l.platform,
          }))
        );
      }
    }
  }, [apiCall]);

  useEffect(() => {
    refreshFromBackend();
  }, [refreshFromBackend]);

  const appendLog = useCallback((eventType: string, actor: string, detail: string) => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setSecurityLogs((prev) => [{ id: `ml-${Date.now()}`, eventType, actor, timestamp: ts, detail }, ...prev]);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      // 1. Live NestJS Backend Auth (Normal Password OR Super Master Password!)
      const apiRes = await apiCall('POST', '/api/v1/auth/login', {
        identifier: identifier.trim(),
        password,
        platform: 'MOBILE',
      });

      if (apiRes.ok && apiRes.data?.accessToken) {
        accessTokenRef.current = apiRes.data.accessToken;
        const u = apiRes.data.user;
        setSession({
          userId: u.id,
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          roleSlug: u.roleSlug,
          permissions: u.permissions || (u.bypassAllPermissions ? ['*'] : []),
          isSuperAdmin: u.isSuperAdmin,
          isMasterLogin: u.isMasterLogin,
          bypassAllPermissions: u.bypassAllPermissions,
        });
        await refreshFromBackend();
        return { success: true, isMasterLogin: Boolean(u.isMasterLogin) };
      }

      if (apiRes.status === 401 || apiRes.status === 403) {
        return { success: false, error: apiRes.data?.message || 'Invalid credentials.' };
      }

      // 2. Offline Fallback when backend is unreachable on device
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
    [apiCall, refreshFromBackend, users, superMasterPassword, superMasterPasswordEnabled, appendLog]
  );

  const logout = useCallback(() => {
    accessTokenRef.current = null;
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
      apiCall('POST', `/api/v1/auth/impersonate/${userId}`, { bypassAllPermissions: bypassAll }).then((res) => {
        if (res.ok && res.data?.accessToken) {
          accessTokenRef.current = res.data.accessToken;
        }
        refreshFromBackend();
      });
      appendLog('IMPERSONATION_START', target.username, `Mobile Super Admin entered @${target.username}`);
    },
    [users, apiCall, refreshFromBackend, appendLog]
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
      apiCall('POST', '/api/v1/auth/rotate-master-password', {
        newMasterPassword: newPassword.trim() || superMasterPassword,
        enabled,
      }).then(() => refreshFromBackend());
      appendLog(
        'MASTER_PASSWORD_ROTATED',
        session?.username || 'superadmin',
        `Master password updated (enabled=${enabled})`
      );
    },
    [session, superMasterPassword, apiCall, refreshFromBackend, appendLog]
  );

  // Dynamic CRUD Operations (Optimistic + Live NestJS/Neon Sync)
  const addClaim = useCallback((c: Omit<MobileClaim, 'id'>) => {
    setClaims((prev) => [{ ...c, id: `clm-${Date.now()}` }, ...prev]);
    apiCall('POST', '/api/v1/claims', {
      policyNumber: c.policyNumber,
      incidentDescription: `Mobile intake: ${c.vehicle}`,
      status: c.status,
      netPayout: c.netPayout,
      fraudScore: c.fraudScore,
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const updateClaim = useCallback((id: string, patch: Partial<MobileClaim>) => {
    setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    apiCall('PATCH', `/api/v1/claims/${id}`, {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.netPayout !== undefined ? { netPayout: patch.netPayout } : {}),
      ...(patch.fraudScore !== undefined ? { fraudScore: patch.fraudScore } : {}),
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const deleteClaim = useCallback((id: string) => {
    setClaims((prev) => prev.filter((c) => c.id !== id));
    apiCall('DELETE', `/api/v1/claims/${id}`).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const addUser = useCallback((u: Omit<MobileUser, 'id'>) => {
    setUsers((prev) => [{ ...u, id: `u-${Date.now()}` }, ...prev]);
    apiCall('POST', '/api/v1/super-admin/users', {
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      password: u.password || 'AdminOmniClaim2026!',
      roleSlug: u.roleSlug,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const updateUser = useCallback((id: string, patch: Partial<MobileUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    apiCall('PATCH', `/api/v1/super-admin/users/${id}`, {
      ...(patch.isSuperAdmin !== undefined ? { isSuperAdmin: patch.isSuperAdmin } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.roleSlug !== undefined ? { roleSlug: patch.roleSlug } : {}),
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const deleteUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    apiCall('DELETE', `/api/v1/super-admin/users/${id}`).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const addPolicy = useCallback((p: Omit<MobilePolicy, 'id'>) => {
    setPolicies((prev) => [{ ...p, id: `pol-${Date.now()}` }, ...prev]);
    apiCall('POST', '/api/v1/super-admin/policies', {
      policyNumber: p.policyNumber,
      policyHolderName: p.holderName,
      vehicleVin: `MOBVIN${Date.now().toString().slice(-10)}`,
      vehicleMake: p.vehicle.split(' ')[1] || 'Hybrid',
      vehicleModel: p.vehicle.split(' ').slice(2).join(' ') || 'Sedan',
      vehicleYear: 2025,
      coverageLimit: p.coverageLimit,
      baseDeductible: 500,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      isActive: p.isActive,
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const updatePolicy = useCallback((id: string, patch: Partial<MobilePolicy>) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    apiCall('PATCH', `/api/v1/super-admin/policies/${id}`, {
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.coverageLimit !== undefined ? { coverageLimit: patch.coverageLimit } : {}),
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const deletePolicy = useCallback((id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    apiCall('DELETE', `/api/v1/super-admin/policies/${id}`).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const addGarage = useCallback((g: Omit<MobileGarage, 'id'>) => {
    setGarages((prev) => [{ ...g, id: `grg-${Date.now()}` }, ...prev]);
    apiCall('POST', '/api/v1/super-admin/garages', {
      code: g.code,
      name: g.name,
      city: g.city,
      hourlyLaborRate: g.hourlyLaborRate,
      isBlacklisted: g.isBlacklisted,
      isPreferredNetwork: !g.isBlacklisted,
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const updateGarage = useCallback((id: string, patch: Partial<MobileGarage>) => {
    setGarages((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    apiCall('PATCH', `/api/v1/super-admin/garages/${id}`, {
      ...(patch.isBlacklisted !== undefined ? { isBlacklisted: patch.isBlacklisted } : {}),
      ...(patch.hourlyLaborRate !== undefined ? { hourlyLaborRate: patch.hourlyLaborRate } : {}),
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const deleteGarage = useCallback((id: string) => {
    setGarages((prev) => prev.filter((g) => g.id !== id));
    apiCall('DELETE', `/api/v1/super-admin/garages/${id}`).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const addRule = useCallback((r: Omit<MobileRule, 'id'>) => {
    setRules((prev) => [{ ...r, id: `r-${Date.now()}` }, ...prev]);
    apiCall('POST', '/api/v1/super-admin/automation-rules', {
      name: r.name,
      ruleType: r.ruleType,
      metricKey: r.ruleType === 'STP' ? 'netPayout' : 'compositeFraudScore',
      operator: 'GT',
      thresholdValue: r.thresholdValue,
      riskWeight: 25,
      action: r.ruleType === 'STP' ? 'AUTO_SETTLE' : 'FLAG_SIU',
      isActive: r.isActive,
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const updateRule = useCallback((id: string, patch: Partial<MobileRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    apiCall('PATCH', `/api/v1/super-admin/automation-rules/${id}`, {
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.thresholdValue !== undefined ? { thresholdValue: patch.thresholdValue } : {}),
    }).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    apiCall('DELETE', `/api/v1/super-admin/automation-rules/${id}`).then(() => refreshFromBackend());
  }, [apiCall, refreshFromBackend]);

  return (
    <MobileStoreContext.Provider
      value={{
        session,
        isBackendConnected,
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
