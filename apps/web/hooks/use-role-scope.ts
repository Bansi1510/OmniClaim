'use client';

import { useCallback, useMemo } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useDynamicStore } from '@/hooks/use-dynamic-store';

/**
 * Role-wise data scope used by every page and grid.
 *  - Super Admin / God Mode bypass  -> everything
 *  - Operational roles (adjuster, SIU, finance, auditors ...) -> all claims & audit records
 *  - Claimant-style roles (only claims:read / claims:create) -> only their own policies, claims & audit rows
 */
export function useRoleScope() {
  const {
    userId,
    username,
    userName,
    activeRole,
    isSystemAdmin,
    bypassAllPermissions,
    hasAnyPermission,
    hasPermission,
  } = usePermissions();
  const { policies, claims, auditLogs } = useDynamicStore();

  const bypass = isSystemAdmin || bypassAllPermissions;
  const seesAll =
    bypass ||
    hasAnyPermission([
      'claims:update',
      'claims:approve',
      'claims:settle',
      'fraud:read',
      'ledger:read',
      'audit:read',
    ]);

  const ownPolicies = useMemo(
    () =>
      policies.filter(
        (p) =>
          p.policyHolderId === userId ||
          (userName && p.policyHolderName.toLowerCase() === userName.toLowerCase())
      ),
    [policies, userId, userName]
  );
  const ownPolicyNumbers = useMemo(
    () => new Set(ownPolicies.map((p) => p.policyNumber)),
    [ownPolicies]
  );

  const visibleClaims = useMemo(
    () => (seesAll ? claims : claims.filter((c) => ownPolicyNumbers.has(c.policyNumber))),
    [seesAll, claims, ownPolicyNumbers]
  );
  const visiblePolicies = seesAll ? policies : ownPolicies;

  const visibleClaimNumbers = useMemo(
    () => new Set(visibleClaims.map((c) => c.claimNumber)),
    [visibleClaims]
  );

  const visibleAuditLogs = useMemo(
    () => (seesAll ? auditLogs : auditLogs.filter((a) => visibleClaimNumbers.has(a.claimNumber))),
    [seesAll, auditLogs, visibleClaimNumbers]
  );

  const canSeeFraud =
    bypass || hasAnyPermission(['fraud:read', 'fraud:override', 'fraud:flag', 'claims:update']);
  const canSeeFinancials =
    bypass || hasAnyPermission(['claims:update', 'claims:approve', 'claims:settle', 'ledger:read']);
  const canExport =
    bypass || hasAnyPermission(['reports:export', 'ledger:export', 'claims:update', 'audit:read']);

  const canAccessClaim = useCallback(
    (claim: { policyNumber: string } | undefined | null): boolean =>
      Boolean(claim) && (seesAll || ownPolicyNumbers.has(claim!.policyNumber)),
    [seesAll, ownPolicyNumbers]
  );

  const defaultLandingRoute = useMemo(() => {
    if (bypass) return '/super-admin';
    if (hasPermission('claims:read')) return '/claims';
    if (hasPermission('ledger:read')) return '/ledger';
    if (hasPermission('audit:read')) return '/audit';
    if (
      hasAnyPermission([
        'rbac:roles_read',
        'rbac:roles_create',
        'rbac:roles_update',
        'rbac:roles_assign',
      ])
    ) {
      return '/admin/roles';
    }
    if (
      hasAnyPermission([
        'rbac:users_read',
        'rbac:users_create',
        'rbac:users_update',
        'rbac:users_assign',
      ])
    ) {
      return '/admin/users';
    }
    return '/login';
  }, [bypass, hasPermission, hasAnyPermission]);

  const scopeLabel = bypass
    ? 'Super Admin — all records (permissions skipped)'
    : seesAll
      ? `${activeRole} — all claims (operational role)`
      : `${activeRole} — own policies & claims only (@${username})`;

  return {
    bypass,
    seesAll,
    visibleClaims,
    visiblePolicies,
    visibleClaimNumbers,
    visibleAuditLogs,
    canSeeFraud,
    canSeeFinancials,
    canExport,
    canAccessClaim,
    defaultLandingRoute,
    scopeLabel,
    totalClaims: claims.length,
    hasPermission,
    hasAnyPermission,
  };
}
