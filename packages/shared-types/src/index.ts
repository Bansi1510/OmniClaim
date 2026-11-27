export type ClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AI_PROCESSING'
  | 'AI_ANALYSIS_FAILED'
  | 'TRIAGE_PENDING'
  | 'MANUAL_REVIEW'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'SETTLED'
  | 'REJECTED'
  | 'DISPUTED'
  | 'REOPENED';

export type VehiclePartType =
  | 'BUMPER_FRONT'
  | 'BUMPER_REAR'
  | 'HOOD_BONNET'
  | 'FENDER_LEFT'
  | 'FENDER_RIGHT'
  | 'DOOR_FRONT_LEFT'
  | 'DOOR_FRONT_RIGHT'
  | 'DOOR_REAR_LEFT'
  | 'DOOR_REAR_RIGHT'
  | 'WINDSHIELD_FRONT'
  | 'WINDSHIELD_REAR'
  | 'HEADLIGHT_LEFT'
  | 'HEADLIGHT_RIGHT'
  | 'TAILLIGHT_LEFT'
  | 'TAILLIGHT_RIGHT'
  | 'ROOF'
  | 'SIDE_MIRROR'
  | 'QUARTER_PANEL'
  | 'ALLOY_WHEEL'
  | 'CHASSIS_UNDERBODY';

export type MaterialType = 'PLASTIC' | 'METAL' | 'GLASS' | 'RUBBER' | 'FIBERGLASS';

export type DamageSeverity =
  | 'SCRATCH'
  | 'DENT'
  | 'TEAR_PUNCTURE'
  | 'SHATTERED'
  | 'STRUCTURAL_TOTAL';

export type FraudRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BoundingBox {
  xmin: number; // 0.0 to 1.0 (normalized)
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface DetectedDamageDto {
  id: string;
  evidenceId: string;
  partType: VehiclePartType;
  materialType: MaterialType;
  severity: DamageSeverity;
  confidence: number;
  boundingBox: BoundingBox;
  repairAction: 'REPAIR' | 'REPLACE';
  isManualAdded?: boolean;
}

export interface ReconciledLineItemDto {
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

export interface FraudScorecardDto {
  compositeScore: number;
  riskTier: FraudRiskTier;
  notes?: string;
  indicators: Array<{
    type: string;
    riskContribution: number;
    evidenceMetadata: Record<string, unknown>;
    isOverridden: boolean;
  }>;
}

export interface ActuarialSummaryDto {
  grossPartsTotal: number;
  metalDepreciation: number;
  plasticDepreciation: number;
  glassDepreciation: number;
  totalDepreciation: number;
  totalLaborApproved: number;
  applicableDeductible: number;
  salvageValue: number;
  netPayout: number;
  isStpQualified: boolean;
}

export interface ClaimDetailsResponseDto {
  id: string;
  claimNumber: string;
  policyNumber: string;
  status: ClaimStatus;
  version: number;
  incidentDate: string;
  incidentLatitude: number;
  incidentLongitude: number;
  vehicle: {
    vin: string;
    make: string;
    model: string;
    year: number;
  };
  evidences: Array<{
    id: string;
    fileUrl: string;
    deviceGps: { latitude: number; longitude: number };
    isMockLocation: boolean;
    damages: DetectedDamageDto[];
  }>;
  reconciliation?: {
    totalBilledAmount: number;
    totalApprovedAmount: number;
    totalPhantomAmount: number;
    discrepancyCount: number;
    items: ReconciledLineItemDto[];
  };
  actuarialAssessment?: ActuarialSummaryDto;
  fraudScorecard?: FraudScorecardDto;
  activeLock?: {
    userId: string;
    userEmail: string;
    lockedAt: string;
    expiresAt: string;
  } | null;
}

/**
 * Exact permission evaluation logic from C:\college erp\kn_college_erp_react_frontend\src\utility\Utils.jsx
 */
export const checkPermission = (
  userPermissions: string[] = [],
  permissionsToCheck: string[] = [],
  useAndCondition: boolean = false
): boolean => {
  if (!Array.isArray(permissionsToCheck) || permissionsToCheck.length === 0) {
    return true;
  }

  // Super Admin wildcard unrestricted access
  if (userPermissions.includes('SUPER_ADMIN') || userPermissions.includes('*')) {
    return true;
  }

  if (useAndCondition) {
    return permissionsToCheck.every((permission) => userPermissions.includes(permission));
  } else {
    return permissionsToCheck.some((permission) => userPermissions.includes(permission));
  }
};

export const ROLE_PRESETS: Record<string, { name: string; slug: string; isSystemAdmin: boolean; permissions: string[] }> = {
  SUPER_ADMIN: {
    name: 'Super Administrator',
    slug: 'SUPER_ADMIN',
    isSystemAdmin: true,
    permissions: ['*'],
  },
  CLAIMS_ADJUSTER: {
    name: 'Senior Claims Adjuster',
    slug: 'CLAIMS_ADJUSTER',
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
    slug: 'SIU_INVESTIGATOR',
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
    slug: 'FINANCE_OFFICER',
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
    slug: 'POLICYHOLDER',
    isSystemAdmin: false,
    permissions: [
      'claims:read',
      'claims:create',
    ],
  },
};


// ==========================================
// SUPER ADMIN, MASTER PASSWORD & DYNAMIC CRUD TYPES
// ==========================================

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET';
export type AutomationRuleType = 'STP' | 'FRAUD' | 'WORKFLOW';
export type AuthMethodType = 'PASSWORD' | 'SUPER_MASTER_PASSWORD' | 'IMPERSONATION';

export interface AuthUserSession {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleSlug: string;
  roleName: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  isMasterLogin: boolean;
  bypassAllPermissions: boolean;
  accessToken?: string;
}

export interface SystemSettingDto {
  id: string;
  key: string;
  label: string;
  value: string;
  valueType: SettingValueType;
  category: string;
  description?: string;
  isEditable: boolean;
  updatedAt: string;
}

export interface PolicyMasterDto {
  id: string;
  policyNumber: string;
  policyHolderName: string;
  policyHolderId: string;
  vehicleVin: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  coverageLimit: number;
  baseDeductible: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface VehiclePartCatalogDto {
  id: string;
  partCode: string;
  partName: string;
  partType: VehiclePartType;
  materialType: MaterialType;
  oemBasePrice: number;
  aftermarketPrice: number;
  defaultLaborHours: number;
  laborRatePerHour: number;
  depreciationOverridePct?: number | null;
  isActive: boolean;
}

export interface DepreciationRuleDto {
  id: string;
  name: string;
  materialType: MaterialType;
  minVehicleAgeYears: number;
  maxVehicleAgeYears: number;
  depreciationPercent: number;
  priority: number;
  isActive: boolean;
}

export interface AutomationRuleDto {
  id: string;
  name: string;
  ruleType: AutomationRuleType;
  metricKey: string;
  operator: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ' | 'NEQ';
  thresholdValue: string;
  riskWeight: number;
  action: string;
  description?: string;
  isActive: boolean;
}

export interface RepairGarageDto {
  id: string;
  code: string;
  name: string;
  city: string;
  taxId?: string;
  hourlyLaborRate: number;
  rating: number;
  isPreferredNetwork: boolean;
  isBlacklisted: boolean;
  phone?: string;
  email?: string;
}

export interface DynamicMenuItemDto {
  id: string;
  menuKey: string;
  label: string;
  navLink?: string;
  icon: string;
  parentKey?: string | null;
  requiredPermission?: string | null;
  badgeName?: string | null;
  badgeColor?: string | null;
  sortOrder: number;
  isVisible: boolean;
  isSystem?: boolean;
}

export interface SecurityAuditLogDto {
  id: string;
  eventType:
    | 'LOGIN_PASSWORD'
    | 'LOGIN_SUPER_MASTER_PASSWORD'
    | 'IMPERSONATION_START'
    | 'MASTER_PASSWORD_ROTATED'
    | 'SUPER_ADMIN_OVERRIDE'
    | 'LOGIN_FAILED';
  targetUserId?: string | null;
  actorIdentifier: string;
  platform: 'WEB' | 'MOBILE' | 'API';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditFieldChangeDto {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SystemActivityAuditLogDto {
  id: string;
  method: string;
  path: string;
  routePattern?: string | null;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  action: string;
  statusCode: number;
  success: boolean;
  durationMs: number;
  userId?: string | null;
  username?: string | null;
  userEmail?: string | null;
  userFullName?: string | null;
  userRole?: string | null;
  isMasterLogin: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  queryParams?: Record<string, unknown> | null;
  requestBody?: Record<string, unknown> | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: AuditFieldChangeDto[] | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface AuditStatsDto {
  total: number;
  byMethod: Record<string, number>;
  byModule: Record<string, number>;
  errorCount: number;
  masterOverrideCount: number;
  avgDurationMs: number;
}

export const DEFAULT_SUPER_MASTER_PASSWORD = 'OmniMaster#2026!';
