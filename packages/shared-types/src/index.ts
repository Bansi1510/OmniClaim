export type ClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AI_PROCESSING'
  | 'AI_ANALYSIS_FAILED'
  | 'TRIAGE_PENDING'
  | 'MANUAL_REVIEW'
  | 'APPROVED'
  | 'SETTLED'
  | 'REJECTED';

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
