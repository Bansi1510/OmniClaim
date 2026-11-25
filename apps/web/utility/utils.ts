/**
 * Exact permission evaluation logic from C:\college erp\kn_college_erp_react_frontend\src\utility\Utils.jsx
 *
 * @param userPermissions - Array of permission slugs currently held by user
 * @param permissionsToCheck - Array of required permission slugs
 * @param useAndCondition - If true, requires all; if false, requires any
 */
export const checkPermission = (
  userPermissions: string[] = [],
  permissionsToCheck: string[] = [],
  useAndCondition: boolean = false
): boolean => {
  if (!Array.isArray(permissionsToCheck) || permissionsToCheck.length === 0) {
    return true;
  }

  // Super Admin gets unrestricted access
  if (userPermissions.includes('SUPER_ADMIN')) {
    return true;
  }

  if (useAndCondition) {
    return permissionsToCheck.every((permission) => userPermissions.includes(permission));
  } else {
    return permissionsToCheck.some((permission) => userPermissions.includes(permission));
  }
};
