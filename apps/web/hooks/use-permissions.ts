'use client';

import { useState, useEffect } from 'react';

// Client-side permissions hook matching college erp checkPermission utility
export function usePermissions() {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In production, fetch from /api/v1/rbac/user-permissions
    // Seed with current active role rights (SUPER_ADMIN by default for local testing)
    const defaultPerms = [
      'claims:read',
      'claims:create',
      'claims:update',
      'claims:triage',
      'claims:approve',
      'claims:reject',
      'claims:settle',
      'claims:override_reconciliation',
      'ledger:read',
      'ledger:post',
      'fraud:read',
      'fraud:override',
      'rbac:roles_create',
      'rbac:roles_update',
      'audit:read',
    ];

    setPermissions(new Set(defaultPerms));
    setIsLoading(false);
  }, []);

  const hasPermission = (slug: string): boolean => {
    return permissions.has(slug);
  };

  const hasAnyPermission = (slugs: string[]): boolean => {
    return slugs.some((s) => permissions.has(s));
  };

  const hasAllPermissions = (slugs: string[]): boolean => {
    return slugs.every((s) => permissions.has(s));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
  };
}
