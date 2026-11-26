'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

const DEFAULT_PERMISSIONS_CATALOG: DynamicPermission[] = [
  { id: 'p-0', slug: 'superadmin:access', module: 'SUPER_ADMIN', action: 'GOD MODE', description: 'Unrestricted Super Admin command center access' },
  { id: 'p-1', slug: 'claims:read', module: 'CLAIMS', action: 'VIEW', description: 'View claims list and detail dossiers' },
  { id: 'p-2', slug: 'claims:create', module: 'CLAIMS', action: 'CREATE', description: 'Initiate new auto accident claims' },
  { id: 'p-3', slug: 'claims:update', module: 'CLAIMS', action: 'EDIT', description: 'Modify claim metadata and insured vehicle info' },
  { id: 'p-4', slug: 'claims:delete', module: 'CLAIMS', action: 'DELETE', description: 'Delete claims from triage queue' },
  { id: 'p-5', slug: 'claims:triage', module: 'CLAIMS', action: 'TRIAGE', description: 'Triage and dispatch claims to adjusters' },
  { id: 'p-6', slug: 'claims:approve', module: 'CLAIMS', action: 'APPROVE', description: 'Authorize formal claim approvals' },
  { id: 'p-7', slug: 'claims:reject', module: 'CLAIMS', action: 'REJECT', description: 'Reject claim with documented justification' },
  { id: 'p-8', slug: 'claims:settle', module: 'CLAIMS', action: 'SETTLE', description: 'Disburse payouts and post balanced ledger vouchers' },
  { id: 'p-9', slug: 'claims:override_reconciliation', module: 'RECONCILIATION', action: 'OVERRIDE', description: 'Manually override phantom item deductions' },
  { id: 'p-10', slug: 'fraud:read', module: 'FRAUD', action: 'VIEW', description: 'View composite risk scorecards and triggered flags' },
  { id: 'p-11', slug: 'fraud:override', module: 'FRAUD', action: 'OVERRIDE', description: 'Documented override of triggered fraud indicators' },
  { id: 'p-12', slug: 'fraud:flag', module: 'FRAUD', action: 'FLAG SIU', description: 'Refer claim for deep SIU fraud investigation' },
  { id: 'p-13', slug: 'ledger:read', module: 'LEDGER', action: 'VIEW', description: 'Inspect general ledger journals and balance sheets' },
  { id: 'p-14', slug: 'ledger:reconcile', module: 'LEDGER', action: 'RECONCILE', description: 'Mark ledger vouchers as reconciled' },
  { id: 'p-15', slug: 'ledger:override', module: 'LEDGER', action: 'OVERRIDE', description: 'Post, edit, or void manual ledger vouchers & accounts' },
  { id: 'p-16', slug: 'reports:read', module: 'REPORTS', action: 'VIEW', description: 'Inspect analytics and executive reports' },
  { id: 'p-17', slug: 'reports:export', module: 'REPORTS', action: 'EXPORT', description: 'Export GAAP/IFRS compliant financial statements' },
  { id: 'p-18', slug: 'rbac:roles_create', module: 'RBAC', action: 'CREATE ROLE', description: 'Create new custom enterprise roles' },
  { id: 'p-19', slug: 'rbac:roles_update', module: 'RBAC', action: 'EDIT RIGHTS', description: 'Modify role permission bindings' },
  { id: 'p-20', slug: 'rbac:roles_delete', module: 'RBAC', action: 'DELETE ROLE', description: 'Delete non-system custom roles' },
  { id: 'p-21', slug: 'rbac:roles_assign', module: 'RBAC', action: 'ASSIGN RIGHTS', description: 'Open rights accordion for a role' },
  { id: 'p-22', slug: 'rbac:users_assign', module: 'RBAC', action: 'MANAGE USERS', description: 'Create, edit, delete users and assign roles' },
  { id: 'p-23', slug: 'audit:read', module: 'AUDIT', action: 'VIEW LOGS', description: 'Inspect immutable time-travel audit records' },
  { id: 'p-24', slug: 'presence:unlock', module: 'AUDIT', action: 'FORCE UNLOCK', description: 'Force release active adjuster presence lock' },
];

const DEFAULT_ROLES: DynamicRole[] = [
  {
    id: 'role-super-admin',
    name: 'Super Administrator',
    slug: 'SUPER_ADMIN',
    description: 'Unrestricted enterprise administrative access — skips all permission checks globally',
    isSystem: true,
    permissions: ['*'],
  },
  {
    id: 'role-senior-adjuster',
    name: 'Senior Claims Adjuster',
    slug: 'CLAIMS_ADJUSTER',
    description: 'Assesses high-value claims, approves assessments, and overrides phantom line items',
    isSystem: true,
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
  {
    id: 'role-fraud-siu',
    name: 'SIU Fraud Investigator',
    slug: 'SIU_INVESTIGATOR',
    description: 'Special Investigation Unit: reviews vector similarities, GPS anomalies, and SIU referrals',
    isSystem: true,
    permissions: ['claims:read', 'fraud:read', 'fraud:override', 'fraud:flag', 'reports:read', 'audit:read'],
  },
  {
    id: 'role-finance-controller',
    name: 'Finance & Settlement Officer',
    slug: 'FINANCE_OFFICER',
    description: 'Audits balanced double-entry accounting ledgers and authorizes disbursement vouchers',
    isSystem: true,
    permissions: ['claims:read', 'claims:settle', 'ledger:read', 'ledger:reconcile', 'ledger:override', 'reports:read', 'reports:export'],
  },
  {
    id: 'role-policyholder',
    name: 'Policyholder / Claimant',
    slug: 'POLICYHOLDER',
    description: 'Driver / Vehicle Owner: self-service accident intake and payout tracker',
    isSystem: true,
    permissions: ['claims:read', 'claims:create'],
  },
];

const DEFAULT_USERS: DynamicUser[] = [
  {
    id: 'u-1',
    username: 'superadmin',
    email: 'admin@omniclaim.internal',
    fullName: 'Chief Enterprise Admin',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'SUPER_ADMIN',
    roleName: 'Super Administrator',
    isActive: true,
    isSuperAdmin: true,
    assignedAt: '2026-11-20',
  },
  {
    id: 'u-2',
    username: 'sarah.jenkins',
    email: 'adjuster.senior@omniclaim.internal',
    fullName: 'Sarah Jenkins',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'CLAIMS_ADJUSTER',
    roleName: 'Senior Claims Adjuster',
    isActive: true,
    isSuperAdmin: false,
    assignedAt: '2026-11-21',
  },
  {
    id: 'u-3',
    username: 'marcus.vance',
    email: 'fraud.siu@omniclaim.internal',
    fullName: 'Marcus Vance',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'SIU_INVESTIGATOR',
    roleName: 'SIU Fraud Investigator',
    isActive: true,
    isSuperAdmin: false,
    assignedAt: '2026-11-22',
  },
  {
    id: 'u-4',
    username: 'david.sterling',
    email: 'finance.controller@omniclaim.internal',
    fullName: 'David Sterling',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'FINANCE_OFFICER',
    roleName: 'Finance & Settlement Officer',
    isActive: true,
    isSuperAdmin: false,
    assignedAt: '2026-11-23',
  },
  {
    id: 'u-5',
    username: 'alex.rivera',
    email: 'policyholder.demo@omniclaim.internal',
    fullName: 'Alex Rivera',
    password: 'AdminOmniClaim2026!',
    roleSlug: 'POLICYHOLDER',
    roleName: 'Policyholder / Claimant',
    isActive: true,
    isSuperAdmin: false,
    assignedAt: '2026-11-24',
  },
];

const DEFAULT_CLAIMS: DynamicClaim[] = [
  {
    id: 'clm-001',
    claimNumber: 'CLM-202611-9102',
    policyNumber: 'POL-OMNI-2026-9081',
    vehicle: '2022 Honda Accord Touring (VIN: 1HGCR2F83HA001928)',
    incidentDate: '2026-11-24 14:30',
    incidentDescription: 'Front-left intersection collision at low speed during rain.',
    status: 'TRIAGE_PENDING',
    version: 1,
    fraudScore: 25,
    riskTier: 'MEDIUM',
    netPayout: 675.0,
    deductible: 500.0,
    adjuster: 'Sarah Jenkins',
    damages: [
      {
        id: 'dmg-1',
        evidenceId: 'ev-1',
        partType: 'BUMPER_FRONT',
        materialType: 'PLASTIC',
        severity: 'DENT',
        confidence: 0.94,
        boundingBox: { xmin: 0.18, ymin: 0.48, xmax: 0.82, ymax: 0.9 },
        repairAction: 'REPLACE',
      },
      {
        id: 'dmg-2',
        evidenceId: 'ev-1',
        partType: 'HEADLIGHT_LEFT',
        materialType: 'GLASS',
        severity: 'SHATTERED',
        confidence: 0.88,
        boundingBox: { xmin: 0.22, ymin: 0.38, xmax: 0.38, ymax: 0.52 },
        repairAction: 'REPLACE',
      },
    ],
    reconciliationItems: [
      {
        id: 'rec-1',
        billLineItemId: 'bli-1',
        rawDescription: 'OEM Front Bumper Assembly Replacement',
        claimedCost: 450.0,
        isLabor: false,
        isVerifiedByDamage: true,
        matchedDamagePart: 'BUMPER_FRONT',
        systemDeduction: 0,
        approvedCost: 450.0,
        rejectionReason: null,
        isManualOverride: false,
        overrideReason: null,
      },
      {
        id: 'rec-2',
        billLineItemId: 'bli-2',
        rawDescription: 'Body Panel Paint & Refinish Labor 2.5 hrs',
        claimedCost: 225.0,
        isLabor: true,
        isVerifiedByDamage: true,
        matchedDamagePart: null,
        systemDeduction: 0,
        approvedCost: 225.0,
        rejectionReason: null,
        isManualOverride: false,
        overrideReason: null,
      },
      {
        id: 'rec-3',
        billLineItemId: 'bli-3',
        rawDescription: 'Rear Bumper Impact Reinforcement Bar',
        claimedCost: 180.0,
        isLabor: false,
        isVerifiedByDamage: false,
        matchedDamagePart: null,
        systemDeduction: 180.0,
        approvedCost: 0,
        rejectionReason: 'Phantom charge: No damage detected on rear bumper',
        isManualOverride: false,
        overrideReason: null,
      },
    ],
    fraudIndicators: [
      {
        id: 'fi-1',
        type: 'EXIF_GPS_MISMATCH',
        riskContribution: 25,
        evidenceMetadata: { distanceMeters: 1820, reason: 'Device EXIF GPS is 1.8km from claimed accident location' },
        isOverridden: false,
      },
    ],
  },
  {
    id: 'clm-002',
    claimNumber: 'CLM-202611-8401',
    policyNumber: 'POL-OMNI-2026-3120',
    vehicle: '2024 Toyota RAV4 Hybrid (VIN: 2T3C1RFV5PC082194)',
    incidentDate: '2026-11-23 09:15',
    incidentDescription: 'Parking lot minor bumper scuff — STP qualified.',
    status: 'SETTLED',
    version: 3,
    fraudScore: 8,
    riskTier: 'LOW',
    netPayout: 520.0,
    deductible: 250.0,
    adjuster: 'Autonomous STP',
    damages: [
      {
        id: 'dmg-3',
        evidenceId: 'ev-2',
        partType: 'BUMPER_REAR',
        materialType: 'PLASTIC',
        severity: 'SCRATCH',
        confidence: 0.96,
        boundingBox: { xmin: 0.25, ymin: 0.55, xmax: 0.72, ymax: 0.85 },
        repairAction: 'REPAIR',
      },
    ],
    reconciliationItems: [
      {
        id: 'rec-4',
        billLineItemId: 'bli-4',
        rawDescription: 'Rear Bumper Refinish & Clearcoat',
        claimedCost: 520.0,
        isLabor: true,
        isVerifiedByDamage: true,
        matchedDamagePart: 'BUMPER_REAR',
        systemDeduction: 0,
        approvedCost: 520.0,
        rejectionReason: null,
        isManualOverride: false,
        overrideReason: null,
      },
    ],
    fraudIndicators: [],
  },
  {
    id: 'clm-003',
    claimNumber: 'CLM-202611-4092',
    policyNumber: 'POL-OMNI-2026-7782',
    vehicle: '2020 Ford F-150 Lariat (VIN: 1FTFW1E84LFA99021)',
    incidentDate: '2026-11-22 18:45',
    incidentDescription: 'Multi-panel highway sideswipe flagged by vector similarity.',
    status: 'MANUAL_REVIEW',
    version: 2,
    fraudScore: 75,
    riskTier: 'CRITICAL',
    netPayout: 3450.0,
    deductible: 1000.0,
    adjuster: 'Marcus Vance (SIU)',
    damages: [
      {
        id: 'dmg-4',
        evidenceId: 'ev-3',
        partType: 'DOOR_FRONT_LEFT',
        materialType: 'METAL',
        severity: 'DENT',
        confidence: 0.91,
        boundingBox: { xmin: 0.15, ymin: 0.35, xmax: 0.65, ymax: 0.8 },
        repairAction: 'REPLACE',
      },
    ],
    reconciliationItems: [
      {
        id: 'rec-5',
        billLineItemId: 'bli-5',
        rawDescription: 'Driver Front Door Shell OEM',
        claimedCost: 2200.0,
        isLabor: false,
        isVerifiedByDamage: true,
        matchedDamagePart: 'DOOR_FRONT_LEFT',
        systemDeduction: 0,
        approvedCost: 2200.0,
        rejectionReason: null,
        isManualOverride: false,
        overrideReason: null,
      },
      {
        id: 'rec-6',
        billLineItemId: 'bli-6',
        rawDescription: 'Full Frame Pull & Alignment Labor',
        claimedCost: 1250.0,
        isLabor: true,
        isVerifiedByDamage: true,
        matchedDamagePart: null,
        systemDeduction: 0,
        approvedCost: 1250.0,
        rejectionReason: null,
        isManualOverride: false,
        overrideReason: null,
      },
    ],
    fraudIndicators: [
      {
        id: 'fi-2',
        type: 'VECTOR_SIMILARITY_DUPLICATE',
        riskContribution: 50,
        evidenceMetadata: { cosineSimilarity: 0.964, matchedClaim: 'CLM-202508-1142' },
        isOverridden: false,
      },
      {
        id: 'fi-3',
        type: 'EXIF_GPS_MISMATCH',
        riskContribution: 25,
        evidenceMetadata: { distanceMeters: 4210, reason: 'Photo taken 4.2km away from incident coordinates' },
        isOverridden: false,
      },
    ],
  },
];

const DEFAULT_POLICIES: PolicyMasterDto[] = [
  {
    id: 'pol-1',
    policyNumber: 'POL-OMNI-2026-9081',
    policyHolderName: 'Alex Rivera',
    policyHolderId: 'u-5',
    vehicleVin: '1HGCR2F83HA001928',
    vehicleMake: 'Honda',
    vehicleModel: 'Accord Touring',
    vehicleYear: 2022,
    coverageLimit: 50000,
    baseDeductible: 500,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    isActive: true,
  },
  {
    id: 'pol-2',
    policyNumber: 'POL-OMNI-2026-3120',
    policyHolderName: 'Elena Rostova',
    policyHolderId: 'u-5',
    vehicleVin: '2T3C1RFV5PC082194',
    vehicleMake: 'Toyota',
    vehicleModel: 'RAV4 Hybrid',
    vehicleYear: 2024,
    coverageLimit: 75000,
    baseDeductible: 250,
    startDate: '2026-03-01',
    endDate: '2027-03-01',
    isActive: true,
  },
  {
    id: 'pol-3',
    policyNumber: 'POL-OMNI-2026-7782',
    policyHolderName: 'Robert Chen',
    policyHolderId: 'u-5',
    vehicleVin: '1FTFW1E84LFA99021',
    vehicleMake: 'Ford',
    vehicleModel: 'F-150 Lariat',
    vehicleYear: 2020,
    coverageLimit: 60000,
    baseDeductible: 1000,
    startDate: '2025-12-01',
    endDate: '2026-12-01',
    isActive: true,
  },
];

const DEFAULT_PARTS: VehiclePartCatalogDto[] = [
  { id: 'prt-1', partCode: 'PRT-BUMP-FRT', partName: 'OEM Front Bumper Assembly', partType: 'BUMPER_FRONT', materialType: 'PLASTIC', oemBasePrice: 450, aftermarketPrice: 290, defaultLaborHours: 2.5, laborRatePerHour: 90, isActive: true },
  { id: 'prt-2', partCode: 'PRT-HDLT-LFT', partName: 'LED Headlight Assembly (Left)', partType: 'HEADLIGHT_LEFT', materialType: 'GLASS', oemBasePrice: 380, aftermarketPrice: 220, defaultLaborHours: 1.0, laborRatePerHour: 90, isActive: true },
  { id: 'prt-3', partCode: 'PRT-HOOD-OEM', partName: 'Sheet Metal Hood / Bonnet Panel', partType: 'HOOD_BONNET', materialType: 'METAL', oemBasePrice: 680, aftermarketPrice: 460, defaultLaborHours: 3.5, laborRatePerHour: 95, isActive: true },
  { id: 'prt-4', partCode: 'PRT-WNDS-FRT', partName: 'Acoustic Laminated Windshield', partType: 'WINDSHIELD_FRONT', materialType: 'GLASS', oemBasePrice: 520, aftermarketPrice: 340, defaultLaborHours: 2.0, laborRatePerHour: 85, isActive: true },
];

const DEFAULT_DEPRECIATION_RULES: DepreciationRuleDto[] = [
  { id: 'dep-1', name: 'Automotive Glass Zero Depreciation', materialType: 'GLASS', minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 0, priority: 1, isActive: true },
  { id: 'dep-2', name: 'Plastic & Composite Flat 50%', materialType: 'PLASTIC', minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 2, isActive: true },
  { id: 'dep-3', name: 'Sheet Metal (0-1 Yr)', materialType: 'METAL', minVehicleAgeYears: 0, maxVehicleAgeYears: 1, depreciationPercent: 0, priority: 3, isActive: true },
  { id: 'dep-4', name: 'Sheet Metal (2 Yrs)', materialType: 'METAL', minVehicleAgeYears: 2, maxVehicleAgeYears: 2, depreciationPercent: 10, priority: 4, isActive: true },
  { id: 'dep-5', name: 'Sheet Metal (3 Yrs)', materialType: 'METAL', minVehicleAgeYears: 3, maxVehicleAgeYears: 3, depreciationPercent: 20, priority: 5, isActive: true },
  { id: 'dep-6', name: 'Sheet Metal (4 Yrs)', materialType: 'METAL', minVehicleAgeYears: 4, maxVehicleAgeYears: 4, depreciationPercent: 30, priority: 6, isActive: true },
  { id: 'dep-7', name: 'Sheet Metal (5+ Yrs Statutory Cap)', materialType: 'METAL', minVehicleAgeYears: 5, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 7, isActive: true },
];

const DEFAULT_AUTOMATION_RULES: AutomationRuleDto[] = [
  { id: 'ar-1', name: 'STP Fast-Track Ceiling', ruleType: 'STP', metricKey: 'netPayout', operator: 'LTE', thresholdValue: '750', riskWeight: 0, action: 'AUTO_SETTLE', description: 'Qualifies for autonomous payout when net payout <= $750', isActive: true },
  { id: 'ar-2', name: 'EXIF GPS Mismatch Rule', ruleType: 'FRAUD', metricKey: 'gpsDistanceMeters', operator: 'GT', thresholdValue: '1000', riskWeight: 25, action: 'ADD_RISK_SCORE', description: 'Adds +25 risk points when EXIF GPS > 1km from accident site', isActive: true },
  { id: 'ar-3', name: 'Mock Location Spoofing', ruleType: 'FRAUD', metricKey: 'isMockLocation', operator: 'EQ', thresholdValue: 'true', riskWeight: 40, action: 'FLAG_SIU', description: 'Immediate SIU escalation on spoofed hardware telemetry', isActive: true },
  { id: 'ar-4', name: 'CLIP Vector Reuse Check', ruleType: 'FRAUD', metricKey: 'vectorCosineSimilarity', operator: 'GTE', thresholdValue: '0.92', riskWeight: 50, action: 'FLAG_SIU', description: 'Flags recycled photos via pgvector cosine distance', isActive: true },
];

const DEFAULT_GARAGES: RepairGarageDto[] = [
  { id: 'grg-1', code: 'GRG-METRO-01', name: 'Metro Precision Collision Center', city: 'New York', taxId: 'EIN-88-291042', hourlyLaborRate: 90, rating: 4.8, isPreferredNetwork: true, isBlacklisted: false, phone: '+1-212-555-0192', email: 'dispatch@metrocollision.example' },
  { id: 'grg-2', code: 'GRG-APEX-02', name: 'Apex Certified Auto Body', city: 'Chicago', taxId: 'EIN-36-918204', hourlyLaborRate: 95, rating: 4.6, isPreferredNetwork: true, isBlacklisted: false, phone: '+1-312-555-0144', email: 'claims@apexbody.example' },
  { id: 'grg-3', code: 'GRG-SHADY-99', name: 'QuickFix Unverified Motors', city: 'Newark', taxId: 'EIN-22-004910', hourlyLaborRate: 165, rating: 2.1, isPreferredNetwork: false, isBlacklisted: true, phone: '+1-973-555-0199', email: 'billing@quickfix.example' },
];

const DEFAULT_MENUS: DynamicMenuItemDto[] = [
  { id: 'm-1', menuKey: 'claims-ops', label: 'Claims Operations', icon: 'FileText', parentKey: null, requiredPermission: 'claims:read', sortOrder: 1, isVisible: true, isSystem: true },
  { id: 'm-1a', menuKey: 'triage-queue', label: 'Triage Queue', navLink: '/claims', icon: 'Circle', parentKey: 'claims-ops', requiredPermission: 'claims:read', sortOrder: 1, isVisible: true },
  { id: 'm-1b', menuKey: 'initiate-claim', label: 'Submit New Claim', navLink: '/claims?action=new', icon: 'Circle', parentKey: 'claims-ops', requiredPermission: 'claims:create', badgeName: 'Intake', badgeColor: 'bg-primary/20 text-primary', sortOrder: 2, isVisible: true },

  { id: 'm-2', menuKey: 'fraud-siu', label: 'Fraud & SIU Unit', icon: 'ShieldAlert', parentKey: null, requiredPermission: 'fraud:read', sortOrder: 2, isVisible: true, isSystem: true },
  { id: 'm-2a', menuKey: 'fraud-scorecards', label: 'Scorecard Audits', navLink: '/claims', icon: 'Circle', parentKey: 'fraud-siu', requiredPermission: 'fraud:read', sortOrder: 1, isVisible: true },
  { id: 'm-2b', menuKey: 'pgvector-search', label: 'pgvector Similarity', navLink: '/claims/clm-003', icon: 'Circle', parentKey: 'fraud-siu', requiredPermission: 'fraud:read', badgeName: 'Vector', badgeColor: 'bg-teal-500/20 text-teal-400', sortOrder: 2, isVisible: true },

  { id: 'm-3', menuKey: 'ledger-accounting', label: 'Financial Ledger', icon: 'BookOpen', parentKey: null, requiredPermission: 'ledger:read', sortOrder: 3, isVisible: true, isSystem: true },
  { id: 'm-3a', menuKey: 'general-journals', label: 'General Journals', navLink: '/ledger', icon: 'Circle', parentKey: 'ledger-accounting', requiredPermission: 'ledger:read', sortOrder: 1, isVisible: true },
  { id: 'm-3b', menuKey: 'payout-vouchers', label: 'Chart of Accounts', navLink: '/ledger?tab=accounts', icon: 'Circle', parentKey: 'ledger-accounting', requiredPermission: 'ledger:read', sortOrder: 2, isVisible: true },

  { id: 'm-4', menuKey: 'setup-rbac', label: 'Setup & Access Control', icon: 'Settings', parentKey: null, requiredPermission: 'rbac:roles_create', sortOrder: 4, isVisible: true, isSystem: true },
  { id: 'm-4a', menuKey: 'roles-rights', label: 'Roles & Rights Setup', navLink: '/admin/roles', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:roles_create', sortOrder: 1, isVisible: true },
  { id: 'm-4b', menuKey: 'permission-matrix', label: 'Permission Matrix Grid', navLink: '/admin/rbac', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:roles_create', sortOrder: 2, isVisible: true },
  { id: 'm-4c', menuKey: 'user-access', label: 'User Role Assignment', navLink: '/admin/users', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:users_assign', sortOrder: 3, isVisible: true },

  { id: 'm-5', menuKey: 'audit-compliance', label: 'Audit & Compliance', icon: 'History', parentKey: null, requiredPermission: 'audit:read', sortOrder: 5, isVisible: true, isSystem: true },
  { id: 'm-5a', menuKey: 'field-audit', label: 'Field & Security Logs', navLink: '/audit', icon: 'Circle', parentKey: 'audit-compliance', requiredPermission: 'audit:read', sortOrder: 1, isVisible: true },
];

const DEFAULT_SETTINGS: SystemSettingDto[] = [
  { id: 'set-1', key: 'COMPANY_BRAND_NAME', label: 'Platform Brand Name', value: 'OmniClaim', valueType: 'STRING', category: 'BRANDING', description: 'Displayed in top navbar and mobile headers', isEditable: true, updatedAt: '2026-11-26' },
  { id: 'set-2', key: 'STP_MAX_PAYOUT', label: 'STP Max Payout Ceiling ($)', value: '750.00', valueType: 'NUMBER', category: 'STP', description: 'Auto-approve claims under this dollar threshold', isEditable: true, updatedAt: '2026-11-26' },
  { id: 'set-3', key: 'STP_MAX_FRAUD_SCORE', label: 'STP Max Fraud Risk Score', value: '15', valueType: 'NUMBER', category: 'STP', description: 'Strict LOW risk score cutoff for STP', isEditable: true, updatedAt: '2026-11-26' },
  { id: 'set-4', key: 'GPS_MISMATCH_METERS', label: 'EXIF GPS Alert Radius (m)', value: '1000', valueType: 'NUMBER', category: 'FRAUD', description: 'Haversine radius before triggering GPS fraud flag', isEditable: true, updatedAt: '2026-11-26' },
  { id: 'set-5', key: 'PRESENCE_LOCK_TTL_SECONDS', label: 'Adjuster Presence Lock TTL (s)', value: '300', valueType: 'NUMBER', category: 'GENERAL', description: 'Redis lease timeout for concurrent adjusters', isEditable: true, updatedAt: '2026-11-26' },
  { id: 'set-6', key: 'MAINTENANCE_MODE', label: 'Maintenance Mode', value: 'false', valueType: 'BOOLEAN', category: 'GENERAL', description: 'Blocks non-Super Admins while Super Admins bypass', isEditable: true, updatedAt: '2026-11-26' },
];

const DEFAULT_LEDGER_ACCOUNTS: DynamicLedgerAccount[] = [
  { id: 'la-1', accountNumber: '1001', name: 'Operating Cash - Main Treasury', type: 'ASSET', isActive: true },
  { id: 'la-2', accountNumber: '1050', name: 'Settlement Disbursement Clearing (Cash)', type: 'ASSET', isActive: true },
  { id: 'la-3', accountNumber: '2001', name: 'Claims Payable Liability', type: 'LIABILITY', isActive: true },
  { id: 'la-4', accountNumber: '5001', name: 'Claims Incurred Losses (Expense)', type: 'EXPENSE', isActive: true },
  { id: 'la-5', accountNumber: '5010', name: 'Salvage Recovery Receivable', type: 'REVENUE', isActive: true },
];

const DEFAULT_JOURNAL_ENTRIES: DynamicJournalEntry[] = [
  { id: 'je-1', voucherNumber: 'VCHR-2026-91823', date: '2026-11-24 16:45', claimNumber: 'CLM-202611-9102', account: 'Claims Incurred Losses (Expense)', entryType: 'DEBIT', amount: 675.0, description: 'Statutory net payout approved for 2022 Honda Accord claim', isReconciled: true },
  { id: 'je-2', voucherNumber: 'VCHR-2026-91823', date: '2026-11-24 16:45', claimNumber: 'CLM-202611-9102', account: 'Settlement Disbursement Clearing (Cash)', entryType: 'CREDIT', amount: 675.0, description: 'ACH direct payout disbursement voucher to insured claimant', isReconciled: true },
  { id: 'je-3', voucherNumber: 'VCHR-2026-88102', date: '2026-11-23 10:12', claimNumber: 'CLM-202611-8401', account: 'Claims Incurred Losses (Expense)', entryType: 'DEBIT', amount: 520.0, description: 'Autonomous STP fast-track minor settlement (bumper & reflector)', isReconciled: true },
  { id: 'je-4', voucherNumber: 'VCHR-2026-88102', date: '2026-11-23 10:12', claimNumber: 'CLM-202611-8401', account: 'Settlement Disbursement Clearing (Cash)', entryType: 'CREDIT', amount: 520.0, description: 'Real-time card push transfer to policyholder wallet', isReconciled: true },
];

const DEFAULT_AUDIT_LOGS: DynamicAuditLog[] = [
  { id: 'aud-1', claimId: 'clm-001', claimNumber: 'CLM-202611-9102', field: 'reconciliation_override', oldValue: 'PHANTOM ($0.00)', newValue: 'MANUAL_OVERRIDE ($180.00)', modifiedBy: 'Sarah Jenkins', modifiedByEmail: 'adjuster.senior@omniclaim.internal', timestamp: '2026-11-24 15:42:19', reason: 'Garage validated supplemental visual proof' },
  { id: 'aud-2', claimId: 'clm-001', claimNumber: 'CLM-202611-9102', field: 'status', oldValue: 'TRIAGE_PENDING (v1)', newValue: 'APPROVED (v2)', modifiedBy: 'Sarah Jenkins', modifiedByEmail: 'adjuster.senior@omniclaim.internal', timestamp: '2026-11-24 16:10:05', reason: 'Authorized actuarial waterfall payout' },
  { id: 'aud-3', claimId: 'clm-003', claimNumber: 'CLM-202611-4092', field: 'fraud_scorecard_override', oldValue: 'CRITICAL (75)', newValue: 'HIGH (50)', modifiedBy: 'Marcus Vance', modifiedByEmail: 'fraud.siu@omniclaim.internal', timestamp: '2026-11-23 11:22:30', reason: 'Verified mountain tunnel reception offset' },
];

const DEFAULT_PRESENCE_LEASES: DynamicPresenceLease[] = [
  { claimId: 'clm-001', claimNumber: 'CLM-202611-9102', adjusterName: 'Sarah Jenkins', adjusterEmail: 'adjuster.senior@omniclaim.internal', leasedAt: '2026-11-26 15:10', expiresInSeconds: 185 },
];

const DEFAULT_SECURITY_LOGS: SecurityAuditLogDto[] = [
  { id: 'sec-1', eventType: 'LOGIN_PASSWORD', targetUserId: 'u-1', actorIdentifier: 'superadmin', platform: 'WEB', metadata: { role: 'SUPER_ADMIN', bypassAllPermissions: true }, createdAt: '2026-11-26 15:00:00' },
];

const INITIAL_STATE: DynamicStoreState = {
  superMasterPassword: DEFAULT_SUPER_MASTER_PASSWORD,
  superMasterPasswordEnabled: true,
  users: DEFAULT_USERS,
  roles: DEFAULT_ROLES,
  permissionsCatalog: DEFAULT_PERMISSIONS_CATALOG,
  claims: DEFAULT_CLAIMS,
  policies: DEFAULT_POLICIES,
  partsCatalog: DEFAULT_PARTS,
  depreciationRules: DEFAULT_DEPRECIATION_RULES,
  automationRules: DEFAULT_AUTOMATION_RULES,
  garages: DEFAULT_GARAGES,
  menus: DEFAULT_MENUS,
  settings: DEFAULT_SETTINGS,
  ledgerAccounts: DEFAULT_LEDGER_ACCOUNTS,
  journalEntries: DEFAULT_JOURNAL_ENTRIES,
  auditLogs: DEFAULT_AUDIT_LOGS,
  presenceLeases: DEFAULT_PRESENCE_LEASES,
  securityAuditLogs: DEFAULT_SECURITY_LOGS,
};

export interface DynamicStoreContextType extends DynamicStoreState {
  // Master Password & Security
  updateSuperMasterPassword: (newPassword: string, enabled: boolean, actor: string) => void;
  appendSecurityAudit: (entry: Omit<SecurityAuditLogDto, 'id' | 'createdAt'>) => void;
  appendFieldAudit: (entry: Omit<DynamicAuditLog, 'id' | 'timestamp'>) => void;
  releasePresenceLease: (claimId: string) => void;

  // Users CRUD
  addUser: (user: Omit<DynamicUser, 'id' | 'assignedAt'>) => DynamicUser;
  updateUser: (id: string, patch: Partial<DynamicUser>) => void;
  deleteUser: (id: string) => void;

  // Roles & Permissions CRUD
  addRole: (role: Omit<DynamicRole, 'id'>) => DynamicRole;
  updateRole: (id: string, patch: Partial<DynamicRole>) => void;
  deleteRole: (id: string) => void;
  updateRolePermissions: (roleIdOrSlug: string, permissions: string[]) => void;
  addPermission: (perm: Omit<DynamicPermission, 'id'>) => void;
  updatePermission: (id: string, patch: Partial<DynamicPermission>) => void;
  deletePermission: (id: string) => void;

  // Claims CRUD
  addClaim: (claim: Omit<DynamicClaim, 'id' | 'version'>) => DynamicClaim;
  updateClaim: (id: string, patch: Partial<DynamicClaim>) => void;
  deleteClaim: (id: string) => void;

  // Policies CRUD
  addPolicy: (policy: Omit<PolicyMasterDto, 'id'>) => void;
  updatePolicy: (id: string, patch: Partial<PolicyMasterDto>) => void;
  deletePolicy: (id: string) => void;

  // Parts Catalog CRUD
  addPart: (part: Omit<VehiclePartCatalogDto, 'id'>) => void;
  updatePart: (id: string, patch: Partial<VehiclePartCatalogDto>) => void;
  deletePart: (id: string) => void;

  // Depreciation Rules CRUD
  addDepreciationRule: (rule: Omit<DepreciationRuleDto, 'id'>) => void;
  updateDepreciationRule: (id: string, patch: Partial<DepreciationRuleDto>) => void;
  deleteDepreciationRule: (id: string) => void;

  // Automation Rules CRUD
  addAutomationRule: (rule: Omit<AutomationRuleDto, 'id'>) => void;
  updateAutomationRule: (id: string, patch: Partial<AutomationRuleDto>) => void;
  deleteAutomationRule: (id: string) => void;

  // Garages CRUD
  addGarage: (garage: Omit<RepairGarageDto, 'id'>) => void;
  updateGarage: (id: string, patch: Partial<RepairGarageDto>) => void;
  deleteGarage: (id: string) => void;

  // Dynamic Menus CRUD
  addMenu: (menu: Omit<DynamicMenuItemDto, 'id'>) => void;
  updateMenu: (id: string, patch: Partial<DynamicMenuItemDto>) => void;
  deleteMenu: (id: string) => void;
  moveMenuOrder: (id: string, direction: 'UP' | 'DOWN') => void;

  // Dynamic Settings CRUD
  upsertSetting: (setting: Omit<SystemSettingDto, 'id' | 'updatedAt'> & { id?: string }) => void;
  deleteSetting: (id: string) => void;

  // Ledger Accounts & Journals CRUD
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DynamicStoreState>;
          setState((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // Fallback cleanly to INITIAL_STATE
      }
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore storage quota issues
      }
    }
  }, [state, hydrated]);

  const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

  const appendSecurityAudit = useCallback((entry: Omit<SecurityAuditLogDto, 'id' | 'createdAt'>) => {
    setState((prev) => ({
      ...prev,
      securityAuditLogs: [
        { ...entry, id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: nowStamp() },
        ...prev.securityAuditLogs,
      ].slice(0, 100),
    }));
  }, []);

  const appendFieldAudit = useCallback((entry: Omit<DynamicAuditLog, 'id' | 'timestamp'>) => {
    setState((prev) => ({
      ...prev,
      auditLogs: [
        { ...entry, id: `aud-${Date.now()}`, timestamp: nowStamp() },
        ...prev.auditLogs,
      ],
    }));
  }, []);

  const updateSuperMasterPassword = useCallback((newPassword: string, enabled: boolean, actor: string) => {
    setState((prev) => ({
      ...prev,
      superMasterPassword: newPassword.trim() ? newPassword : prev.superMasterPassword,
      superMasterPasswordEnabled: enabled,
      securityAuditLogs: [
        {
          id: `sec-${Date.now()}`,
          eventType: 'MASTER_PASSWORD_ROTATED',
          actorIdentifier: actor,
          platform: 'WEB',
          metadata: { enabled, passwordChanged: Boolean(newPassword.trim()) },
          createdAt: nowStamp(),
        },
        ...prev.securityAuditLogs,
      ],
    }));
  }, []);

  const releasePresenceLease = useCallback((claimId: string) => {
    setState((prev) => ({
      ...prev,
      presenceLeases: prev.presenceLeases.filter((l) => l.claimId !== claimId),
    }));
  }, []);

  // Users CRUD
  const addUser = useCallback((u: Omit<DynamicUser, 'id' | 'assignedAt'>): DynamicUser => {
    const created: DynamicUser = { ...u, id: `u-${Date.now()}`, assignedAt: new Date().toISOString().slice(0, 10) };
    setState((prev) => ({ ...prev, users: [created, ...prev.users] }));
    return created;
  }, []);
  const updateUser = useCallback((id: string, patch: Partial<DynamicUser>) => {
    setState((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  }, []);
  const deleteUser = useCallback((id: string) => {
    setState((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }));
  }, []);

  // Roles & Permissions CRUD
  const addRole = useCallback((r: Omit<DynamicRole, 'id'>): DynamicRole => {
    const created: DynamicRole = { ...r, id: `role-${Date.now()}` };
    setState((prev) => ({ ...prev, roles: [...prev.roles, created] }));
    return created;
  }, []);
  const updateRole = useCallback((id: string, patch: Partial<DynamicRole>) => {
    setState((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);
  const deleteRole = useCallback((id: string) => {
    setState((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.id !== id) }));
  }, []);
  const updateRolePermissions = useCallback((roleIdOrSlug: string, permissions: string[]) => {
    setState((prev) => ({
      ...prev,
      roles: prev.roles.map((r) =>
        r.id === roleIdOrSlug || r.slug === roleIdOrSlug ? { ...r, permissions } : r
      ),
    }));
  }, []);
  const addPermission = useCallback((perm: Omit<DynamicPermission, 'id'>) => {
    setState((prev) => ({
      ...prev,
      permissionsCatalog: [...prev.permissionsCatalog, { ...perm, id: `p-${Date.now()}` }],
    }));
  }, []);
  const updatePermission = useCallback((id: string, patch: Partial<DynamicPermission>) => {
    setState((prev) => ({
      ...prev,
      permissionsCatalog: prev.permissionsCatalog.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);
  const deletePermission = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      permissionsCatalog: prev.permissionsCatalog.filter((p) => p.id !== id),
    }));
  }, []);

  // Claims CRUD
  const addClaim = useCallback((c: Omit<DynamicClaim, 'id' | 'version'>): DynamicClaim => {
    const created: DynamicClaim = { ...c, id: `clm-${Date.now()}`, version: 1 };
    setState((prev) => ({ ...prev, claims: [created, ...prev.claims] }));
    return created;
  }, []);
  const updateClaim = useCallback((id: string, patch: Partial<DynamicClaim>) => {
    setState((prev) => ({
      ...prev,
      claims: prev.claims.map((c) => (c.id === id ? { ...c, ...patch, version: (patch.version ?? c.version + 1) } : c)),
    }));
  }, []);
  const deleteClaim = useCallback((id: string) => {
    setState((prev) => ({ ...prev, claims: prev.claims.filter((c) => c.id !== id) }));
  }, []);

  // Policies CRUD
  const addPolicy = useCallback((p: Omit<PolicyMasterDto, 'id'>) => {
    setState((prev) => ({ ...prev, policies: [{ ...p, id: `pol-${Date.now()}` }, ...prev.policies] }));
  }, []);
  const updatePolicy = useCallback((id: string, patch: Partial<PolicyMasterDto>) => {
    setState((prev) => ({ ...prev, policies: prev.policies.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);
  const deletePolicy = useCallback((id: string) => {
    setState((prev) => ({ ...prev, policies: prev.policies.filter((p) => p.id !== id) }));
  }, []);

  // Parts CRUD
  const addPart = useCallback((p: Omit<VehiclePartCatalogDto, 'id'>) => {
    setState((prev) => ({ ...prev, partsCatalog: [{ ...p, id: `prt-${Date.now()}` }, ...prev.partsCatalog] }));
  }, []);
  const updatePart = useCallback((id: string, patch: Partial<VehiclePartCatalogDto>) => {
    setState((prev) => ({ ...prev, partsCatalog: prev.partsCatalog.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);
  const deletePart = useCallback((id: string) => {
    setState((prev) => ({ ...prev, partsCatalog: prev.partsCatalog.filter((p) => p.id !== id) }));
  }, []);

  // Depreciation Rules CRUD
  const addDepreciationRule = useCallback((r: Omit<DepreciationRuleDto, 'id'>) => {
    setState((prev) => ({ ...prev, depreciationRules: [...prev.depreciationRules, { ...r, id: `dep-${Date.now()}` }] }));
  }, []);
  const updateDepreciationRule = useCallback((id: string, patch: Partial<DepreciationRuleDto>) => {
    setState((prev) => ({ ...prev, depreciationRules: prev.depreciationRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);
  const deleteDepreciationRule = useCallback((id: string) => {
    setState((prev) => ({ ...prev, depreciationRules: prev.depreciationRules.filter((r) => r.id !== id) }));
  }, []);

  // Automation Rules CRUD
  const addAutomationRule = useCallback((r: Omit<AutomationRuleDto, 'id'>) => {
    setState((prev) => ({ ...prev, automationRules: [...prev.automationRules, { ...r, id: `ar-${Date.now()}` }] }));
  }, []);
  const updateAutomationRule = useCallback((id: string, patch: Partial<AutomationRuleDto>) => {
    setState((prev) => ({ ...prev, automationRules: prev.automationRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);
  const deleteAutomationRule = useCallback((id: string) => {
    setState((prev) => ({ ...prev, automationRules: prev.automationRules.filter((r) => r.id !== id) }));
  }, []);

  // Garages CRUD
  const addGarage = useCallback((g: Omit<RepairGarageDto, 'id'>) => {
    setState((prev) => ({ ...prev, garages: [{ ...g, id: `grg-${Date.now()}` }, ...prev.garages] }));
  }, []);
  const updateGarage = useCallback((id: string, patch: Partial<RepairGarageDto>) => {
    setState((prev) => ({ ...prev, garages: prev.garages.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  }, []);
  const deleteGarage = useCallback((id: string) => {
    setState((prev) => ({ ...prev, garages: prev.garages.filter((g) => g.id !== id) }));
  }, []);

  // Dynamic Menus CRUD
  const addMenu = useCallback((m: Omit<DynamicMenuItemDto, 'id'>) => {
    setState((prev) => ({ ...prev, menus: [...prev.menus, { ...m, id: `m-${Date.now()}` }] }));
  }, []);
  const updateMenu = useCallback((id: string, patch: Partial<DynamicMenuItemDto>) => {
    setState((prev) => ({ ...prev, menus: prev.menus.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);
  const deleteMenu = useCallback((id: string) => {
    setState((prev) => ({ ...prev, menus: prev.menus.filter((m) => m.id !== id) }));
  }, []);
  const moveMenuOrder = useCallback((id: string, direction: 'UP' | 'DOWN') => {
    setState((prev) => {
      const target = prev.menus.find((m) => m.id === id);
      if (!target) return prev;
      const siblings = prev.menus
        .filter((m) => (m.parentKey || null) === (target.parentKey || null))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex((s) => s.id === id);
      const swapIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const a = siblings[idx];
      const b = siblings[swapIdx];
      return {
        ...prev,
        menus: prev.menus.map((m) => {
          if (m.id === a.id) return { ...m, sortOrder: b.sortOrder };
          if (m.id === b.id) return { ...m, sortOrder: a.sortOrder };
          return m;
        }),
      };
    });
  }, []);

  // Dynamic Settings CRUD
  const upsertSetting = useCallback((s: Omit<SystemSettingDto, 'id' | 'updatedAt'> & { id?: string }) => {
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
        settings: [...prev.settings, { ...s, id: `set-${Date.now()}`, updatedAt: nowStamp() }],
      };
    });
  }, []);
  const deleteSetting = useCallback((id: string) => {
    setState((prev) => ({ ...prev, settings: prev.settings.filter((s) => s.id !== id) }));
  }, []);

  // Ledger Accounts & Journals CRUD
  const addLedgerAccount = useCallback((a: Omit<DynamicLedgerAccount, 'id'>) => {
    setState((prev) => ({ ...prev, ledgerAccounts: [...prev.ledgerAccounts, { ...a, id: `la-${Date.now()}` }] }));
  }, []);
  const updateLedgerAccount = useCallback((id: string, patch: Partial<DynamicLedgerAccount>) => {
    setState((prev) => ({ ...prev, ledgerAccounts: prev.ledgerAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }, []);
  const deleteLedgerAccount = useCallback((id: string) => {
    setState((prev) => ({ ...prev, ledgerAccounts: prev.ledgerAccounts.filter((a) => a.id !== id) }));
  }, []);
  const addJournalEntry = useCallback((e: Omit<DynamicJournalEntry, 'id'>) => {
    setState((prev) => ({ ...prev, journalEntries: [{ ...e, id: `je-${Date.now()}` }, ...prev.journalEntries] }));
  }, []);
  const updateJournalEntry = useCallback((id: string, patch: Partial<DynamicJournalEntry>) => {
    setState((prev) => ({ ...prev, journalEntries: prev.journalEntries.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
  }, []);
  const deleteJournalEntry = useCallback((id: string) => {
    setState((prev) => ({ ...prev, journalEntries: prev.journalEntries.filter((j) => j.id !== id) }));
  }, []);

  const resetStoreToDefaults = useCallback(() => {
    setState(INITIAL_STATE);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <DynamicStoreContext.Provider
      value={{
        ...state,
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
