import {
  PrismaClient,
  LedgerAccountType,
  SettingValueType,
  VehiclePartType,
  MaterialType,
  AutomationRuleType,
} from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Utility password hasher for seed (PBKDF2 SHA-512)
function hashPassword(password: string, salt: string = 'omniclaim_secure_salt'): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

async function main() {
  console.log('🌱 Starting OmniClaim Enterprise Database Seeding...');

  // =========================================================================
  // 1. SEED PERMISSIONS (Granular Resource:Action matrix)
  // =========================================================================
  const permissionsData = [
    // Super Admin
    { slug: 'superadmin:access', module: 'SUPER_ADMIN', description: 'Unrestricted Super Admin command center access' },

    // Claims Lifecycle
    { slug: 'claims:read', module: 'CLAIMS', description: 'View claims list and detail views' },
    { slug: 'claims:create', module: 'CLAIMS', description: 'Submit new insurance claims' },
    { slug: 'claims:update', module: 'CLAIMS', description: 'Modify claim details and metadata' },
    { slug: 'claims:delete', module: 'CLAIMS', description: 'Delete claims from the system' },
    { slug: 'claims:triage', module: 'CLAIMS', description: 'Perform initial claim triage and queue dispatch' },
    { slug: 'claims:approve', module: 'CLAIMS', description: 'Grant formal adjuster approval for settlement' },
    { slug: 'claims:reject', module: 'CLAIMS', description: 'Formal claim rejection with dispute reason' },
    { slug: 'claims:override_reconciliation', module: 'CLAIMS', description: 'Manually override AI-detected phantom items' },
    { slug: 'claims:settle', module: 'CLAIMS', description: 'Execute final financial claim settlement and voucher creation' },

    // Financial Ledger
    { slug: 'ledger:read', module: 'LEDGER', description: 'Inspect general ledger journals and balance sheets' },
    { slug: 'ledger:post', module: 'LEDGER', description: 'Post manual or automated double-entry journal vouchers' },
    { slug: 'ledger:override', module: 'LEDGER', description: 'Edit or void ledger vouchers and accounts' },
    { slug: 'ledger:export', module: 'LEDGER', description: 'Export GAAP/IFRS compliant financial audit statements' },

    // Fraud Investigation
    { slug: 'fraud:read', module: 'FRAUD', description: 'View fraud scorecards, indicators, and vector similarity reports' },
    { slug: 'fraud:override', module: 'FRAUD', description: 'Override triggered fraud flags with documented justification' },
    { slug: 'fraud:investigate', module: 'FRAUD', description: 'Mark claim for deep SIU (Special Investigation Unit) audit' },

    // Dynamic Master Data & Rules
    { slug: 'policies:manage', module: 'MASTER_DATA', description: 'Add, edit, activate, or delete insurance policies' },
    { slug: 'parts:manage', module: 'MASTER_DATA', description: 'Add, edit, or delete parts catalog pricing and labor hours' },
    { slug: 'rules:manage', module: 'MASTER_DATA', description: 'Add, edit, or delete dynamic STP, Fraud & Depreciation rules' },
    { slug: 'garages:manage', module: 'MASTER_DATA', description: 'Add, edit, blacklist, or delete repair garages' },
    { slug: 'settings:manage', module: 'SETTINGS', description: 'Modify dynamic system settings and master security controls' },
    { slug: 'menus:manage', module: 'SETTINGS', description: 'Dynamically add, edit, reorder, or hide navigation menus' },

    // Dynamic RBAC Management
    { slug: 'rbac:roles_create', module: 'RBAC', description: 'Create new custom enterprise roles' },
    { slug: 'rbac:roles_update', module: 'RBAC', description: 'Modify role definitions and attach/detach permissions' },
    { slug: 'rbac:roles_delete', module: 'RBAC', description: 'Delete non-system custom roles' },
    { slug: 'rbac:roles_assign', module: 'RBAC', description: 'Assign granular rights to roles' },
    { slug: 'rbac:users_assign', module: 'RBAC', description: 'Create, edit, delete users and assign roles' },

    // System & Audit
    { slug: 'audit:read', module: 'AUDIT', description: 'Inspect immutable time-travel audit logs and lock leases' },
    { slug: 'presence:unlock', module: 'AUDIT', description: 'Force release active adjuster presence locks' },
  ];

  console.log(`- Upserting ${permissionsData.length} granular permissions...`);
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
  // 2. SEED SYSTEM ROLES & PERMISSION MAPPINGS
  // =========================================================================
  const rolesData = [
    {
      name: 'Super Administrator',
      slug: 'SUPER_ADMIN',
      description: 'Unrestricted enterprise administrative access — skips all permission checks',
      isSystem: true,
      permissions: Array.from(createdPermissions.keys()),
    },
    {
      name: 'Senior Claims Adjuster',
      slug: 'SENIOR_ADJUSTER',
      description: 'Comprehensive claim assessment, approval, and override rights',
      isSystem: true,
      permissions: [
        'claims:read', 'claims:create', 'claims:update', 'claims:triage', 'claims:approve',
        'claims:reject', 'claims:override_reconciliation',
        'fraud:read', 'ledger:read', 'audit:read',
      ],
    },
    {
      name: 'Junior Claims Adjuster',
      slug: 'JUNIOR_ADJUSTER',
      description: 'Claim intake, initial triage, and verification without final approval rights',
      isSystem: true,
      permissions: [
        'claims:read', 'claims:update', 'claims:triage', 'fraud:read', 'audit:read',
      ],
    },
    {
      name: 'Fraud Investigator (SIU)',
      slug: 'FRAUD_INVESTIGATOR',
      description: 'Special Investigation Unit: deep fraud review, vector search, override justification',
      isSystem: true,
      permissions: [
        'claims:read', 'fraud:read', 'fraud:override', 'fraud:investigate', 'audit:read',
      ],
    },
    {
      name: 'Finance Controller',
      slug: 'FINANCE_CONTROLLER',
      description: 'Disbursement authorization, double-entry ledger audits, and payout vouchers',
      isSystem: true,
      permissions: [
        'claims:read', 'claims:settle', 'ledger:read', 'ledger:post', 'ledger:override', 'ledger:export', 'audit:read',
      ],
    },
    {
      name: 'Policyholder',
      slug: 'POLICYHOLDER',
      description: 'Driver / Vehicle Owner: claim submission and tracking',
      isSystem: true,
      permissions: ['claims:read', 'claims:create'],
    },
  ];

  console.log(`- Upserting ${rolesData.length} system roles...`);
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
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permId },
          },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  // =========================================================================
  // 3. SEED DEFAULT ROOT ADMIN & DEMO USERS (with username + isSuperAdmin)
  // =========================================================================
  const defaultPasswordHash = hashPassword('AdminOmniClaim2026!');

  const usersData = [
    {
      username: 'superadmin',
      email: 'admin@omniclaim.internal',
      fullName: 'Chief Enterprise Admin',
      roleSlug: 'SUPER_ADMIN',
      isSuperAdmin: true,
    },
    {
      username: 'sarah.jenkins',
      email: 'adjuster.senior@omniclaim.internal',
      fullName: 'Sarah Jenkins (Senior Adjuster)',
      roleSlug: 'SENIOR_ADJUSTER',
      isSuperAdmin: false,
    },
    {
      username: 'marcus.vance',
      email: 'fraud.siu@omniclaim.internal',
      fullName: 'Marcus Vance (SIU Fraud Investigator)',
      roleSlug: 'FRAUD_INVESTIGATOR',
      isSuperAdmin: false,
    },
    {
      username: 'david.sterling',
      email: 'finance.controller@omniclaim.internal',
      fullName: 'David Sterling (Finance Controller)',
      roleSlug: 'FINANCE_CONTROLLER',
      isSuperAdmin: false,
    },
    {
      username: 'alex.rivera',
      email: 'policyholder.demo@omniclaim.internal',
      fullName: 'Alex Rivera (Vehicle Owner)',
      roleSlug: 'POLICYHOLDER',
      isSuperAdmin: false,
    },
  ];

  console.log(`- Upserting ${usersData.length} users with usernames and roles...`);
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
    createdUsers.set(u.email, user.id);

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
  // 4. SEED DYNAMIC SYSTEM SETTINGS (INCLUDING SUPER MASTER PASSWORD)
  // =========================================================================
  const masterPlaintext = process.env.SUPER_MASTER_PASSWORD || 'OmniMaster#2026!';
  const masterHash = hashPassword(masterPlaintext, 'omniclaim_master_salt');

  const systemSettings = [
    {
      key: 'SUPER_MASTER_PASSWORD_HASH',
      label: 'Super Master Password Hash',
      value: masterHash,
      valueType: SettingValueType.SECRET,
      category: 'SECURITY',
      description: 'PBKDF2-SHA512 hash enabling Super Admin access into any username account',
      isEditable: true,
    },
    {
      key: 'SUPER_MASTER_PASSWORD_ENABLED',
      label: 'Enable Super Master Password Login',
      value: 'true',
      valueType: SettingValueType.BOOLEAN,
      category: 'SECURITY',
      description: 'Master toggle to enable or disable universal Super Master Password authentication',
      isEditable: true,
    },
    {
      key: 'STP_MAX_PAYOUT',
      label: 'STP Auto-Settlement Max Payout ($)',
      value: '750.00',
      valueType: SettingValueType.NUMBER,
      category: 'STP',
      description: 'Maximum net payout eligible for autonomous Straight-Through Processing',
      isEditable: true,
    },
    {
      key: 'STP_MAX_FRAUD_SCORE',
      label: 'STP Maximum Fraud Risk Score',
      value: '15',
      valueType: SettingValueType.NUMBER,
      category: 'STP',
      description: 'Claims with composite fraud score below this threshold qualify for STP',
      isEditable: true,
    },
    {
      key: 'GPS_MISMATCH_METERS',
      label: 'Geospatial Mismatch Alert Radius (Meters)',
      value: '1000',
      valueType: SettingValueType.NUMBER,
      category: 'FRAUD',
      description: 'Haversine distance between incident GPS and photo EXIF GPS before flagging fraud',
      isEditable: true,
    },
    {
      key: 'PRESENCE_LOCK_TTL_SECONDS',
      label: 'Adjuster Presence Lock TTL (Seconds)',
      value: '300',
      valueType: SettingValueType.NUMBER,
      category: 'GENERAL',
      description: 'Duration of Redis collaborative editing lease on active claim dossiers',
      isEditable: true,
    },
    {
      key: 'COMPANY_BRAND_NAME',
      label: 'Platform Brand Name',
      value: 'OmniClaim Enterprise',
      valueType: SettingValueType.STRING,
      category: 'BRANDING',
      description: 'Dynamic organization display title across web and mobile interfaces',
      isEditable: true,
    },
    {
      key: 'MAINTENANCE_MODE',
      label: 'Maintenance Mode',
      value: 'false',
      valueType: SettingValueType.BOOLEAN,
      category: 'GENERAL',
      description: 'When enabled, non-Super Admin users see maintenance screen while Super Admins bypass',
      isEditable: true,
    },
  ];

  console.log(`- Upserting ${systemSettings.length} dynamic system settings...`);
  for (const s of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { label: s.label, description: s.description, category: s.category },
      create: s,
    });
  }

  // =========================================================================
  // 5. SEED DYNAMIC PARTS CATALOG, DEPRECIATION RULES, AUTOMATION RULES & GARAGES
  // =========================================================================
  const partsData = [
    { partCode: 'PRT-BUMP-FRT', partName: 'OEM Front Bumper Assembly', partType: VehiclePartType.BUMPER_FRONT, materialType: MaterialType.PLASTIC, oemBasePrice: 450.00, aftermarketPrice: 290.00, defaultLaborHours: 2.5, laborRatePerHour: 90.00 },
    { partCode: 'PRT-HDLT-LFT', partName: 'LED Headlight Assembly (Left)', partType: VehiclePartType.HEADLIGHT_LEFT, materialType: MaterialType.GLASS, oemBasePrice: 380.00, aftermarketPrice: 220.00, defaultLaborHours: 1.0, laborRatePerHour: 90.00 },
    { partCode: 'PRT-HOOD-OEM', partName: 'Sheet Metal Hood / Bonnet Panel', partType: VehiclePartType.HOOD_BONNET, materialType: MaterialType.METAL, oemBasePrice: 680.00, aftermarketPrice: 460.00, defaultLaborHours: 3.5, laborRatePerHour: 95.00 },
    { partCode: 'PRT-WNDS-FRT', partName: 'Acoustic Laminated Windshield', partType: VehiclePartType.WINDSHIELD_FRONT, materialType: MaterialType.GLASS, oemBasePrice: 520.00, aftermarketPrice: 340.00, defaultLaborHours: 2.0, laborRatePerHour: 85.00 },
  ];

  for (const part of partsData) {
    await prisma.vehiclePartCatalog.upsert({
      where: { partCode: part.partCode },
      update: { partName: part.partName, oemBasePrice: part.oemBasePrice },
      create: part,
    });
  }

  const existingDepCount = await prisma.depreciationRule.count();
  if (existingDepCount === 0) {
    await prisma.depreciationRule.createMany({
      data: [
        { name: 'Automotive Glass Zero Depreciation', materialType: MaterialType.GLASS, minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 0, priority: 1 },
        { name: 'Plastic & Composite Flat 50%', materialType: MaterialType.PLASTIC, minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 2 },
        { name: 'Rubber & Seals Flat 50%', materialType: MaterialType.RUBBER, minVehicleAgeYears: 0, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 3 },
        { name: 'Sheet Metal (0-1 Yr)', materialType: MaterialType.METAL, minVehicleAgeYears: 0, maxVehicleAgeYears: 1, depreciationPercent: 0, priority: 4 },
        { name: 'Sheet Metal (2 Yrs)', materialType: MaterialType.METAL, minVehicleAgeYears: 2, maxVehicleAgeYears: 2, depreciationPercent: 10, priority: 5 },
        { name: 'Sheet Metal (3 Yrs)', materialType: MaterialType.METAL, minVehicleAgeYears: 3, maxVehicleAgeYears: 3, depreciationPercent: 20, priority: 6 },
        { name: 'Sheet Metal (4 Yrs)', materialType: MaterialType.METAL, minVehicleAgeYears: 4, maxVehicleAgeYears: 4, depreciationPercent: 30, priority: 7 },
        { name: 'Sheet Metal (5+ Yrs Cap)', materialType: MaterialType.METAL, minVehicleAgeYears: 5, maxVehicleAgeYears: 100, depreciationPercent: 50, priority: 8 },
      ],
    });
  }

  const existingRuleCount = await prisma.automationRule.count();
  if (existingRuleCount === 0) {
    await prisma.automationRule.createMany({
      data: [
        { name: 'STP Fast-Track Ceiling', ruleType: AutomationRuleType.STP, metricKey: 'netPayout', operator: 'LTE', thresholdValue: '750', riskWeight: 0, action: 'AUTO_SETTLE', description: 'Eligible for autonomous payout when net payout <= $750' },
        { name: 'EXIF GPS Mismatch Rule', ruleType: AutomationRuleType.FRAUD, metricKey: 'gpsDistanceMeters', operator: 'GT', thresholdValue: '1000', riskWeight: 25, action: 'ADD_RISK_SCORE', description: 'Adds +25 risk points if photo GPS diverges >1km from incident site' },
        { name: 'Mock Location Spoofing', ruleType: AutomationRuleType.FRAUD, metricKey: 'isMockLocation', operator: 'EQ', thresholdValue: 'true', riskWeight: 40, action: 'FLAG_SIU', description: 'Immediate +40 risk score and SIU escalation on spoofed GPS' },
        { name: 'CLIP Vector Reuse Check', ruleType: AutomationRuleType.FRAUD, metricKey: 'vectorCosineSimilarity', operator: 'GTE', thresholdValue: '0.92', riskWeight: 50, action: 'FLAG_SIU', description: 'Flags recycled accident photos matching prior claims in pgvector' },
      ],
    });
  }

  const garagesData = [
    { code: 'GRG-METRO-01', name: 'Metro Precision Collision Center', city: 'New York', taxId: 'EIN-88-291042', hourlyLaborRate: 90.00, rating: 4.8, isPreferredNetwork: true, isBlacklisted: false, phone: '+1-212-555-0192', email: 'dispatch@metrocollision.example' },
    { code: 'GRG-APEX-02', name: 'Apex Certified Auto Body', city: 'Chicago', taxId: 'EIN-36-918204', hourlyLaborRate: 95.00, rating: 4.6, isPreferredNetwork: true, isBlacklisted: false, phone: '+1-312-555-0144', email: 'claims@apexbody.example' },
    { code: 'GRG-SHADY-99', name: 'QuickFix Unverified Motors', city: 'Newark', taxId: 'EIN-22-004910', hourlyLaborRate: 165.00, rating: 2.1, isPreferredNetwork: false, isBlacklisted: true, phone: '+1-973-555-0199', email: 'billing@quickfix.example' },
  ];

  for (const g of garagesData) {
    await prisma.repairGarage.upsert({
      where: { code: g.code },
      update: { name: g.name, hourlyLaborRate: g.hourlyLaborRate },
      create: g,
    });
  }

  // =========================================================================
  // 6. SEED STANDARD GAAP/IFRS CHART OF ACCOUNTS (LEDGER)
  // =========================================================================
  const chartOfAccounts = [
    { accountNumber: '1001', name: 'Operating Cash - Main Treasury', type: LedgerAccountType.ASSET },
    { accountNumber: '1050', name: 'Escrow Payout Clearing Account', type: LedgerAccountType.ASSET },
    { accountNumber: '2001', name: 'Claims Payable Liability', type: LedgerAccountType.LIABILITY },
    { accountNumber: '5001', name: 'Direct Auto Claims Expense', type: LedgerAccountType.EXPENSE },
    { accountNumber: '5010', name: 'Deductible Recovery Offset', type: LedgerAccountType.REVENUE },
    { accountNumber: '5020', name: 'Salvage Recovery Asset/Offset', type: LedgerAccountType.REVENUE },
  ];

  console.log(`- Upserting ${chartOfAccounts.length} standard ledger accounts...`);
  for (const acct of chartOfAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { accountNumber: acct.accountNumber },
      update: { name: acct.name, type: acct.type },
      create: acct,
    });
  }

  // =========================================================================
  // 7. SEED SAMPLE ACTIVE POLICY FOR DEMO TESTING
  // =========================================================================
  const demoUserId = createdUsers.get('policyholder.demo@omniclaim.internal')!;
  const samplePolicy = await prisma.policy.upsert({
    where: { policyNumber: 'POL-OMNI-2026-9081' },
    update: {},
    create: {
      policyNumber: 'POL-OMNI-2026-9081',
      policyHolderId: demoUserId,
      vehicleVin: '1HGCR2F83HA001928',
      vehicleMake: 'Honda',
      vehicleModel: 'Accord Touring',
      vehicleYear: 2022,
      coverageLimit: 50000.00,
      baseDeductible: 500.00,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      isActive: true,
    },
  });

  console.log(`✔ Seed finished successfully! Demo Policy ID: ${samplePolicy.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
