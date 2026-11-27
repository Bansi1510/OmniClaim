'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  ClaimStatus,
  FraudRiskTier,
  VehiclePartType,
  MaterialType,
  DamageSeverity,
  SystemSettingDto,
  PolicyMasterDto,
  VehiclePartCatalogDto,
  DepreciationRuleDto,
  AutomationRuleDto,
  RepairGarageDto,
  DynamicMenuItemDto,
  SecurityAuditLogDto,
  DEFAULT_SUPER_MASTER_PASSWORD,
} from '@omniclaim/shared-types';
import { apiRequest } from '@/lib/api-client';

export interface DynamicUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  roleSlug: string;
  roleName: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  assignedAt: string;
}

export interface DynamicRole {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}

export interface DynamicPermission {
  id: string;
  slug: string;
  module: string;
  action: string;
  description: string;
}

export interface DynamicDamageItem {
  id: string;
  evidenceId: string;
  partType: VehiclePartType;
  materialType: MaterialType;
  severity: DamageSeverity;
  confidence: number;
  boundingBox: { xmin: number; ymin: number; xmax: number; ymax: number };
  repairAction: 'REPAIR' | 'REPLACE';
  isManualAdded?: boolean;
}

export interface DynamicReconciliationItem {
  id: string;
  billLineItemId: string;
  rawDescription: string;
  claimedCost: number;
  isLabor: boolean;
  isVerifiedByDamage: boolean;
  matchedDamagePart: VehiclePartType | null;
  systemDeduction: number;
  approvedCost: number;
  rejectionReason: string | null;
  isManualOverride: boolean;
  overrideReason: string | null;
}

export interface DynamicFraudIndicator {
  id: string;
  type: string;
  riskContribution: number;
  evidenceMetadata: Record<string, unknown>;
  isOverridden: boolean;
  overrideReason?: string;
}

export interface DynamicClaim {
  id: string;
  claimNumber: string;
  policyNumber: string;
  vehicle: string;
  incidentDate: string;
  incidentDescription: string;
  status: ClaimStatus;
  version: number;
  fraudScore: number;
  riskTier: FraudRiskTier;
  netPayout: number;
  deductible: number;
  adjuster: string;
  damages: DynamicDamageItem[];
  reconciliationItems: DynamicReconciliationItem[];
  fraudIndicators: DynamicFraudIndicator[];
}

export interface DynamicLedgerAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isActive: boolean;
}

export interface DynamicJournalEntry {
  id: string;
  voucherNumber: string;
  date: string;
  claimNumber: string;
  account: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
  isReconciled: boolean;
}

export interface DynamicAuditLog {
  id: string;
  claimId: string;
  claimNumber: string;
  field: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedByEmail: string;
  timestamp: string;
  reason: string;
}

export interface DynamicPresenceLease {
  claimId: string;
  claimNumber: string;
  adjusterName: string;
  adjusterEmail: string;
  leasedAt: string;
  expiresInSeconds: number;
}

interface DynamicStoreState {
  superMasterPassword: string;
  superMasterPasswordEnabled: boolean;
  users: DynamicUser[];
  roles: DynamicRole[];
  permissionsCatalog: DynamicPermission[];
  claims: DynamicClaim[];
  policies: PolicyMasterDto[];
  partsCatalog: VehiclePartCatalogDto[];
  depreciationRules: DepreciationRuleDto[];
  automationRules: AutomationRuleDto[];
  garages: RepairGarageDto[];
  menus: DynamicMenuItemDto[];
  settings: SystemSettingDto[];
  ledgerAccounts: DynamicLedgerAccount[];
  journalEntries: DynamicJournalEntry[];
  auditLogs: DynamicAuditLog[];
  presenceLeases: DynamicPresenceLease[];
  securityAuditLogs: SecurityAuditLogDto[];
}

const STORAGE_KEY = 'omniclaim_dynamic_enterprise_store_v2';

const FALLBACK_MENUS: DynamicMenuItemDto[] = [
  { id: 'm-p1', menuKey: 'apply_policy', label: 'Apply for Policy', navLink: '/policies/apply', icon: 'FilePlus', parentKey: null, requiredPermission: 'policies:apply', badgeName: 'New', badgeColor: 'bg-emerald-500/20 text-emerald-400', sortOrder: 1, isVisible: true, isSystem: false },
  { id: 'm-p2', menuKey: 'my_policies', label: 'Policies Portfolio', navLink: '/policies', icon: 'ShieldCheck', parentKey: null, requiredPermission: 'policies:read', sortOrder: 2, isVisible: true, isSystem: false },
  { id: 'm-p3', menuKey: 'underwriting_queue', label: 'Underwriting Queue', navLink: '/underwriting', icon: 'ClipboardCheck', parentKey: null, requiredPermission: 'underwriting:review', sortOrder: 3, isVisible: true, isSystem: false },
  { id: 'm-1', menuKey: 'claims-ops', label: 'Claims Operations', icon: 'FileText', parentKey: null, requiredPermission: 'claims:read', sortOrder: 4, isVisible: true, isSystem: true },
  { id: 'm-1a', menuKey: 'triage-queue', label: 'Triage Queue', navLink: '/claims', icon: 'Circle', parentKey: 'claims-ops', requiredPermission: 'claims:read', sortOrder: 1, isVisible: true },
  { id: 'm-1b', menuKey: 'initiate-claim', label: 'Submit New Claim', navLink: '/claims?action=new', icon: 'Circle', parentKey: 'claims-ops', requiredPermission: 'claims:create', badgeName: 'Intake', badgeColor: 'bg-primary/20 text-primary', sortOrder: 2, isVisible: true },
  { id: 'm-2', menuKey: 'fraud-siu', label: 'Fraud & SIU Unit', icon: 'ShieldAlert', parentKey: null, requiredPermission: 'fraud:read', sortOrder: 5, isVisible: true, isSystem: true },
  { id: 'm-2a', menuKey: 'fraud-scorecards', label: 'Scorecard Audits', navLink: '/claims', icon: 'Circle', parentKey: 'fraud-siu', requiredPermission: 'fraud:read', sortOrder: 1, isVisible: true },
  { id: 'm-2b', menuKey: 'pgvector-search', label: 'pgvector Similarity', navLink: '/claims/clm-003', icon: 'Circle', parentKey: 'fraud-siu', requiredPermission: 'fraud:read', badgeName: 'Vector', badgeColor: 'bg-teal-500/20 text-teal-400', sortOrder: 2, isVisible: true },
  { id: 'm-3', menuKey: 'ledger-accounting', label: 'Financial Ledger', icon: 'BookOpen', parentKey: null, requiredPermission: 'ledger:read', sortOrder: 6, isVisible: true, isSystem: true },
  { id: 'm-3a', menuKey: 'general-journals', label: 'General Journals', navLink: '/ledger', icon: 'Circle', parentKey: 'ledger-accounting', requiredPermission: 'ledger:read', sortOrder: 1, isVisible: true },
  { id: 'm-3b', menuKey: 'payout-vouchers', label: 'Chart of Accounts', navLink: '/ledger?tab=accounts', icon: 'Circle', parentKey: 'ledger-accounting', requiredPermission: 'ledger:read', sortOrder: 2, isVisible: true },
  { id: 'm-4', menuKey: 'setup-rbac', label: 'Setup & Access Control', icon: 'Settings', parentKey: null, requiredPermission: 'rbac:roles_create', sortOrder: 7, isVisible: true, isSystem: true },
  { id: 'm-4a', menuKey: 'roles-rights', label: 'Roles & Rights Setup', navLink: '/admin/roles', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:roles_create', sortOrder: 1, isVisible: true },
  { id: 'm-4b', menuKey: 'permission-matrix', label: 'Permission Matrix Grid', navLink: '/admin/rbac', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:roles_create', sortOrder: 2, isVisible: true },
  { id: 'm-4c', menuKey: 'user-access', label: 'User Role Assignment', navLink: '/admin/users', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:users_assign', sortOrder: 3, isVisible: true },
  { id: 'm-5', menuKey: 'audit-compliance', label: 'Audit & Compliance', icon: 'History', parentKey: null, requiredPermission: 'audit:read', sortOrder: 8, isVisible: true, isSystem: true },
  { id: 'm-5a', menuKey: 'field-audit', label: 'Field & Security Logs', navLink: '/audit', icon: 'Circle', parentKey: 'audit-compliance', requiredPermission: 'audit:read', sortOrder: 1, isVisible: true },
];

const INITIAL_STATE: DynamicStoreState = {
  superMasterPassword: DEFAULT_SUPER_MASTER_PASSWORD,
  superMasterPasswordEnabled: true,
  users: [
    { id: 'u-1', username: 'superadmin', email: 'admin@omniclaim.internal', fullName: 'Chief Enterprise Admin', password: 'AdminOmniClaim2026!', roleSlug: 'SUPER_ADMIN', roleName: 'Super Administrator', isActive: true, isSuperAdmin: true, assignedAt: '2026-11-26' },
  ],
  roles: [
    { id: 'role-super-admin', name: 'Super Administrator', slug: 'SUPER_ADMIN', description: 'Unrestricted enterprise administrative access', isSystem: true, permissions: ['*'] },
  ],
  permissionsCatalog: [],
  claims: [],
  policies: [],
  partsCatalog: [],
  depreciationRules: [],
  automationRules: [],
  garages: [],
  menus: FALLBACK_MENUS,
  settings: [],
  ledgerAccounts: [],
  journalEntries: [],
  auditLogs: [],
  presenceLeases: [],
  securityAuditLogs: [],
};

export interface DynamicStoreContextType extends DynamicStoreState {
  isBackendConnected: boolean;
  refreshFromBackend: () => Promise<void>;

  updateSuperMasterPassword: (newPassword: string, enabled: boolean, actor: string) => void;
  appendSecurityAudit: (entry: Omit<SecurityAuditLogDto, 'id' | 'createdAt'>) => void;
  appendFieldAudit: (entry: Omit<DynamicAuditLog, 'id' | 'timestamp'>) => void;
  releasePresenceLease: (claimId: string) => void;

  addUser: (user: Omit<DynamicUser, 'id' | 'assignedAt'>) => DynamicUser;
  updateUser: (id: string, patch: Partial<DynamicUser>) => void;
  deleteUser: (id: string) => void;

  addRole: (role: Omit<DynamicRole, 'id'>) => DynamicRole;
  updateRole: (id: string, patch: Partial<DynamicRole>) => void;
  deleteRole: (id: string) => void;
  updateRolePermissions: (roleIdOrSlug: string, permissions: string[]) => void;
  addPermission: (perm: Omit<DynamicPermission, 'id'>) => void;
  updatePermission: (id: string, patch: Partial<DynamicPermission>) => void;
  deletePermission: (id: string) => void;

  addClaim: (claim: Omit<DynamicClaim, 'id' | 'version'>) => DynamicClaim;
  updateClaim: (id: string, patch: Partial<DynamicClaim>) => void;
  deleteClaim: (id: string) => void;

  addPolicy: (policy: Omit<PolicyMasterDto, 'id'>) => void;
  updatePolicy: (id: string, patch: Partial<PolicyMasterDto>) => void;
  deletePolicy: (id: string) => void;

  addPart: (part: Omit<VehiclePartCatalogDto, 'id'>) => void;
  updatePart: (id: string, patch: Partial<VehiclePartCatalogDto>) => void;
  deletePart: (id: string) => void;

  addDepreciationRule: (rule: Omit<DepreciationRuleDto, 'id'>) => void;
  updateDepreciationRule: (id: string, patch: Partial<DepreciationRuleDto>) => void;
  deleteDepreciationRule: (id: string) => void;

  addAutomationRule: (rule: Omit<AutomationRuleDto, 'id'>) => void;
  updateAutomationRule: (id: string, patch: Partial<AutomationRuleDto>) => void;
  deleteAutomationRule: (id: string) => void;

  addGarage: (garage: Omit<RepairGarageDto, 'id'>) => void;
  updateGarage: (id: string, patch: Partial<RepairGarageDto>) => void;
  deleteGarage: (id: string) => void;

  addMenu: (menu: Omit<DynamicMenuItemDto, 'id'>) => void;
  updateMenu: (id: string, patch: Partial<DynamicMenuItemDto>) => void;
  deleteMenu: (id: string) => void;
  moveMenuOrder: (id: string, direction: 'UP' | 'DOWN') => void;

  upsertSetting: (setting: Omit<SystemSettingDto, 'id' | 'updatedAt'> & { id?: string }) => void;
  deleteSetting: (id: string) => void;

  addLedgerAccount: (acct: Omit<DynamicLedgerAccount, 'id'>) => void;
  updateLedgerAccount: (id: string, patch: Partial<DynamicLedgerAccount>) => void;
  deleteLedgerAccount: (id: string) => void;
  addJournalEntry: (entry: Omit<DynamicJournalEntry, 'id'>) => void;
  updateJournalEntry: (id: string, patch: Partial<DynamicJournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

  resetStoreToDefaults: () => void;
}

const DynamicStoreContext = createContext<DynamicStoreContextType | undefined>(undefined);

export function DynamicStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DynamicStoreState>(INITIAL_STATE);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Maps temporary optimistic client IDs -> in-flight or resolved real PostgreSQL UUIDs
  // so immediate Edit/Delete right after Create NEVER sends a temp ID to the backend!
  const idPromiseMapRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const resolvedIdMapRef = useRef<Map<string, string>>(new Map());
  const inFlightMutationsRef = useRef<number>(0);
  // Monotonic mutation sequence: discards any stale GET /bootstrap started before a newer mutation!
  const mutationSeqRef = useRef<number>(0);
  // Monotonic client temp-ID counter: prevents same-millisecond Date.now() key collisions!
  const tempSeqRef = useRef<number>(0);
  const nextTempId = useCallback((prefix: string) => {
    tempSeqRef.current += 1;
    return `${prefix}-${Date.now()}-${tempSeqRef.current}`;
  }, []);

  const resolveRealId = useCallback(async (id: string): Promise<string> => {
    const already = resolvedIdMapRef.current.get(id);
    if (already) return already;
    const pending = idPromiseMapRef.current.get(id);
    if (pending) {
      const resolved = await pending;
      if (resolved) return resolved;
    }
    return id;
  }, []);

  const refreshFromBackend = useCallback(async () => {
    const capturedSeq = mutationSeqRef.current;
    const res = await apiRequest<Partial<DynamicStoreState>>('GET', '/api/v1/super-admin/bootstrap');
    if (res.ok && res.data) {
      setIsBackendConnected(true);
      // CRITICAL: Discard stale bootstrap snapshots if any mutation is in flight
      // OR if any new mutation began after this fetch was initiated!
      if (inFlightMutationsRef.current > 0 || mutationSeqRef.current !== capturedSeq) {
        return;
      }
      setState((prev) => ({
        ...prev,
        ...res.data,
        menus: res.data?.menus && res.data.menus.length > 0 ? res.data.menus : prev.menus,
      }));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DynamicStoreState>;
          setState((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // ignore
      }
    }
    // Hydrate from live Neon PostgreSQL via NestJS API!
    refreshFromBackend();
  }, [refreshFromBackend]);

  const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

  const appendSecurityAudit = useCallback((entry: Omit<SecurityAuditLogDto, 'id' | 'createdAt'>) => {
    setState((prev) => ({
      ...prev,
      securityAuditLogs: [
        { ...entry, id: `sec-${Date.now()}`, createdAt: nowStamp() },
        ...prev.securityAuditLogs,
      ].slice(0, 100),
    }));
  }, []);

  const appendFieldAudit = useCallback((entry: Omit<DynamicAuditLog, 'id' | 'timestamp'>) => {
    setState((prev) => ({
      ...prev,
      auditLogs: [{ ...entry, id: `aud-${Date.now()}`, timestamp: nowStamp() }, ...prev.auditLogs],
    }));
  }, []);

  const syncMutation = useCallback(
    async <T = any,>(
      method: 'POST' | 'PATCH' | 'DELETE',
      path: string,
      body?: unknown,
      shouldRefresh: boolean = true
    ) => {
      mutationSeqRef.current += 1;
      inFlightMutationsRef.current += 1;
      try {
        const res = await apiRequest<T>(method, path, body);
        if (!res.ok) {
          console.error(`[OmniClaim API] ${method} ${path} failed (${res.status}):`, res.error);
          return res;
        }
        return res;
      } finally {
        inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
        if (shouldRefresh && inFlightMutationsRef.current === 0) {
          refreshFromBackend();
        }
      }
    },
    [refreshFromBackend]
  );

  /**
   * Registers an optimistic create with tempId -> immediately swaps to the real DB UUID
   * when POST resolves, and allows any follow-up PATCH/DELETE to await the real UUID.
   */
  const syncCreate = useCallback(
    <T extends { id?: string; lines?: Array<{ id: string }> }>(
      tempId: string,
      path: string,
      body: unknown,
      onResolvedId: (realId: string, data: T) => void,
      extractId?: (data: T) => string | undefined
    ) => {
      mutationSeqRef.current += 1;
      const promise = (async (): Promise<string | null> => {
        const res = await syncMutation<T>('POST', path, body, true);
        if (res.ok && res.data) {
          const realId = extractId ? extractId(res.data) : res.data.id;
          if (realId) {
            resolvedIdMapRef.current.set(tempId, realId);
            onResolvedId(realId, res.data);
            return realId;
          }
        }
        return null;
      })();
      idPromiseMapRef.current.set(tempId, promise);
      return promise;
    },
    [syncMutation]
  );

  const syncEntityMutation = useCallback(
    async (
      method: 'PATCH' | 'DELETE',
      id: string,
      buildPath: (realId: string) => string,
      body?: unknown,
      shouldRefresh: boolean = true
    ) => {
      mutationSeqRef.current += 1;
      inFlightMutationsRef.current += 1;
      try {
        const realId = await resolveRealId(id);
        const res = await apiRequest(method, buildPath(realId), body);
        if (!res.ok) {
          console.error(`[OmniClaim API] ${method} ${buildPath(realId)} failed (${res.status}):`, res.error);
        }
        return res;
      } finally {
        inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
        if (shouldRefresh && inFlightMutationsRef.current === 0) {
          refreshFromBackend();
        }
      }
    },
    [resolveRealId, refreshFromBackend]
  );

  const updateSuperMasterPassword = useCallback(
    (newPassword: string, enabled: boolean, actor: string) => {
      setState((prev) => ({
        ...prev,
        superMasterPassword: newPassword.trim() ? newPassword : prev.superMasterPassword,
        superMasterPasswordEnabled: enabled,
      }));
      syncMutation('POST', '/api/v1/auth/rotate-master-password', {
        newMasterPassword: newPassword.trim() || state.superMasterPassword,
        enabled,
      });
      appendSecurityAudit({
        eventType: 'MASTER_PASSWORD_ROTATED',
        actorIdentifier: actor,
        platform: 'WEB',
        metadata: { enabled },
      });
    },
    [state.superMasterPassword, syncMutation, appendSecurityAudit]
  );

  const releasePresenceLease = useCallback(
    (claimId: string) => {
      setState((prev) => ({
        ...prev,
        presenceLeases: prev.presenceLeases.filter((l) => l.claimId !== claimId),
      }));
      syncEntityMutation('DELETE', claimId, (rid) => `/api/v1/super-admin/locks/${rid}`);
    },
    [syncEntityMutation]
  );

  // Users CRUD -> Real NestJS + Neon DB
  const addUser = useCallback(
    (u: Omit<DynamicUser, 'id' | 'assignedAt'>): DynamicUser => {
      const tempId = `u-${Date.now()}`;
      const created: DynamicUser = { ...u, id: tempId, assignedAt: new Date().toISOString().slice(0, 10) };
      setState((prev) => ({ ...prev, users: [created, ...prev.users] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/users',
        {
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          password: u.password || 'OmniClaim@123',
          roleSlug: u.roleSlug,
          isActive: u.isActive,
          isSuperAdmin: u.isSuperAdmin,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            users: prev.users.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
      return created;
    },
    [syncCreate]
  );

  const updateUser = useCallback(
    (id: string, patch: Partial<DynamicUser>) => {
      setState((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/users/${rid}`, {
        ...(patch.username !== undefined ? { username: patch.username } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.password ? { password: patch.password } : {}),
        ...(patch.roleSlug !== undefined ? { roleSlug: patch.roleSlug } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.isSuperAdmin !== undefined ? { isSuperAdmin: patch.isSuperAdmin } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteUser = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/users/${rid}`);
    },
    [syncEntityMutation]
  );

  // Roles & Permissions CRUD -> Real NestJS + Neon DB
  const addRole = useCallback(
    (r: Omit<DynamicRole, 'id'>): DynamicRole => {
      const tempId = `role-${Date.now()}`;
      const created: DynamicRole = { ...r, id: tempId };
      setState((prev) => ({ ...prev, roles: [...prev.roles, created] }));
      syncCreate(
        tempId,
        '/api/v1/rbac/roles',
        {
          name: r.name,
          slug: r.slug,
          description: r.description || r.name,
          permissionSlugs: r.permissions,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            roles: prev.roles.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
      return created;
    },
    [syncCreate]
  );

  const updateRole = useCallback(
    (id: string, patch: Partial<DynamicRole>) => {
      setState((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/rbac/roles/${rid}`, {
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteRole = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/rbac/roles/${rid}`);
    },
    [syncEntityMutation]
  );

  const updateRolePermissions = useCallback(
    (roleIdOrSlug: string, permissions: string[]) => {
      setState((prev) => ({
        ...prev,
        roles: prev.roles.map((r) =>
          r.id === roleIdOrSlug || r.slug === roleIdOrSlug ? { ...r, permissions } : r
        ),
      }));
      const target = state.roles.find((r) => r.id === roleIdOrSlug || r.slug === roleIdOrSlug);
      if (target) {
        resolveRealId(target.id).then((rid) =>
          syncMutation('POST', `/api/v1/rbac/roles/${rid}/permissions`, {
            permissionSlugs: permissions,
          })
        );
      }
    },
    [state.roles, resolveRealId, syncMutation]
  );

  const addPermission = useCallback(
    (perm: Omit<DynamicPermission, 'id'>) => {
      const tempId = `p-${Date.now()}`;
      setState((prev) => ({
        ...prev,
        permissionsCatalog: [...prev.permissionsCatalog, { ...perm, id: tempId }],
      }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/permissions',
        {
          slug: perm.slug,
          module: perm.module,
          description: perm.description,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            permissionsCatalog: prev.permissionsCatalog.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updatePermission = useCallback(
    (id: string, patch: Partial<DynamicPermission>) => {
      setState((prev) => ({
        ...prev,
        permissionsCatalog: prev.permissionsCatalog.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/permissions/${rid}`, {
        ...(patch.module !== undefined ? { module: patch.module } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deletePermission = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, permissionsCatalog: prev.permissionsCatalog.filter((p) => p.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/permissions/${rid}`);
    },
    [syncEntityMutation]
  );

  // Claims CRUD -> Real NestJS + Neon DB
  const addClaim = useCallback(
    (c: Omit<DynamicClaim, 'id' | 'version'>): DynamicClaim => {
      const tempId = `clm-${Date.now()}`;
      const created: DynamicClaim = { ...c, id: tempId, version: 1 };
      setState((prev) => ({ ...prev, claims: [created, ...prev.claims] }));
      const matchedAdjuster = state.users.find((u) => u.fullName === c.adjuster);
      syncCreate(
        tempId,
        '/api/v1/claims',
        {
          policyNumber: c.policyNumber,
          incidentDescription: c.incidentDescription,
          status: c.status,
          netPayout: c.netPayout,
          fraudScore: c.fraudScore,
          ...(matchedAdjuster ? { adjusterId: matchedAdjuster.id } : {}),
        },
        (realId, data: any) => {
          setState((prev) => ({
            ...prev,
            claims: prev.claims.map((item) =>
              item.id === tempId
                ? { ...item, id: realId, claimNumber: data?.claimNumber || item.claimNumber }
                : item
            ),
          }));
        }
      );
      return created;
    },
    [state.users, syncCreate]
  );

  const updateClaim = useCallback(
    (id: string, patch: Partial<DynamicClaim>) => {
      mutationSeqRef.current += 1;
      setState((prev) => ({
        ...prev,
        claims: prev.claims.map((c) => (c.id === id ? { ...c, ...patch, version: patch.version ?? c.version + 1 } : c)),
      }));
      const matchedAdjuster = patch.adjuster
        ? state.users.find((u) => u.fullName === patch.adjuster)
        : undefined;
      const body: Record<string, unknown> = {
        ...(patch.incidentDescription !== undefined ? { incidentDescription: patch.incidentDescription } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.netPayout !== undefined ? { netPayout: patch.netPayout } : {}),
        ...(patch.fraudScore !== undefined ? { fraudScore: patch.fraudScore } : {}),
        ...(matchedAdjuster ? { adjusterId: matchedAdjuster.id } : {}),
      };
      if (Object.keys(body).length > 0) {
        const hasLocalNestedOnly =
          patch.damages !== undefined ||
          patch.reconciliationItems !== undefined ||
          patch.fraudIndicators !== undefined;
        syncEntityMutation('PATCH', id, (rid) => `/api/v1/claims/${rid}`, body, !hasLocalNestedOnly);
      }
    },
    [state.users, syncEntityMutation]
  );

  const deleteClaim = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, claims: prev.claims.filter((c) => c.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/claims/${rid}`);
    },
    [syncEntityMutation]
  );

  // Policies CRUD -> Real NestJS + Neon DB
  const addPolicy = useCallback(
    (p: Omit<PolicyMasterDto, 'id'>) => {
      const tempId = `pol-${Date.now()}`;
      setState((prev) => ({ ...prev, policies: [{ ...p, id: tempId }, ...prev.policies] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/policies',
        {
          policyNumber: p.policyNumber,
          policyHolderId: p.policyHolderId,
          policyHolderName: p.policyHolderName,
          vehicleVin: p.vehicleVin,
          vehicleMake: p.vehicleMake,
          vehicleModel: p.vehicleModel,
          vehicleYear: p.vehicleYear,
          coverageLimit: p.coverageLimit,
          baseDeductible: p.baseDeductible,
          startDate: p.startDate,
          endDate: p.endDate,
          isActive: p.isActive,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            policies: prev.policies.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updatePolicy = useCallback(
    (id: string, patch: Partial<PolicyMasterDto>) => {
      setState((prev) => ({ ...prev, policies: prev.policies.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/policies/${rid}`, {
        ...(patch.vehicleVin !== undefined ? { vehicleVin: patch.vehicleVin } : {}),
        ...(patch.vehicleMake !== undefined ? { vehicleMake: patch.vehicleMake } : {}),
        ...(patch.vehicleModel !== undefined ? { vehicleModel: patch.vehicleModel } : {}),
        ...(patch.vehicleYear !== undefined ? { vehicleYear: patch.vehicleYear } : {}),
        ...(patch.coverageLimit !== undefined ? { coverageLimit: patch.coverageLimit } : {}),
        ...(patch.baseDeductible !== undefined ? { baseDeductible: patch.baseDeductible } : {}),
        ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
        ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deletePolicy = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, policies: prev.policies.filter((p) => p.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/policies/${rid}`);
    },
    [syncEntityMutation]
  );

  // Parts Catalog CRUD -> Real NestJS + Neon DB
  const addPart = useCallback(
    (p: Omit<VehiclePartCatalogDto, 'id'>) => {
      const tempId = `prt-${Date.now()}`;
      setState((prev) => ({ ...prev, partsCatalog: [{ ...p, id: tempId }, ...prev.partsCatalog] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/parts',
        {
          partCode: p.partCode,
          partName: p.partName,
          partType: p.partType,
          materialType: p.materialType,
          oemBasePrice: p.oemBasePrice,
          aftermarketPrice: p.aftermarketPrice,
          defaultLaborHours: p.defaultLaborHours,
          laborRatePerHour: p.laborRatePerHour,
          ...(p.depreciationOverridePct !== undefined && p.depreciationOverridePct !== null
            ? { depreciationOverridePct: p.depreciationOverridePct }
            : {}),
          isActive: p.isActive,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            partsCatalog: prev.partsCatalog.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updatePart = useCallback(
    (id: string, patch: Partial<VehiclePartCatalogDto>) => {
      setState((prev) => ({ ...prev, partsCatalog: prev.partsCatalog.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/parts/${rid}`, {
        ...(patch.partName !== undefined ? { partName: patch.partName } : {}),
        ...(patch.partType !== undefined ? { partType: patch.partType } : {}),
        ...(patch.materialType !== undefined ? { materialType: patch.materialType } : {}),
        ...(patch.oemBasePrice !== undefined ? { oemBasePrice: patch.oemBasePrice } : {}),
        ...(patch.aftermarketPrice !== undefined ? { aftermarketPrice: patch.aftermarketPrice } : {}),
        ...(patch.defaultLaborHours !== undefined ? { defaultLaborHours: patch.defaultLaborHours } : {}),
        ...(patch.laborRatePerHour !== undefined ? { laborRatePerHour: patch.laborRatePerHour } : {}),
        ...(patch.depreciationOverridePct !== undefined && patch.depreciationOverridePct !== null
          ? { depreciationOverridePct: patch.depreciationOverridePct }
          : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deletePart = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, partsCatalog: prev.partsCatalog.filter((p) => p.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/parts/${rid}`);
    },
    [syncEntityMutation]
  );

  // Depreciation Rules CRUD -> Real NestJS + Neon DB
  const addDepreciationRule = useCallback(
    (r: Omit<DepreciationRuleDto, 'id'>) => {
      const tempId = `dep-${Date.now()}`;
      setState((prev) => ({ ...prev, depreciationRules: [...prev.depreciationRules, { ...r, id: tempId }] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/depreciation-rules',
        {
          name: r.name,
          materialType: r.materialType,
          minVehicleAgeYears: r.minVehicleAgeYears,
          maxVehicleAgeYears: r.maxVehicleAgeYears,
          depreciationPercent: r.depreciationPercent,
          priority: r.priority,
          isActive: r.isActive,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            depreciationRules: prev.depreciationRules.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updateDepreciationRule = useCallback(
    (id: string, patch: Partial<DepreciationRuleDto>) => {
      setState((prev) => ({ ...prev, depreciationRules: prev.depreciationRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/depreciation-rules/${rid}`, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.materialType !== undefined ? { materialType: patch.materialType } : {}),
        ...(patch.minVehicleAgeYears !== undefined ? { minVehicleAgeYears: patch.minVehicleAgeYears } : {}),
        ...(patch.maxVehicleAgeYears !== undefined ? { maxVehicleAgeYears: patch.maxVehicleAgeYears } : {}),
        ...(patch.depreciationPercent !== undefined ? { depreciationPercent: patch.depreciationPercent } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteDepreciationRule = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, depreciationRules: prev.depreciationRules.filter((r) => r.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/depreciation-rules/${rid}`);
    },
    [syncEntityMutation]
  );

  // Automation Rules CRUD -> Real NestJS + Neon DB
  const addAutomationRule = useCallback(
    (r: Omit<AutomationRuleDto, 'id'>) => {
      const tempId = `ar-${Date.now()}`;
      setState((prev) => ({ ...prev, automationRules: [...prev.automationRules, { ...r, id: tempId }] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/automation-rules',
        {
          name: r.name,
          ruleType: r.ruleType,
          metricKey: r.metricKey,
          operator: r.operator,
          thresholdValue: r.thresholdValue,
          riskWeight: r.riskWeight,
          action: r.action,
          ...(r.description !== undefined ? { description: r.description } : {}),
          isActive: r.isActive,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            automationRules: prev.automationRules.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updateAutomationRule = useCallback(
    (id: string, patch: Partial<AutomationRuleDto>) => {
      setState((prev) => ({ ...prev, automationRules: prev.automationRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/automation-rules/${rid}`, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.ruleType !== undefined ? { ruleType: patch.ruleType } : {}),
        ...(patch.metricKey !== undefined ? { metricKey: patch.metricKey } : {}),
        ...(patch.operator !== undefined ? { operator: patch.operator } : {}),
        ...(patch.thresholdValue !== undefined ? { thresholdValue: patch.thresholdValue } : {}),
        ...(patch.riskWeight !== undefined ? { riskWeight: patch.riskWeight } : {}),
        ...(patch.action !== undefined ? { action: patch.action } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteAutomationRule = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, automationRules: prev.automationRules.filter((r) => r.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/automation-rules/${rid}`);
    },
    [syncEntityMutation]
  );

  // Garages CRUD -> Real NestJS + Neon DB
  const addGarage = useCallback(
    (g: Omit<RepairGarageDto, 'id'>) => {
      const tempId = `grg-${Date.now()}`;
      setState((prev) => ({ ...prev, garages: [{ ...g, id: tempId }, ...prev.garages] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/garages',
        {
          code: g.code,
          name: g.name,
          city: g.city,
          ...(g.taxId ? { taxId: g.taxId } : {}),
          hourlyLaborRate: g.hourlyLaborRate,
          rating: g.rating,
          isPreferredNetwork: g.isPreferredNetwork,
          isBlacklisted: g.isBlacklisted,
          ...(g.phone ? { phone: g.phone } : {}),
          ...(g.email ? { email: g.email } : {}),
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            garages: prev.garages.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updateGarage = useCallback(
    (id: string, patch: Partial<RepairGarageDto>) => {
      setState((prev) => ({ ...prev, garages: prev.garages.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/garages/${rid}`, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.taxId !== undefined ? { taxId: patch.taxId } : {}),
        ...(patch.hourlyLaborRate !== undefined ? { hourlyLaborRate: patch.hourlyLaborRate } : {}),
        ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
        ...(patch.isPreferredNetwork !== undefined ? { isPreferredNetwork: patch.isPreferredNetwork } : {}),
        ...(patch.isBlacklisted !== undefined ? { isBlacklisted: patch.isBlacklisted } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteGarage = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, garages: prev.garages.filter((g) => g.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/garages/${rid}`);
    },
    [syncEntityMutation]
  );

  // Dynamic Menus CRUD -> Real NestJS + Neon DB
  const addMenu = useCallback(
    (m: Omit<DynamicMenuItemDto, 'id'>) => {
      const tempId = `m-${Date.now()}`;
      setState((prev) => ({ ...prev, menus: [...prev.menus, { ...m, id: tempId }] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/menus',
        {
          menuKey: m.menuKey,
          label: m.label,
          ...(m.navLink ? { navLink: m.navLink } : {}),
          ...(m.icon ? { icon: m.icon } : {}),
          ...(m.parentKey ? { parentKey: m.parentKey } : {}),
          ...(m.requiredPermission ? { requiredPermission: m.requiredPermission } : {}),
          ...(m.badgeName ? { badgeName: m.badgeName } : {}),
          ...(m.badgeColor ? { badgeColor: m.badgeColor } : {}),
          sortOrder: m.sortOrder,
          isVisible: m.isVisible,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            menus: prev.menus.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updateMenu = useCallback(
    (id: string, patch: Partial<DynamicMenuItemDto>) => {
      setState((prev) => ({ ...prev, menus: prev.menus.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/menus/${rid}`, {
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.navLink !== undefined ? { navLink: patch.navLink } : {}),
        ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
        ...(patch.parentKey !== undefined && patch.parentKey !== null ? { parentKey: patch.parentKey } : {}),
        ...(patch.requiredPermission !== undefined && patch.requiredPermission !== null
          ? { requiredPermission: patch.requiredPermission }
          : {}),
        ...(patch.badgeName !== undefined && patch.badgeName !== null ? { badgeName: patch.badgeName } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.isVisible !== undefined ? { isVisible: patch.isVisible } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteMenu = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, menus: prev.menus.filter((m) => m.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/menus/${rid}`);
    },
    [syncEntityMutation]
  );

  const moveMenuOrder = useCallback(
    (id: string, direction: 'UP' | 'DOWN') => {
      const target = state.menus.find((m) => m.id === id);
      if (!target) return;
      const siblings = state.menus
        .filter((m) => (m.parentKey || null) === (target.parentKey || null))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex((s) => s.id === id);
      const swapIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return;
      const a = siblings[idx];
      const b = siblings[swapIdx];
      setState((prev) => ({
        ...prev,
        menus: prev.menus.map((m) => {
          if (m.id === a.id) return { ...m, sortOrder: b.sortOrder };
          if (m.id === b.id) return { ...m, sortOrder: a.sortOrder };
          return m;
        }),
      }));
      Promise.all([
        resolveRealId(a.id).then((rid) => apiRequest('PATCH', `/api/v1/super-admin/menus/${rid}`, { sortOrder: b.sortOrder })),
        resolveRealId(b.id).then((rid) => apiRequest('PATCH', `/api/v1/super-admin/menus/${rid}`, { sortOrder: a.sortOrder })),
      ]).then(() => refreshFromBackend());
    },
    [state.menus, resolveRealId, refreshFromBackend]
  );

  // Settings CRUD -> Real NestJS + Neon DB
  const upsertSetting = useCallback(
    (s: Omit<SystemSettingDto, 'id' | 'updatedAt'> & { id?: string }) => {
      const tempId = s.id || `set-${Date.now()}`;
      setState((prev) => {
        const exists = prev.settings.find((item) => item.id === s.id || item.key === s.key);
        if (exists) {
          return {
            ...prev,
            settings: prev.settings.map((item) =>
              item.id === exists.id ? { ...item, ...s, updatedAt: nowStamp() } : item
            ),
          };
        }
        return {
          ...prev,
          settings: [...prev.settings, { ...s, id: tempId, updatedAt: nowStamp() }],
        };
      });
      syncCreate(
        tempId,
        '/api/v1/super-admin/settings',
        {
          key: s.key,
          label: s.label,
          value: s.value,
          valueType: s.valueType || 'STRING',
          category: s.category,
          ...(s.description !== undefined ? { description: s.description } : {}),
          isEditable: s.isEditable ?? true,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            settings: prev.settings.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const deleteSetting = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, settings: prev.settings.filter((s) => s.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/settings/${rid}`);
    },
    [syncEntityMutation]
  );

  // Ledger Accounts & Journals CRUD -> Real NestJS + Neon DB
  const addLedgerAccount = useCallback(
    (a: Omit<DynamicLedgerAccount, 'id'>) => {
      const tempId = `la-${Date.now()}`;
      setState((prev) => ({ ...prev, ledgerAccounts: [...prev.ledgerAccounts, { ...a, id: tempId }] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/ledger-accounts',
        {
          accountNumber: a.accountNumber,
          name: a.name,
          type: a.type,
          isActive: a.isActive,
        },
        (realId) => {
          setState((prev) => ({
            ...prev,
            ledgerAccounts: prev.ledgerAccounts.map((item) => (item.id === tempId ? { ...item, id: realId } : item)),
          }));
        }
      );
    },
    [nextTempId, syncCreate]
  );

  const updateLedgerAccount = useCallback(
    (id: string, patch: Partial<DynamicLedgerAccount>) => {
      setState((prev) => ({ ...prev, ledgerAccounts: prev.ledgerAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/ledger-accounts/${rid}`, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteLedgerAccount = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, ledgerAccounts: prev.ledgerAccounts.filter((a) => a.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/ledger-accounts/${rid}`);
    },
    [syncEntityMutation]
  );

  const addJournalEntry = useCallback(
    (e: Omit<DynamicJournalEntry, 'id'>) => {
      const tempId = nextTempId('je');
      setState((prev) => ({ ...prev, journalEntries: [{ ...e, id: tempId }, ...prev.journalEntries] }));
      syncCreate(
        tempId,
        '/api/v1/super-admin/journals',
        {
          claimNumber: e.claimNumber,
          account: e.account,
          entryType: e.entryType,
          amount: e.amount,
          description: e.description,
        },
        (realCompositeId) => {
          setState((prev) => ({
            ...prev,
            journalEntries: prev.journalEntries.map((item) =>
              item.id === tempId ? { ...item, id: realCompositeId } : item
            ),
          }));
        },
        (data) => (data.id && data.lines?.[0]?.id ? `${data.id}:${data.lines[0].id}` : data.id)
      );
    },
    [nextTempId, syncCreate]
  );

  const updateJournalEntry = useCallback(
    (id: string, patch: Partial<DynamicJournalEntry>) => {
      setState((prev) => ({ ...prev, journalEntries: prev.journalEntries.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
      syncEntityMutation('PATCH', id, (rid) => `/api/v1/super-admin/journals/${encodeURIComponent(rid)}`, {
        ...(patch.claimNumber !== undefined ? { claimNumber: patch.claimNumber } : {}),
        ...(patch.account !== undefined ? { account: patch.account } : {}),
        ...(patch.entryType !== undefined ? { entryType: patch.entryType } : {}),
        ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.isReconciled !== undefined ? { isReconciled: patch.isReconciled } : {}),
      });
    },
    [syncEntityMutation]
  );

  const deleteJournalEntry = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, journalEntries: prev.journalEntries.filter((j) => j.id !== id) }));
      syncEntityMutation('DELETE', id, (rid) => `/api/v1/super-admin/journals/${encodeURIComponent(rid)}`);
    },
    [syncEntityMutation]
  );

  const resetStoreToDefaults = useCallback(() => {
    syncMutation('POST', '/api/v1/super-admin/database/reseed');
  }, [syncMutation]);

  return (
    <DynamicStoreContext.Provider
      value={{
        ...state,
        isBackendConnected,
        refreshFromBackend,
        updateSuperMasterPassword,
        appendSecurityAudit,
        appendFieldAudit,
        releasePresenceLease,
        addUser,
        updateUser,
        deleteUser,
        addRole,
        updateRole,
        deleteRole,
        updateRolePermissions,
        addPermission,
        updatePermission,
        deletePermission,
        addClaim,
        updateClaim,
        deleteClaim,
        addPolicy,
        updatePolicy,
        deletePolicy,
        addPart,
        updatePart,
        deletePart,
        addDepreciationRule,
        updateDepreciationRule,
        deleteDepreciationRule,
        addAutomationRule,
        updateAutomationRule,
        deleteAutomationRule,
        addGarage,
        updateGarage,
        deleteGarage,
        addMenu,
        updateMenu,
        deleteMenu,
        moveMenuOrder,
        upsertSetting,
        deleteSetting,
        addLedgerAccount,
        updateLedgerAccount,
        deleteLedgerAccount,
        addJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        resetStoreToDefaults,
      }}
    >
      {children}
    </DynamicStoreContext.Provider>
  );
}

export function useDynamicStore() {
  const ctx = useContext(DynamicStoreContext);
  if (!ctx) {
    throw new Error('useDynamicStore must be used inside DynamicStoreProvider');
  }
  return ctx;
}
