import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Decorator to enforce granular dynamic permissions on endpoints.
 * Example: @RequirePermissions('claims:approve', 'claims:override_reconciliation')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
