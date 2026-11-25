'use client';

import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface CanProps {
  permission: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * UI Component Guard: Conditionally renders UI actions only if user has authorized permissions.
 * Example:
 * <Can permission="claims:approve">
 *   <button>Approve Claim</button>
 * </Can>
 */
export function Can({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: CanProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) return null;

  let allowed = false;

  if (typeof permission === 'string') {
    allowed = hasPermission(permission);
  } else if (Array.isArray(permission)) {
    allowed = requireAll ? hasAllPermissions(permission) : hasAnyPermission(permission);
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
