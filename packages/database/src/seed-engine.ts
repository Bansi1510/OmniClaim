import {
  PrismaClient,
  LedgerAccountType,
  LedgerEntryType,
  JournalStatus,
  SettingValueType,
  VehiclePartType,
  MaterialType,
  DamageSeverity,
  ClaimStatus,
  FraudRiskTier,
  FraudIndicatorType,
  AutomationRuleType,
  AuthAuditEventType,
} from '@prisma/client';
import * as crypto from 'crypto';

export function hashUserPassword(password: string, salt: string = 'omniclaim_secure_salt'): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function hashMasterPassword(password: string, salt: string = 'omniclaim_master_salt'): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export interface SeedSummary {
  permissions: number;
  roles: number;
  users: number;
  settings: number;
  menus: number;
  parts: number;
  depreciationRules: number;
  automationRules: number;
  garages: number;
  ledgerAccounts: number;
  policies: number;
  claims: number;
  journals: number;
  activityAuditLogs: number;
}

/**
 * 100% Idempotent Full-Schema Database Seeder for OmniClaim Enterprise.
 * Safe to run repeatedly on fresh or existing databases — zero manual SQL needed.
 */
export async function seedOmniClaimDatabase(prisma: PrismaClient): Promise<SeedSummary> {
  // =========================================================================
  // 1. GRANULAR PERMISSIONS MATRIX
  // =========================================================================
  const permissionsData = [
    { slug: 'superadmin:access', module: 'SUPER_ADMIN', description: 'Unrestricted Super Admin command center access (skips all checks)' },
    { slug: 'claims:read', module: 'CLAIMS', description: 'View claims list and detail views' },
    { slug: 'claims:create', module: 'CLAIMS', description: 'Submit new insurance claims' },
    { slug: 'claims:update', module: 'CLAIMS', description: 'Modify claim details and metadata' },
    { slug: 'claims:delete', module: 'CLAIMS', description: 'Delete claims from triage queue' },
    { slug: 'claims:triage', module: 'CLAIMS', description: 'Perform initial claim triage and queue dispatch' },
    { slug: 'claims:approve', module: 'CLAIMS', description: 'Grant formal adjuster approval for settlement' },
    { slug: 'claims:reject', module: 'CLAIMS', description: 'Formal claim rejection with dispute reason' },
    { slug: 'claims:override_reconciliation', module: 'RECONCILIATION', description: 'Manually override AI-detected phantom items' },
    { slug: 'claims:settle', module: 'CLAIMS', description: 'Execute final financial claim settlement and voucher creation' },
    { slug: 'ledger:read', module: 'LEDGER', description: 'Inspect general ledger journals and balance sheets' },
    { slug: 'ledger:post', module: 'LEDGER', description: 'Post manual or automated double-entry journal vouchers' },
    { slug: 'ledger:reconcile', module: 'LEDGER', description: 'Mark ledger vouchers as reconciled' },
    { slug: 'ledger:override', module: 'LEDGER', description: 'Edit or void ledger vouchers and chart of accounts' },
    { slug: 'ledger:export', module: 'LEDGER', description: 'Export GAAP/IFRS compliant financial audit statements' },
    { slug: 'fraud:read', module: 'FRAUD', description: 'View fraud scorecards, indicators, and vector similarity reports' },
    { slug: 'fraud:override', module: 'FRAUD', description: 'Override triggered fraud flags with documented justification' },
    { slug: 'fraud:flag', module: 'FRAUD', description: 'Create manual SIU fraud flags' },
    { slug: 'fraud:investigate', module: 'FRAUD', description: 'Mark claim for deep SIU (Special Investigation Unit) audit' },
    { slug: 'parts:read', module: 'MASTER_DATA', description: 'View parts pricing catalog' },
    { slug: 'parts:update', module: 'MASTER_DATA', description: 'Edit parts pricing catalog' },
    { slug: 'parts:manage', module: 'MASTER_DATA', description: 'Full CRUD on parts catalog pricing and labor hours' },
    { slug: 'policies:manage', module: 'MASTER_DATA', description: 'Add, edit, activate, or delete insurance policies' },
    { slug: 'policies:apply', module: 'POLICIES', description: 'Apply for new insurance policies, upload docs, and pay quotes' },
    { slug: 'policies:read', module: 'POLICIES', description: 'View own or portfolio issued policies, endorsements, and renewals' },
    { slug: 'underwriting:review', module: 'UNDERWRITING', description: 'Inspect pending policy applications and risk dossiers' },
    { slug: 'underwriting:approve', module: 'UNDERWRITING', description: 'Approve, request documents, or decline policy applications' },
    { slug: 'products:manage', module: 'UNDERWRITING', description: 'Configure insurance policy categories, products, and pricing plans' },
    { slug: 'rules:manage', module: 'MASTER_DATA', description: 'Add, edit, or delete dynamic STP, Fraud & Depreciation rules' },
    { slug: 'garages:manage', module: 'MASTER_DATA', description: 'Add, edit, blacklist, or delete repair garages' },
    { slug: 'settings:manage', module: 'SETTINGS', description: 'Modify dynamic system settings and master security controls' },
    { slug: 'menus:manage', module: 'SETTINGS', description: 'Dynamically add, edit, reorder, or hide navigation menus' },
    { slug: 'reports:read', module: 'REPORTS', description: 'Inspect executive analytics and reports' },
    { slug: 'reports:export', module: 'REPORTS', description: 'Export GAAP financial and claim reports' },
    { slug: 'rbac:roles_create', module: 'RBAC', description: 'Create new custom enterprise roles' },
    { slug: 'rbac:roles_update', module: 'RBAC', description: 'Modify role definitions and attach/detach permissions' },
    { slug: 'rbac:roles_delete', module: 'RBAC', description: 'Delete non-system custom roles' },
    { slug: 'rbac:roles_assign', module: 'RBAC', description: 'Assign granular rights to roles' },
    { slug: 'rbac:users_assign', module: 'RBAC', description: 'Create, edit, delete users and assign roles' },
    { slug: 'audit:read', module: 'AUDIT', description: 'Inspect immutable time-travel audit logs and lock leases' },
    { slug: 'presence:unlock', module: 'AUDIT', description: 'Force release active adjuster presence locks' },
  ];

  const createdPermissions = new Map<string, string>();
  for (const perm of permissionsData) {
    const record = await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { description: perm.description, module: perm.module },
      create: perm,
    });
    createdPermissions.set(perm.slug, record.id);
  }

  // =========================================================================
  // 2. SYSTEM ROLES & ROLE PERMISSIONS
  // =========================================================================
  const rolesData = [
    {
      name: 'Super Administrator',
      slug: 'SUPER_ADMIN',
      description: 'Unrestricted enterprise administrative access — skips all permission checks globally',
      isSystem: true,
      permissions: Array.from(createdPermissions.keys()),
    },
    {
      name: 'Senior Claims Adjuster',
      slug: 'CLAIMS_ADJUSTER',
      description: 'Comprehensive claim assessment, approval, and phantom override rights',
      isSystem: true,
      permissions: [
        'claims:read', 'claims:create', 'claims:update', 'claims:triage', 'claims:approve',
        'claims:reject', 'claims:override_reconciliation', 'parts:read', 'parts:update', 'reports:read',
        'policies:read', 'underwriting:review', 'underwriting:approve',
      ],
    },
    {
      name: 'Junior Claims Adjuster',
      slug: 'JUNIOR_ADJUSTER',
      description: 'Claim intake, initial triage, and verification without final approval rights',
      isSystem: true,
      permissions: ['claims:read', 'claims:update', 'claims:triage', 'fraud:read', 'audit:read'],
    },
    {
      name: 'SIU Fraud Investigator',
      slug: 'SIU_INVESTIGATOR',
      description: 'Special Investigation Unit: deep fraud review, vector search, override justification',
      isSystem: true,
      permissions: ['claims:read', 'fraud:read', 'fraud:override', 'fraud:flag', 'fraud:investigate', 'reports:read', 'audit:read'],
    },
    {
      name: 'Finance & Settlement Officer',
      slug: 'FINANCE_OFFICER',
      description: 'Disbursement authorization, double-entry ledger audits, and payout vouchers',
      isSystem: true,
      permissions: ['claims:read', 'claims:settle', 'ledger:read', 'ledger:post', 'ledger:reconcile', 'ledger:override', 'ledger:export', 'reports:read', 'reports:export'],
    },
    {
      name: 'Policyholder / Claimant',
      slug: 'POLICYHOLDER',
      description: 'Driver / Vehicle Owner: policy application, claim submission and real-time tracking',
      isSystem: true,
      permissions: ['claims:read', 'claims:create', 'policies:apply', 'policies:read'],
    },
  ];

  const createdRoles = new Map<string, string>();
  for (const roleDef of rolesData) {
    const role = await prisma.role.upsert({
      where: { slug: roleDef.slug },
      update: { name: roleDef.name, description: roleDef.description },
      create: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    });
    createdRoles.set(role.slug, role.id);

    for (const permSlug of roleDef.permissions) {
      const permId = createdPermissions.get(permSlug);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  // =========================================================================
  // 3. DEFAULT USERS (WITH USERNAMES, PASSWORDS & SUPER ADMIN FLAG)
  // =========================================================================
  const defaultPasswordHash = hashUserPassword(process.env.DEFAULT_SEED_PASSWORD || 'AdminOmniClaim2026!');

  const usersData = [
    { username: 'superadmin', email: 'admin@omniclaim.internal', fullName: 'Chief Enterprise Admin', roleSlug: 'SUPER_ADMIN', isSuperAdmin: true },
    { username: 'sarah.jenkins', email: 'adjuster.senior@omniclaim.internal', fullName: 'Sarah Jenkins', roleSlug: 'CLAIMS_ADJUSTER', isSuperAdmin: false },
    { username: 'marcus.vance', email: 'fraud.siu@omniclaim.internal', fullName: 'Marcus Vance', roleSlug: 'SIU_INVESTIGATOR', isSuperAdmin: false },
    { username: 'david.sterling', email: 'finance.controller@omniclaim.internal', fullName: 'David Sterling', roleSlug: 'FINANCE_OFFICER', isSuperAdmin: false },
    { username: 'alex.rivera', email: 'policyholder.demo@omniclaim.internal', fullName: 'Alex Rivera', roleSlug: 'POLICYHOLDER', isSuperAdmin: false },
  ];

  const createdUsers = new Map<string, string>();
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, username: u.username, isSuperAdmin: u.isSuperAdmin },
      create: {
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        passwordHash: defaultPasswordHash,
        isActive: true,
        isSuperAdmin: u.isSuperAdmin,
      },
    });
    createdUsers.set(u.username, user.id);

    const roleId = createdRoles.get(u.roleSlug);
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }
  }

  // =========================================================================
  // 4. DYNAMIC SYSTEM SETTINGS (INCLUDING SUPER MASTER PASSWORD)
  // =========================================================================
  const masterPlaintext = process.env.SUPER_MASTER_PASSWORD || 'OmniMaster#2026!';
  const masterHash = hashMasterPassword(masterPlaintext);

  const systemSettings = [
    { key: 'SUPER_MASTER_PASSWORD_HASH', label: 'Super Master Password Hash', value: masterHash, valueType: SettingValueType.SECRET, category: 'SECURITY', description: 'PBKDF2-SHA512 hash enabling Super Admin access into any username account' },
    { key: 'SUPER_MASTER_PASSWORD_ENABLED', label: 'Enable Super Master Password Login', value: 'true', valueType: SettingValueType.BOOLEAN, category: 'SECURITY', description: 'Master toggle to enable or disable universal Super Master Password authentication' },
    { key: 'STP_MAX_PAYOUT', label: 'STP Auto-Settlement Max Payout ($)', value: '750.00', valueType: SettingValueType.NUMBER, category: 'STP', description: 'Maximum net payout eligible for autonomous Straight-Through Processing' },
    { key: 'STP_MAX_FRAUD_SCORE', label: 'STP Maximum Fraud Risk Score', value: '15', valueType: SettingValueType.NUMBER, category: 'STP', description: 'Claims with composite fraud score below this threshold qualify for STP' },
    { key: 'GPS_MISMATCH_METERS', label: 'Geospatial Mismatch Alert Radius (Meters)', value: '1000', valueType: SettingValueType.NUMBER, category: 'FRAUD', description: 'Haversine distance between incident GPS and photo EXIF GPS before flagging fraud' },
    { key: 'PRESENCE_LOCK_TTL_SECONDS', label: 'Adjuster Presence Lock TTL (Seconds)', value: '300', valueType: SettingValueType.NUMBER, category: 'GENERAL', description: 'Duration of Redis collaborative editing lease on active claim dossiers' },
    { key: 'COMPANY_BRAND_NAME', label: 'Platform Brand Name', value: 'OmniClaim', valueType: SettingValueType.STRING, category: 'BRANDING', description: 'Dynamic organization display title across web and mobile interfaces' },
    { key: 'MAINTENANCE_MODE', label: 'Maintenance Mode', value: 'false', valueType: SettingValueType.BOOLEAN, category: 'GENERAL', description: 'When enabled, non-Super Admin users see maintenance screen while Super Admins bypass' },
  ];

  for (const s of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { label: s.label, description: s.description, category: s.category },
      create: { ...s, isEditable: true },
    });
  }

  // =========================================================================
  // 5. DYNAMIC NAVIGATION MENUS (EXACT COLLEGE ERP MENU STRUCTURE)
  // =========================================================================
  const menusData = [
    { menuKey: 'apply_policy', label: 'Apply for Policy', navLink: '/policies/apply', icon: 'FilePlus', parentKey: null, requiredPermission: 'policies:apply', badgeName: 'New', badgeColor: 'bg-emerald-500/20 text-emerald-400', sortOrder: 1, isSystem: false },
    { menuKey: 'my_policies', label: 'Policies Portfolio', navLink: '/policies', icon: 'ShieldCheck', parentKey: null, requiredPermission: 'policies:read', sortOrder: 2, isSystem: false },
    { menuKey: 'underwriting_queue', label: 'Underwriting Queue', navLink: '/underwriting', icon: 'ClipboardCheck', parentKey: null, requiredPermission: 'underwriting:review', sortOrder: 3, isSystem: false },
    { menuKey: 'claims-ops', label: 'Claims Operations', navLink: null, icon: 'FileText', parentKey: null, requiredPermission: 'claims:read', sortOrder: 4, isSystem: true },
    { menuKey: 'triage-queue', label: 'Triage Queue', navLink: '/claims', icon: 'Circle', parentKey: 'claims-ops', requiredPermission: 'claims:read', sortOrder: 1, isSystem: false },
    { menuKey: 'initiate-claim', label: 'Submit New Claim', navLink: '/claims?action=new', icon: 'Circle', parentKey: 'claims-ops', requiredPermission: 'claims:create', badgeName: 'Intake', badgeColor: 'bg-primary/20 text-primary', sortOrder: 2, isSystem: false },
    { menuKey: 'fraud-siu', label: 'Fraud & SIU Unit', navLink: null, icon: 'ShieldAlert', parentKey: null, requiredPermission: 'fraud:read', sortOrder: 5, isSystem: true },
    { menuKey: 'fraud-scorecards', label: 'Scorecard Audits', navLink: '/claims', icon: 'Circle', parentKey: 'fraud-siu', requiredPermission: 'fraud:read', sortOrder: 1, isSystem: false },
    { menuKey: 'pgvector-search', label: 'pgvector Similarity', navLink: '/claims/clm-003', icon: 'Circle', parentKey: 'fraud-siu', requiredPermission: 'fraud:read', badgeName: 'Vector', badgeColor: 'bg-teal-500/20 text-teal-400', sortOrder: 2, isSystem: false },
    { menuKey: 'ledger-accounting', label: 'Financial Ledger', navLink: null, icon: 'BookOpen', parentKey: null, requiredPermission: 'ledger:read', sortOrder: 6, isSystem: true },
    { menuKey: 'general-journals', label: 'General Journals', navLink: '/ledger', icon: 'Circle', parentKey: 'ledger-accounting', requiredPermission: 'ledger:read', sortOrder: 1, isSystem: false },
    { menuKey: 'payout-vouchers', label: 'Chart of Accounts', navLink: '/ledger?tab=accounts', icon: 'Circle', parentKey: 'ledger-accounting', requiredPermission: 'ledger:read', sortOrder: 2, isSystem: false },
    { menuKey: 'setup-rbac', label: 'Setup & Access Control', navLink: null, icon: 'Settings', parentKey: null, requiredPermission: 'rbac:roles_create', sortOrder: 7, isSystem: true },
    { menuKey: 'roles-rights', label: 'Roles & Rights Setup', navLink: '/admin/roles', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:roles_create', sortOrder: 1, isSystem: false },
    { menuKey: 'permission-matrix', label: 'Permission Matrix Grid', navLink: '/admin/rbac', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:roles_create', sortOrder: 2, isSystem: false },
    { menuKey: 'user-access', label: 'User Role Assignment', navLink: '/admin/users', icon: 'Circle', parentKey: 'setup-rbac', requiredPermission: 'rbac:users_assign', sortOrder: 3, isSystem: false },
    { menuKey: 'audit-compliance', label: 'Audit & Compliance', navLink: null, icon: 'History', parentKey: null, requiredPermission: 'audit:read', sortOrder: 8, isSystem: true },
    { menuKey: 'field-audit', label: 'Field & Security Logs', navLink: '/audit', icon: 'Circle', parentKey: 'audit-compliance', requiredPermission: 'audit:read', sortOrder: 1, isSystem: false },
  ];

  for (const m of menusData) {
    await prisma.dynamicMenuItem.upsert({
      where: { menuKey: m.menuKey },
      update: { label: m.label, navLink: m.navLink, sortOrder: m.sortOrder },
      create: { ...m, isVisible: true },
    });
  }

  // =========================================================================
  // 6. PARTS CATALOG, DEPRECIATION RULES, AUTOMATION RULES & REPAIR GARAGES
  // =========================================================================
  const partsData = [
    { partCode: 'PRT-BUMP-FRT', partName: 'OEM Front Bumper Assembly', partType: VehiclePartType.BUMPER_FRONT, materialType: MaterialType.PLASTIC, oemBasePrice: 450.0, aftermarketPrice: 290.0, defaultLaborHours: 2.5, laborRatePerHour: 90.0 },
    { partCode: 'PRT-BUMP-RER', partName: 'OEM Rear Bumper Cover', partType: VehiclePartType.BUMPER_REAR, materialType: MaterialType.PLASTIC, oemBasePrice: 410.0, aftermarketPrice: 260.0, defaultLaborHours: 2.0, laborRatePerHour: 90.0 },
    { partCode: 'PRT-HDLT-LFT', partName: 'LED Headlight Assembly (Left)', partType: VehiclePartType.HEADLIGHT_LEFT, materialType: MaterialType.GLASS, oemBasePrice: 380.0, aftermarketPrice: 220.0, defaultLaborHours: 1.0, laborRatePerHour: 90.0 },
    { partCode: 'PRT-HOOD-OEM', partName: 'Sheet Metal Hood / Bonnet Panel', partType: VehiclePartType.HOOD_BONNET, materialType: MaterialType.METAL, oemBasePrice: 680.0, aftermarketPrice: 460.0, defaultLaborHours: 3.5, laborRatePerHour: 95.0 },
    { partCode: 'PRT-DOOR-FL', partName: 'Driver Front Door Shell OEM', partType: VehiclePartType.DOOR_FRONT_LEFT, materialType: MaterialType.METAL, oemBasePrice: 920.0, aftermarketPrice: 640.0, defaultLaborHours: 4.0, laborRatePerHour: 95.0 },
    { partCode: 'PRT-WNDS-FRT', partName: 'Acoustic Laminated Windshield', partType: VehiclePartType.WINDSHIELD_FRONT, materialType: MaterialType.GLASS, oemBasePrice: 520.0, aftermarketPrice: 340.0, defaultLaborHours: 2.0, laborRatePerHour: 85.0 },
  ];

  for (const part of partsData) {
    await prisma.vehiclePartCatalog.upsert({
      where: { partCode: part.partCode },
      update: { partName: part.partName, oemBasePrice: part.oemBasePrice },
      create: part,
    });
  }

  const depRulesData = [
    { id: 'dep-rule-glass', name: 'Automotive Glass Zero Depreciation', materialType: MaterialType.GLASS, minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 0, priority: 1 },
    { id: 'dep-rule-plastic', name: 'Plastic & Composite Flat 50%', materialType: MaterialType.PLASTIC, minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 2 },
    { id: 'dep-rule-rubber', name: 'Rubber & Seals Flat 50%', materialType: MaterialType.RUBBER, minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 3 },
    { id: 'dep-rule-metal-0-1', name: 'Sheet Metal (0-1 Yr)', materialType: MaterialType.METAL, minVehicleAgeYears: 0, maxVehicleAgeYears: 1, depreciationPercent: 0, priority: 4 },
    { id: 'dep-rule-metal-2', name: 'Sheet Metal (2 Yrs)', materialType: MaterialType.METAL, minVehicleAgeYears: 2, maxVehicleAgeYears: 2, depreciationPercent: 10, priority: 5 },
    { id: 'dep-rule-metal-3', name: 'Sheet Metal (3 Yrs)', materialType: MaterialType.METAL, minVehicleAgeYears: 3, maxVehicleAgeYears: 3, depreciationPercent: 20, priority: 6 },
    { id: 'dep-rule-metal-4', name: 'Sheet Metal (4 Yrs)', materialType: MaterialType.METAL, minVehicleAgeYears: 4, maxVehicleAgeYears: 4, depreciationPercent: 30, priority: 7 },
    { id: 'dep-rule-metal-5p', name: 'Sheet Metal (5+ Yrs Cap)', materialType: MaterialType.METAL, minVehicleAgeYears: 5, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 8 },
  ];

  for (const dr of depRulesData) {
    await prisma.depreciationRule.upsert({
      where: { id: dr.id },
      update: { depreciationPercent: dr.depreciationPercent },
      create: { ...dr, isActive: true },
    });
  }

  const autoRulesData = [
    { id: 'auto-rule-stp-cap', name: 'STP Fast-Track Ceiling', ruleType: AutomationRuleType.STP, metricKey: 'netPayout', operator: 'LTE', thresholdValue: '750', riskWeight: 0, action: 'AUTO_SETTLE', description: 'Eligible for autonomous payout when net payout <= $750' },
    { id: 'auto-rule-gps', name: 'EXIF GPS Mismatch Rule', ruleType: AutomationRuleType.FRAUD, metricKey: 'gpsDistanceMeters', operator: 'GT', thresholdValue: '1000', riskWeight: 25, action: 'ADD_RISK_SCORE', description: 'Adds +25 risk points if photo GPS diverges >1km from incident site' },
    { id: 'auto-rule-mock-gps', name: 'Mock Location Spoofing', ruleType: AutomationRuleType.FRAUD, metricKey: 'isMockLocation', operator: 'EQ', thresholdValue: 'true', riskWeight: 40, action: 'FLAG_SIU', description: 'Immediate +40 risk score and SIU escalation on spoofed GPS' },
    { id: 'auto-rule-clip', name: 'CLIP Vector Reuse Check', ruleType: AutomationRuleType.FRAUD, metricKey: 'vectorCosineSimilarity', operator: 'GTE', thresholdValue: '0.92', riskWeight: 50, action: 'FLAG_SIU', description: 'Flags recycled accident photos matching prior claims in pgvector' },
  ];

  for (const ar of autoRulesData) {
    await prisma.automationRule.upsert({
      where: { id: ar.id },
      update: { thresholdValue: ar.thresholdValue, riskWeight: ar.riskWeight },
      create: { ...ar, isActive: true },
    });
  }

  const garagesData = [
    { code: 'GRG-METRO-01', name: 'Metro Precision Collision Center', city: 'New York', taxId: 'EIN-88-291042', hourlyLaborRate: 90.0, rating: 4.8, isPreferredNetwork: true, isBlacklisted: false, phone: '+1-212-555-0192', email: 'dispatch@metrocollision.example' },
    { code: 'GRG-APEX-02', name: 'Apex Certified Auto Body', city: 'Chicago', taxId: 'EIN-36-918204', hourlyLaborRate: 95.0, rating: 4.6, isPreferredNetwork: true, isBlacklisted: false, phone: '+1-312-555-0144', email: 'claims@apexbody.example' },
    { code: 'GRG-SHADY-99', name: 'QuickFix Unverified Motors', city: 'Newark', taxId: 'EIN-22-004910', hourlyLaborRate: 165.0, rating: 2.1, isPreferredNetwork: false, isBlacklisted: true, phone: '+1-973-555-0199', email: 'billing@quickfix.example' },
  ];

  for (const g of garagesData) {
    await prisma.repairGarage.upsert({
      where: { code: g.code },
      update: { name: g.name, hourlyLaborRate: g.hourlyLaborRate },
      create: g,
    });
  }

  // =========================================================================
  // 7. STANDARD GAAP/IFRS CHART OF ACCOUNTS (LEDGER)
  // =========================================================================
  const chartOfAccounts = [
    { accountNumber: '1001', name: 'Operating Cash - Main Treasury', type: LedgerAccountType.ASSET },
    { accountNumber: '1050', name: 'Escrow Payout Clearing Account', type: LedgerAccountType.ASSET },
    { accountNumber: '2001', name: 'Claims Payable Liability', type: LedgerAccountType.LIABILITY },
    { accountNumber: '5001', name: 'Direct Auto Claims Expense', type: LedgerAccountType.EXPENSE },
    { accountNumber: '5010', name: 'Deductible Recovery Offset', type: LedgerAccountType.REVENUE },
    { accountNumber: '5020', name: 'Salvage Recovery Asset/Offset', type: LedgerAccountType.REVENUE },
  ];

  const createdAccounts = new Map<string, string>();
  for (const acct of chartOfAccounts) {
    const record = await prisma.ledgerAccount.upsert({
      where: { accountNumber: acct.accountNumber },
      update: { name: acct.name, type: acct.type },
      create: acct,
    });
    createdAccounts.set(acct.accountNumber, record.id);
  }

  // =========================================================================
  // 8. POLICIES MASTER (3 REALISTIC ACTIVE AUTO POLICIES)
  // =========================================================================
  const policyholderId = createdUsers.get('alex.rivera')!;
  const adjusterId = createdUsers.get('sarah.jenkins')!;
  const siuId = createdUsers.get('marcus.vance')!;
  const adminId = createdUsers.get('superadmin')!;

  const policiesData = [
    { policyNumber: 'POL-OMNI-2026-9081', policyHolderId: policyholderId, vehicleVin: '1HGCR2F83HA001928', vehicleMake: 'Honda', vehicleModel: 'Accord Touring', vehicleYear: 2022, coverageLimit: 50000.0, baseDeductible: 500.0, startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01') },
    { policyNumber: 'POL-OMNI-2026-3120', policyHolderId: policyholderId, vehicleVin: '2T3C1RFV5PC082194', vehicleMake: 'Toyota', vehicleModel: 'RAV4 Hybrid', vehicleYear: 2024, coverageLimit: 75000.0, baseDeductible: 250.0, startDate: new Date('2026-03-01'), endDate: new Date('2027-03-01') },
    { policyNumber: 'POL-OMNI-2026-7782', policyHolderId: policyholderId, vehicleVin: '1FTFW1E84LFA99021', vehicleMake: 'Ford', vehicleModel: 'F-150 Lariat', vehicleYear: 2020, coverageLimit: 60000.0, baseDeductible: 1000.0, startDate: new Date('2025-12-01'), endDate: new Date('2026-12-01') },
  ];

  const createdPolicies = new Map<string, string>();
  for (const pol of policiesData) {
    const rec = await prisma.policy.upsert({
      where: { policyNumber: pol.policyNumber },
      update: { coverageLimit: pol.coverageLimit, baseDeductible: pol.baseDeductible },
      create: { ...pol, isActive: true },
    });
    createdPolicies.set(pol.policyNumber, rec.id);
  }

  // =========================================================================
  // 9. SAMPLE MULTI-MODAL CLAIMS, EVIDENCE, DAMAGES, BILLS, RECONCILIATION,
  //    ACTUARIAL WATERFALLS, FRAUD SCORECARDS, AUDIT LOGS & BALANCED LEDGER
  // =========================================================================
  const claim1 = await prisma.claim.upsert({
    where: { claimNumber: 'CLM-202611-9102' },
    update: {},
    create: {
      id: 'clm-001',
      claimNumber: 'CLM-202611-9102',
      policyId: createdPolicies.get('POL-OMNI-2026-9081')!,
      status: ClaimStatus.TRIAGE_PENDING,
      version: 1,
      incidentDate: new Date('2026-11-24T14:30:00.000Z'),
      incidentLatitude: 37.7749,
      incidentLongitude: -122.4194,
      incidentDescription: 'Front-left intersection collision at low speed during wet conditions.',
      adjusterId,
    },
  });

  const claim2 = await prisma.claim.upsert({
    where: { claimNumber: 'CLM-202611-8401' },
    update: {},
    create: {
      id: 'clm-002',
      claimNumber: 'CLM-202611-8401',
      policyId: createdPolicies.get('POL-OMNI-2026-3120')!,
      status: ClaimStatus.SETTLED,
      version: 3,
      incidentDate: new Date('2026-11-23T09:15:00.000Z'),
      incidentLatitude: 41.8781,
      incidentLongitude: -87.6298,
      incidentDescription: 'Parking lot minor rear bumper scuff — qualified for autonomous STP.',
      adjusterId,
    },
  });

  const claim3 = await prisma.claim.upsert({
    where: { claimNumber: 'CLM-202611-4092' },
    update: {},
    create: {
      id: 'clm-003',
      claimNumber: 'CLM-202611-4092',
      policyId: createdPolicies.get('POL-OMNI-2026-7782')!,
      status: ClaimStatus.MANUAL_REVIEW,
      version: 2,
      incidentDate: new Date('2026-11-22T18:45:00.000Z'),
      incidentLatitude: 40.7128,
      incidentLongitude: -74.006,
      incidentDescription: 'Multi-panel sideswipe flagged for SIU vector similarity review.',
      adjusterId: siuId,
    },
  });

  // Claim 1: Full Multi-Modal Dossier (Evidence -> Damages -> Bill -> Reconciliation -> Actuarial -> Fraud -> Lock)
  const ev1 = await prisma.claimEvidence.upsert({
    where: { id: 'seed-ev-001' },
    update: {},
    create: {
      id: 'seed-ev-001',
      claimId: claim1.id,
      fileUrl: 'https://images.unsplash.com/photo-1590362891988-f77804703088?auto=format&fit=crop&w=1200&q=80',
      pHash: 'a4c8e19f02b76d11',
      deviceLatitude: 37.7912,
      deviceLongitude: -122.4194,
      deviceTimestamp: new Date('2026-11-24T14:42:00.000Z'),
      altitude: 14.5,
      gyroscopeX: 0.02,
      gyroscopeY: -0.01,
      gyroscopeZ: 0.98,
      isMockLocation: false,
    },
  });

  await prisma.detectedDamage.upsert({
    where: { id: 'seed-dmg-001' },
    update: {},
    create: {
      id: 'seed-dmg-001',
      claimId: claim1.id,
      evidenceId: ev1.id,
      partType: VehiclePartType.BUMPER_FRONT,
      materialType: MaterialType.PLASTIC,
      severity: DamageSeverity.DENT,
      confidence: 0.94,
      boundingBoxJson: { xmin: 0.18, ymin: 0.48, xmax: 0.82, ymax: 0.9 },
      repairAction: 'REPLACE',
    },
  });

  await prisma.detectedDamage.upsert({
    where: { id: 'seed-dmg-002' },
    update: {},
    create: {
      id: 'seed-dmg-002',
      claimId: claim1.id,
      evidenceId: ev1.id,
      partType: VehiclePartType.HEADLIGHT_LEFT,
      materialType: MaterialType.GLASS,
      severity: DamageSeverity.SHATTERED,
      confidence: 0.88,
      boundingBoxJson: { xmin: 0.22, ymin: 0.38, xmax: 0.38, ymax: 0.52 },
      repairAction: 'REPLACE',
    },
  });

  const bill1 = await prisma.billDocument.upsert({
    where: { id: 'seed-bill-001' },
    update: {},
    create: {
      id: 'seed-bill-001',
      claimId: claim1.id,
      fileUrl: 'https://storage.omniclaim.internal/bills/inv-9102.pdf',
      garageName: 'Metro Precision Collision Center',
      garageTaxId: 'EIN-88-291042',
      invoiceNumber: 'INV-2026-9102',
      invoiceDate: new Date('2026-11-24'),
      totalAmount: 855.0,
    },
  });

  const bli1 = await prisma.billLineItem.upsert({
    where: { id: 'seed-bli-001' },
    update: {},
    create: {
      id: 'seed-bli-001',
      billDocumentId: bill1.id,
      rawDescription: 'OEM Front Bumper Assembly Replacement',
      partType: VehiclePartType.BUMPER_FRONT,
      materialType: MaterialType.PLASTIC,
      isLabor: false,
      claimedCost: 450.0,
      ocrConfidence: 0.97,
    },
  });

  const bli2 = await prisma.billLineItem.upsert({
    where: { id: 'seed-bli-002' },
    update: {},
    create: {
      id: 'seed-bli-002',
      billDocumentId: bill1.id,
      rawDescription: 'Body Panel Paint & Refinish Labor 2.5 hrs',
      isLabor: true,
      claimedCost: 225.0,
      ocrConfidence: 0.95,
    },
  });

  const bli3 = await prisma.billLineItem.upsert({
    where: { id: 'seed-bli-003' },
    update: {},
    create: {
      id: 'seed-bli-003',
      billDocumentId: bill1.id,
      rawDescription: 'Rear Bumper Impact Reinforcement Bar',
      partType: VehiclePartType.BUMPER_REAR,
      materialType: MaterialType.METAL,
      isLabor: false,
      claimedCost: 180.0,
      ocrConfidence: 0.93,
    },
  });

  const recon1 = await prisma.reconciliationSummary.upsert({
    where: { claimId: claim1.id },
    update: {},
    create: {
      id: 'seed-recon-001',
      claimId: claim1.id,
      totalBilledAmount: 855.0,
      totalApprovedAmount: 675.0,
      totalPhantomAmount: 180.0,
      discrepancyCount: 1,
    },
  });

  await prisma.reconciledLineItem.upsert({
    where: { billLineItemId: bli1.id },
    update: {},
    create: {
      summaryId: recon1.id,
      billLineItemId: bli1.id,
      isVerifiedByDamage: true,
      matchedDamagePart: VehiclePartType.BUMPER_FRONT,
      systemDeduction: 0.0,
      approvedCost: 450.0,
    },
  });

  await prisma.reconciledLineItem.upsert({
    where: { billLineItemId: bli2.id },
    update: {},
    create: {
      summaryId: recon1.id,
      billLineItemId: bli2.id,
      isVerifiedByDamage: true,
      systemDeduction: 0.0,
      approvedCost: 225.0,
    },
  });

  await prisma.reconciledLineItem.upsert({
    where: { billLineItemId: bli3.id },
    update: {},
    create: {
      summaryId: recon1.id,
      billLineItemId: bli3.id,
      isVerifiedByDamage: false,
      systemDeduction: 180.0,
      approvedCost: 0.0,
      rejectionReason: 'Phantom charge: No damage detected on rear bumper',
    },
  });

  await prisma.actuarialAssessment.upsert({
    where: { claimId: claim1.id },
    update: {},
    create: {
      claimId: claim1.id,
      grossPartsTotal: 450.0,
      metalDepreciation: 0.0,
      plasticDepreciation: 225.0,
      glassDepreciation: 0.0,
      totalDepreciation: 225.0,
      totalLaborApproved: 225.0,
      applicableDeductible: 500.0,
      salvageValue: 0.0,
      netPayout: 675.0,
      isStpQualified: false,
    },
  });

  const fraud1 = await prisma.fraudScorecard.upsert({
    where: { claimId: claim1.id },
    update: {},
    create: {
      id: 'seed-fraud-001',
      claimId: claim1.id,
      compositeScore: 25,
      riskTier: FraudRiskTier.MEDIUM,
      notes: 'EXIF GPS offset 1.8km from reported accident coordinates',
    },
  });

  await prisma.fraudIndicator.upsert({
    where: { id: 'seed-fi-001' },
    update: {},
    create: {
      id: 'seed-fi-001',
      scorecardId: fraud1.id,
      type: FraudIndicatorType.EXIF_GPS_MISMATCH,
      riskContribution: 25,
      evidenceMetadata: { distanceMeters: 1820, reason: 'Photo EXIF GPS is 1.8km from claimed site' },
      isOverridden: false,
    },
  });

  // Claim 2: Settled STP Claim + Balanced Double-Entry Journals + Settlement Voucher
  await prisma.actuarialAssessment.upsert({
    where: { claimId: claim2.id },
    update: {},
    create: {
      claimId: claim2.id,
      grossPartsTotal: 320.0,
      metalDepreciation: 0.0,
      plasticDepreciation: 160.0,
      glassDepreciation: 0.0,
      totalDepreciation: 160.0,
      totalLaborApproved: 360.0,
      applicableDeductible: 250.0,
      salvageValue: 0.0,
      netPayout: 520.0,
      isStpQualified: true,
    },
  });

  await prisma.fraudScorecard.upsert({
    where: { claimId: claim2.id },
    update: {},
    create: {
      id: 'seed-fraud-002',
      claimId: claim2.id,
      compositeScore: 8,
      riskTier: FraudRiskTier.LOW,
      notes: 'Clean sensor telemetry and zero duplicate vectors — STP eligible',
    },
  });

  // Claim 3: Critical Fraud Review Scorecard
  const fraud3 = await prisma.fraudScorecard.upsert({
    where: { claimId: claim3.id },
    update: {},
    create: {
      id: 'seed-fraud-003',
      claimId: claim3.id,
      compositeScore: 75,
      riskTier: FraudRiskTier.CRITICAL,
      notes: 'Escalated to SIU for vector similarity duplicate match',
    },
  });

  await prisma.fraudIndicator.upsert({
    where: { id: 'seed-fi-002' },
    update: {},
    create: {
      id: 'seed-fi-002',
      scorecardId: fraud3.id,
      type: FraudIndicatorType.VECTOR_SIMILARITY_DUPLICATE,
      riskContribution: 50,
      evidenceMetadata: { cosineSimilarity: 0.964, matchedClaim: 'CLM-202508-1142' },
      isOverridden: false,
    },
  });

  // Transition Log, Field Audit Log & Active Lock
  await prisma.claimTransitionLog.upsert({
    where: { id: 'seed-tr-001' },
    update: {},
    create: {
      id: 'seed-tr-001',
      claimId: claim1.id,
      fromStatus: ClaimStatus.SUBMITTED,
      toStatus: ClaimStatus.TRIAGE_PENDING,
      reason: 'AI Vision + OCR completed — dispatched to Senior Claims Adjuster',
      triggeredById: adjusterId,
    },
  });

  await prisma.claimAuditLog.upsert({
    where: { id: 'seed-aud-001' },
    update: {},
    create: {
      id: 'seed-aud-001',
      claimId: claim1.id,
      userId: adjusterId,
      action: 'INITIAL_TRIAGE',
      fieldName: 'status',
      oldValue: 'SUBMITTED',
      newValue: 'TRIAGE_PENDING',
    },
  });

  await prisma.claimLock.upsert({
    where: { claimId: claim1.id },
    update: { expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    create: {
      claimId: claim1.id,
      userId: adjusterId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  // Balanced Double-Entry Ledger Journals & Settlement Voucher for Settled Claim 2
  const expenseAcctId = createdAccounts.get('5001')!;
  const payableAcctId = createdAccounts.get('2001')!;
  const cashAcctId = createdAccounts.get('1001')!;

  const existingJournal1 = await prisma.ledgerJournalEntry.findUnique({
    where: { entryNumber: 'JRNL-2026-00001' },
  });
  if (!existingJournal1) {
    await prisma.ledgerJournalEntry.create({
      data: {
        entryNumber: 'JRNL-2026-00001',
        claimId: claim2.id,
        description: 'Accrual journal for STP settled claim CLM-202611-8401',
        status: JournalStatus.POSTED,
        lines: {
          create: [
            { accountId: expenseAcctId, type: LedgerEntryType.DEBIT, amount: 520.0 },
            { accountId: payableAcctId, type: LedgerEntryType.CREDIT, amount: 520.0 },
          ],
        },
      },
    });
  }

  const existingJournal2 = await prisma.ledgerJournalEntry.findUnique({
    where: { entryNumber: 'JRNL-2026-00002' },
  });
  if (!existingJournal2) {
    await prisma.ledgerJournalEntry.create({
      data: {
        entryNumber: 'JRNL-2026-00002',
        claimId: claim2.id,
        description: 'ACH Disbursement clearing for STP settled claim CLM-202611-8401',
        status: JournalStatus.POSTED,
        lines: {
          create: [
            { accountId: payableAcctId, type: LedgerEntryType.DEBIT, amount: 520.0 },
            { accountId: cashAcctId, type: LedgerEntryType.CREDIT, amount: 520.0 },
          ],
        },
      },
    });
  }

  await prisma.settlementVoucher.upsert({
    where: { claimId: claim2.id },
    update: {},
    create: {
      claimId: claim2.id,
      voucherNumber: 'VCHR-2026-88102',
      pdfUrl: 'https://storage.omniclaim.internal/vouchers/VCHR-2026-88102.pdf',
      qrHash: crypto.createHash('sha256').update('VCHR-2026-88102:520.00').digest('hex'),
      payoutMethod: 'ACH',
    },
  });

  // Initial Security Audit Log
  await prisma.securityAuditLog.upsert({
    where: { id: 'seed-sec-001' },
    update: {},
    create: {
      id: 'seed-sec-001',
      eventType: AuthAuditEventType.LOGIN_PASSWORD,
      targetUserId: adminId,
      actorIdentifier: 'superadmin',
      platform: 'API',
      metadata: { action: 'DATABASE_SEED_BOOTSTRAP', version: '2.0.0' },
    },
  });

  // Initial Global HTTP Request & Change Audit Log Seed Entries (Idempotent)
  const seedActivityLogs = [
    {
      id: 'seed-act-001',
      method: 'POST',
      path: '/api/v1/super-admin/policies',
      routePattern: '/api/v1/super-admin/policies',
      module: 'POLICIES',
      entityType: 'Policy',
      entityId: createdPolicies.get('POL-OMNI-2026-9081')!,
      action: 'CREATE_POLICY',
      statusCode: 201,
      success: true,
      durationMs: 38,
      userId: adminId,
      username: 'superadmin',
      userEmail: 'admin@omniclaim.internal',
      userFullName: 'Chief Enterprise Admin',
      userRole: 'SUPER_ADMIN',
      isMasterLogin: false,
      ipAddress: '127.0.0.1',
      userAgent: 'OmniClaim-Seeder/2.0',
      requestBody: { policyNumber: 'POL-OMNI-2026-9081', vehicleMake: 'Honda', vehicleModel: 'Accord', coverageLimit: 50000 },
      oldValues: null,
      newValues: { policyNumber: 'POL-OMNI-2026-9081', vehicleMake: 'Honda', vehicleModel: 'Accord', coverageLimit: 50000, isActive: true },
      changedFields: [
        { field: 'policyNumber', oldValue: null, newValue: 'POL-OMNI-2026-9081' },
        { field: 'coverageLimit', oldValue: null, newValue: 50000 },
      ],
    },
    {
      id: 'seed-act-002',
      method: 'PATCH',
      path: `/api/v1/claims/${claim1.id}`,
      routePattern: '/api/v1/claims/:id',
      module: 'CLAIMS',
      entityType: 'Claim',
      entityId: claim1.id,
      action: 'UPDATE_CLAIM',
      statusCode: 200,
      success: true,
      durationMs: 44,
      userId: adjusterId,
      username: 'sarah.jenkins',
      userEmail: 'adjuster.senior@omniclaim.internal',
      userFullName: 'Sarah Jenkins',
      userRole: 'CLAIMS_ADJUSTER',
      isMasterLogin: false,
      ipAddress: '127.0.0.1',
      userAgent: 'OmniClaim-Web/2.0',
      requestBody: { status: 'TRIAGE_PENDING' },
      oldValues: { status: 'SUBMITTED', version: 0 },
      newValues: { status: 'TRIAGE_PENDING', version: 1 },
      changedFields: [
        { field: 'status', oldValue: 'SUBMITTED', newValue: 'TRIAGE_PENDING' },
        { field: 'version', oldValue: 0, newValue: 1 },
      ],
    },
    {
      id: 'seed-act-003',
      method: 'GET',
      path: '/api/v1/claims?status=TRIAGE_PENDING',
      routePattern: '/api/v1/claims',
      module: 'CLAIMS',
      entityType: 'Claim',
      entityId: null,
      action: 'READ_CLAIMS',
      statusCode: 200,
      success: true,
      durationMs: 19,
      userId: adjusterId,
      username: 'sarah.jenkins',
      userEmail: 'adjuster.senior@omniclaim.internal',
      userFullName: 'Sarah Jenkins',
      userRole: 'CLAIMS_ADJUSTER',
      isMasterLogin: false,
      ipAddress: '127.0.0.1',
      userAgent: 'OmniClaim-Web/2.0',
      queryParams: { status: 'TRIAGE_PENDING' },
      oldValues: null,
      newValues: null,
      changedFields: [],
    },
  ];

  for (const act of seedActivityLogs) {
    await prisma.systemActivityAuditLog.upsert({
      where: { id: act.id },
      update: {},
      create: act as any,
    });
  }

  // =========================================================================
  // 11. POLICY CATEGORIES & PRODUCTS MASTER SEED (Idempotent)
  // =========================================================================
  const categoriesData = [
    { code: 'AUTO', name: 'Auto & Motor Insurance', description: 'Comprehensive collision, liability, and roadside protection for private and fleet vehicles.', icon: 'Car', requiresUnderwriting: true, sortOrder: 1 },
    { code: 'HEALTH', name: 'Health & Medical Cover', description: 'In-patient hospitalization, critical illness, surgical and preventive family care.', icon: 'HeartPulse', requiresUnderwriting: true, sortOrder: 2 },
    { code: 'HOME', name: 'Home & Property Shield', description: 'Structural building protection, natural disaster, fire, theft, and home contents.', icon: 'Home', requiresUnderwriting: true, sortOrder: 3 },
    { code: 'LIFE', name: 'Term & Whole Life', description: 'Guaranteed family income protection, accidental death benefit, and critical rider.', icon: 'Shield', requiresUnderwriting: true, sortOrder: 4 },
    { code: 'TRAVEL', name: 'Global Travel Guard', description: 'Emergency international medical evacuation, flight delay, and baggage loss protection.', icon: 'Plane', requiresUnderwriting: false, sortOrder: 5 },
  ];

  const categoryIds = new Map<string, string>();
  if ((prisma as any).policyCategory?.upsert) {
    for (const cat of categoriesData) {
      const record = await (prisma as any).policyCategory.upsert({
        where: { code: cat.code },
        update: { name: cat.name, description: cat.description, icon: cat.icon, sortOrder: cat.sortOrder },
        create: { ...cat, isActive: true },
      });
      categoryIds.set(cat.code, record.id);
    }
  }

  // Configurable Vehicle Types under Auto & Motor Insurance (CAR, BIKE, BUS)
  const vehicleTypeIds = new Map<string, string>();
  if ((prisma as any).vehicleType?.upsert && categoryIds.has('AUTO')) {
    const autoCatId = categoryIds.get('AUTO')!;
    const vTypes = [
      { code: 'CAR', name: 'Car / Passenger Sedan & SUV', description: 'Private passenger cars, hatchbacks, sedans, and SUVs', icon: 'Car', sortOrder: 1 },
      { code: 'BIKE', name: 'Bike / Motorcycle & Scooter', description: 'Two-wheelers including motorcycles and scooters', icon: 'Bike', sortOrder: 2 },
      { code: 'BUS', name: 'Bus & Passenger Fleet', description: 'Commercial passenger buses and fleet coaches', icon: 'Bus', sortOrder: 3 },
    ];
    for (const vt of vTypes) {
      const rec = await (prisma as any).vehicleType.upsert({
        where: { categoryId_code: { categoryId: autoCatId, code: vt.code } },
        update: { name: vt.name, description: vt.description, icon: vt.icon, sortOrder: vt.sortOrder, isActive: true },
        create: { categoryId: autoCatId, ...vt, isActive: true },
      });
      vehicleTypeIds.set(vt.code, rec.id);
    }
  }

  const productsData: Array<Record<string, any>> = [
    {
      productCode: 'PRD-AUTO-COMP-01',
      categoryCode: 'AUTO',
      vehicleTypeCode: 'CAR',
      name: 'Comprehensive Car Policy',
      description: 'Full zero-depreciation glass & collision repair with direct garage cashless settlement.',
      baseRateAnnual: 980.0,
      minCoverageAmount: 15000.0,
      maxCoverageAmount: 250000.0,
      defaultDeductible: 500.0,
      termMonthsOptions: [6, 12, 24],
      requiredDocumentsJson: ['ID_PROOF', 'VEHICLE_RC', 'DRIVER_LICENSE'],
      underwritingRulesJson: { maxVehicleAgeYears: 15, autoApproveMaxCoverage: 75000 },
      eligibilityJson: { vehicleAgeMaxYears: 15, usage: ['PRIVATE'] },
      exclusionsJson: ['Wear and tear', 'Driving without valid license', 'DUI incidents'],
      addonsJson: ['Zero Depreciation', 'Roadside Assistance', 'Engine Protection'],
    },
    {
      productCode: 'PRD-AUTO-CAR-BASIC',
      categoryCode: 'AUTO',
      vehicleTypeCode: 'CAR',
      name: 'Basic Car Policy',
      description: 'Essential third-party liability and fire protection for everyday private cars.',
      baseRateAnnual: 520.0,
      minCoverageAmount: 10000.0,
      maxCoverageAmount: 75000.0,
      defaultDeductible: 750.0,
      termMonthsOptions: [6, 12],
      requiredDocumentsJson: ['ID_PROOF', 'VEHICLE_RC'],
      underwritingRulesJson: { maxVehicleAgeYears: 20, autoApproveMaxCoverage: 75000 },
      eligibilityJson: { vehicleAgeMaxYears: 20, usage: ['PRIVATE'] },
      exclusionsJson: ['Commercial rideshare use', 'Racing events'],
      addonsJson: ['Roadside Assistance'],
    },
    {
      productCode: 'PRD-AUTO-CAR-PREM',
      categoryCode: 'AUTO',
      vehicleTypeCode: 'CAR',
      name: 'Premium Car Policy',
      description: 'VIP bumper-to-bumper cover with OEM parts guarantee, consumables cover, and rental reimbursement.',
      baseRateAnnual: 1490.0,
      minCoverageAmount: 25000.0,
      maxCoverageAmount: 500000.0,
      defaultDeductible: 250.0,
      termMonthsOptions: [12, 24],
      requiredDocumentsJson: ['ID_PROOF', 'VEHICLE_RC', 'DRIVER_LICENSE'],
      underwritingRulesJson: { maxVehicleAgeYears: 10, autoApproveMaxCoverage: 120000 },
      eligibilityJson: { vehicleAgeMaxYears: 10, usage: ['PRIVATE', 'EXECUTIVE'] },
      exclusionsJson: ['Intentional damage'],
      addonsJson: ['Zero Depreciation', 'OEM Return-to-Invoice', 'Rental Car', 'Key Replacement'],
    },
    {
      productCode: 'PRD-AUTO-BIKE-BASIC',
      categoryCode: 'AUTO',
      vehicleTypeCode: 'BIKE',
      name: 'Basic Bike Policy',
      description: 'Statutory liability and theft protection for motorcycles and scooters.',
      baseRateAnnual: 195.0,
      minCoverageAmount: 5000.0,
      maxCoverageAmount: 35000.0,
      defaultDeductible: 150.0,
      termMonthsOptions: [6, 12, 24],
      requiredDocumentsJson: ['ID_PROOF', 'VEHICLE_RC'],
      underwritingRulesJson: { maxVehicleAgeYears: 15, autoApproveMaxCoverage: 35000 },
      eligibilityJson: { engineCcMin: 50 },
      exclusionsJson: ['Stunt riding', 'Off-road racing'],
      addonsJson: ['Pillion Rider Cover'],
    },
    {
      productCode: 'PRD-AUTO-BIKE-COMP',
      categoryCode: 'AUTO',
      vehicleTypeCode: 'BIKE',
      name: 'Comprehensive Bike Policy',
      description: 'Complete accident collision, helmet, accessories, and natural disaster bike cover.',
      baseRateAnnual: 360.0,
      minCoverageAmount: 8000.0,
      maxCoverageAmount: 60000.0,
      defaultDeductible: 100.0,
      termMonthsOptions: [12, 24],
      requiredDocumentsJson: ['ID_PROOF', 'VEHICLE_RC', 'DRIVER_LICENSE'],
      underwritingRulesJson: { maxVehicleAgeYears: 12, autoApproveMaxCoverage: 50000 },
      eligibilityJson: { engineCcMin: 50 },
      exclusionsJson: ['Unlicensed rider'],
      addonsJson: ['Zero Depreciation', 'Helmet & Gear Cover'],
    },
    {
      productCode: 'PRD-AUTO-BUS-PASS',
      categoryCode: 'AUTO',
      vehicleTypeCode: 'BUS',
      name: 'Passenger Bus Policy',
      description: 'Commercial passenger transit liability, windshield, and collision coverage for buses.',
      baseRateAnnual: 2450.0,
      minCoverageAmount: 75000.0,
      maxCoverageAmount: 1500000.0,
      defaultDeductible: 1500.0,
      termMonthsOptions: [12, 24],
      requiredDocumentsJson: ['ID_PROOF', 'VEHICLE_RC', 'COMMERCIAL_PERMIT'],
      underwritingRulesJson: { maxVehicleAgeYears: 12, autoApproveMaxCoverage: 100000 },
      eligibilityJson: { commercialPermitRequired: true },
      exclusionsJson: ['Overloading beyond seating capacity'],
      addonsJson: ['Passenger Personal Accident', 'Towing & Recovery'],
    },
    {
      productCode: 'PRD-HLTH-FAM-01',
      categoryCode: 'HEALTH',
      name: 'OmniCare Family Floater',
      description: 'Cashless hospital network, annual health checkup, and zero-wait emergency cover.',
      baseRateAnnual: 1450.0,
      minCoverageAmount: 25000.0,
      maxCoverageAmount: 500000.0,
      defaultDeductible: 250.0,
      termMonthsOptions: [12, 24],
      requiredDocumentsJson: ['ID_PROOF', 'MEDICAL_DECLARATION'],
      underwritingRulesJson: { maxApplicantAge: 65, autoApproveMaxCoverage: 100000 },
    },
    {
      productCode: 'PRD-HOME-STD-01',
      categoryCode: 'HOME',
      name: 'OmniHome Property Protector',
      description: 'Covers structure, fire, flood, burglary, and valuable electronics contents.',
      baseRateAnnual: 820.0,
      minCoverageAmount: 50000.0,
      maxCoverageAmount: 1000000.0,
      defaultDeductible: 1000.0,
      termMonthsOptions: [12, 24, 36],
      requiredDocumentsJson: ['ID_PROOF', 'PROPERTY_DEED'],
      underwritingRulesJson: { autoApproveMaxCoverage: 300000 },
    },
    {
      productCode: 'PRD-LIFE-TRM-01',
      categoryCode: 'LIFE',
      name: 'OmniLife Term Assurance 20',
      description: 'Pure high-value term life protection with terminal illness accelerated payout.',
      baseRateAnnual: 640.0,
      minCoverageAmount: 100000.0,
      maxCoverageAmount: 2000000.0,
      defaultDeductible: 0.0,
      termMonthsOptions: [12, 24, 60],
      requiredDocumentsJson: ['ID_PROOF', 'INCOME_PROOF'],
      underwritingRulesJson: { autoApproveMaxCoverage: 250000 },
    },
    {
      productCode: 'PRD-TRVL-GLB-01',
      categoryCode: 'TRAVEL',
      name: 'OmniVoyage Worldwide Pass',
      description: 'Instant travel issuance covering medical, passport loss, and trip cancellation.',
      baseRateAnnual: 180.0,
      minCoverageAmount: 10000.0,
      maxCoverageAmount: 150000.0,
      defaultDeductible: 100.0,
      termMonthsOptions: [1, 3, 6, 12],
      requiredDocumentsJson: ['PASSPORT_ID'],
      underwritingRulesJson: { instantQuoteEligible: true },
    },
  ];

  if ((prisma as any).policyProduct?.upsert && categoryIds.size > 0) {
    for (const prod of productsData) {
      const catId = categoryIds.get(prod.categoryCode);
      if (!catId) continue;
      const vtId = prod.vehicleTypeCode ? vehicleTypeIds.get(prod.vehicleTypeCode) || null : null;
      await (prisma as any).policyProduct.upsert({
        where: { productCode: prod.productCode },
        update: {
          name: prod.name,
          description: prod.description,
          baseRateAnnual: prod.baseRateAnnual,
          ...(vtId ? { vehicleTypeId: vtId } : {}),
          ...(prod.eligibilityJson ? { eligibilityJson: prod.eligibilityJson } : {}),
          ...(prod.exclusionsJson ? { exclusionsJson: prod.exclusionsJson } : {}),
          ...(prod.addonsJson ? { addonsJson: prod.addonsJson } : {}),
        },
        create: {
          productCode: prod.productCode,
          categoryId: catId,
          vehicleTypeId: vtId,
          name: prod.name,
          description: prod.description,
          version: 1,
          baseRateAnnual: prod.baseRateAnnual,
          minCoverageAmount: prod.minCoverageAmount,
          maxCoverageAmount: prod.maxCoverageAmount,
          defaultDeductible: prod.defaultDeductible,
          termMonthsOptions: prod.termMonthsOptions,
          requiredDocumentsJson: prod.requiredDocumentsJson,
          underwritingRulesJson: prod.underwritingRulesJson,
          eligibilityJson: prod.eligibilityJson || null,
          exclusionsJson: prod.exclusionsJson || null,
          addonsJson: prod.addonsJson || null,
          isActive: true,
        },
      });
    }
  }

  return {
    permissions: permissionsData.length,
    roles: rolesData.length,
    users: usersData.length,
    settings: systemSettings.length,
    menus: menusData.length,
    parts: partsData.length,
    depreciationRules: depRulesData.length,
    automationRules: autoRulesData.length,
    garages: garagesData.length,
    ledgerAccounts: chartOfAccounts.length,
    policies: policiesData.length,
    claims: 3,
    journals: 2,
    activityAuditLogs: seedActivityLogs.length,
  };
}
