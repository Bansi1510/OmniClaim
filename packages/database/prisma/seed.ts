import { PrismaClient, LedgerAccountType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Utility password hasher for seed (PBKDF2 SHA-512)
function hashPassword(password: string, salt: string = 'omniclaim_secure_salt'): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

async function main() {
  console.log('🌱 Starting OmniClaim Database Seeding...');

  // =========================================================================
  // 1. SEED PERMISSIONS (Granular Resource:Action matrix)
  // =========================================================================
  const permissionsData = [
    // Claims Lifecycle
    { slug: 'claims:read', module: 'CLAIMS', description: 'View claims list and detail views' },
    { slug: 'claims:create', module: 'CLAIMS', description: 'Submit new insurance claims' },
    { slug: 'claims:update', module: 'CLAIMS', description: 'Modify claim details and metadata' },
    { slug: 'claims:triage', module: 'CLAIMS', description: 'Perform initial claim triage and queue dispatch' },
    { slug: 'claims:approve', module: 'CLAIMS', description: 'Grant formal adjuster approval for settlement' },
    { slug: 'claims:reject', module: 'CLAIMS', description: 'Formal claim rejection with dispute reason' },
    { slug: 'claims:override_reconciliation', module: 'CLAIMS', description: 'Manually override AI-detected phantom items' },
    { slug: 'claims:settle', module: 'CLAIMS', description: 'Execute final financial claim settlement and voucher creation' },

    // Financial Ledger
    { slug: 'ledger:read', module: 'LEDGER', description: 'Inspect general ledger journals and balance sheets' },
    { slug: 'ledger:post', module: 'LEDGER', description: 'Post manual or automated double-entry journal vouchers' },
    { slug: 'ledger:export', module: 'LEDGER', description: 'Export GAAP/IFRS compliant financial audit statements' },

    // Fraud Investigation
    { slug: 'fraud:read', module: 'FRAUD', description: 'View fraud scorecards, indicators, and vector similarity reports' },
    { slug: 'fraud:override', module: 'FRAUD', description: 'Override triggered fraud flags with documented justification' },
    { slug: 'fraud:investigate', module: 'FRAUD', description: 'Mark claim for deep SIU (Special Investigation Unit) audit' },

    // Dynamic RBAC Management
    { slug: 'rbac:roles_create', module: 'RBAC', description: 'Create new custom enterprise roles' },
    { slug: 'rbac:roles_update', module: 'RBAC', description: 'Modify role definitions and attach/detach permissions' },
    { slug: 'rbac:roles_delete', module: 'RBAC', description: 'Delete non-system custom roles' },
    { slug: 'rbac:users_assign', module: 'RBAC', description: 'Assign or revoke roles from users' },

    // System & Audit
    { slug: 'audit:read', module: 'AUDIT', description: 'Inspect immutable time-travel audit logs and lock leases' },
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
      description: 'Unrestricted enterprise administrative access',
      isSystem: true,
      permissions: Array.from(createdPermissions.keys()), // All permissions
    },
    {
      name: 'Senior Claims Adjuster',
      slug: 'SENIOR_ADJUSTER',
      description: 'Comprehensive claim assessment, approval, and override rights',
      isSystem: true,
      permissions: [
        'claims:read', 'claims:update', 'claims:triage', 'claims:approve',
        'claims:reject', 'claims:override_reconciliation', 'claims:settle',
        'fraud:read', 'fraud:override', 'ledger:read', 'audit:read',
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
        'claims:read', 'claims:settle', 'ledger:read', 'ledger:post', 'ledger:export', 'audit:read',
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

    // Sync permissions for this role
    for (const permSlug of roleDef.permissions) {
      const permId = createdPermissions.get(permSlug);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // =========================================================================
  // 3. SEED DEFAULT ROOT ADMIN & DEMO ADJUSTER USERS
  // =========================================================================
  const defaultPasswordHash = hashPassword('AdminOmniClaim2026!');

  const usersData = [
    {
      email: 'admin@omniclaim.internal',
      fullName: 'Chief Enterprise Admin',
      roleSlug: 'SUPER_ADMIN',
    },
    {
      email: 'adjuster.senior@omniclaim.internal',
      fullName: 'Sarah Jenkins (Senior Adjuster)',
      roleSlug: 'SENIOR_ADJUSTER',
    },
    {
      email: 'fraud.siu@omniclaim.internal',
      fullName: 'Marcus Vance (SIU Fraud Investigator)',
      roleSlug: 'FRAUD_INVESTIGATOR',
    },
    {
      email: 'policyholder.demo@omniclaim.internal',
      fullName: 'Alex Rivera (Vehicle Owner)',
      roleSlug: 'POLICYHOLDER',
    },
  ];

  console.log(`- Upserting ${usersData.length} users with assigned dynamic roles...`);
  const createdUsers = new Map<string, string>();
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash: defaultPasswordHash,
        isActive: true,
      },
    });
    createdUsers.set(u.email, user.id);

    const roleId = createdRoles.get(u.roleSlug);
    if (roleId) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: roleId,
        },
      });
    }
  }

  // =========================================================================
  // 4. SEED STANDARD GAAP/IFRS CHART OF ACCOUNTS (LEDGER)
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
  // 5. SEED SAMPLE ACTIVE POLICY FOR DEMO TESTING
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
