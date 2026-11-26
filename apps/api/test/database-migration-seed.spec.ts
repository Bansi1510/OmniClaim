import * as fs from 'fs';
import * as path from 'path';
import { seedOmniClaimDatabase } from '@omniclaim/database';

describe('Database Migration SQL & Full-Schema Idempotent Seeder Verification', () => {
  const migrationsRoot = path.resolve(
    __dirname,
    '../../../packages/database/prisma/migrations',
  );
  const migrationSqlPath = path.join(
    migrationsRoot,
    '20261126000000_init_omniclaim_enterprise',
    'migration.sql',
  );
  const lockPath = path.join(migrationsRoot, 'migration_lock.toml');

  it('contains official Prisma migration_lock.toml pinned to postgresql', () => {
    expect(fs.existsSync(lockPath)).toBe(true);
    const lockContent = fs.readFileSync(lockPath, 'utf8');
    expect(lockContent).toContain('provider = "postgresql"');
  });

  it('contains clean UTF-8 (no BOM) migration.sql enabling pgvector and creating ALL 26 tables & 12 enums', () => {
    expect(fs.existsSync(migrationSqlPath)).toBe(true);
    const raw = fs.readFileSync(migrationSqlPath);
    // Verify NO UTF-8 BOM (0xEF 0xBB 0xBF)
    expect(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)).toBe(true);

    const sql = raw.toString('utf8');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "vector";');

    const expectedTables = [
      'Permission',
      'Role',
      'RolePermission',
      'User',
      'UserRole',
      'Policy',
      'Claim',
      'ClaimEvidence',
      'DetectedDamage',
      'BillDocument',
      'BillLineItem',
      'ReconciliationSummary',
      'ReconciledLineItem',
      'ActuarialAssessment',
      'FraudScorecard',
      'FraudIndicator',
      'ClaimTransitionLog',
      'ClaimAuditLog',
      'ClaimLock',
      'LedgerAccount',
      'LedgerJournalEntry',
      'LedgerTransactionLine',
      'SettlementVoucher',
      'SystemSetting',
      'SecurityAuditLog',
      'VehiclePartCatalog',
      'DepreciationRule',
      'AutomationRule',
      'RepairGarage',
      'DynamicMenuItem',
    ];

    for (const table of expectedTables) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }

    const expectedEnums = [
      'ClaimStatus',
      'VehiclePartType',
      'MaterialType',
      'DamageSeverity',
      'FraudRiskTier',
      'FraudIndicatorType',
      'LedgerAccountType',
      'LedgerEntryType',
      'JournalStatus',
      'SettingValueType',
      'AutomationRuleType',
      'AuthAuditEventType',
    ];

    for (const enumName of expectedEnums) {
      expect(sql).toContain(`CREATE TYPE "${enumName}" AS ENUM`);
    }
  });

  it('executes seedOmniClaimDatabase idempotently across ALL models without duplicate errors', async () => {
    const calledModels = new Set<string>();
    const journalNumbers = new Set<string>();

    const makeUpsertMock = (modelName: string) => ({
      upsert: jest.fn(({ create, where }) => {
        calledModels.add(modelName);
        return Promise.resolve({
          id: create?.id || where?.id || `${modelName}-${Math.random().toString(36).slice(2, 8)}`,
          ...create,
        });
      }),
    });

    const mockPrisma: any = {
      permission: makeUpsertMock('permission'),
      role: makeUpsertMock('role'),
      rolePermission: makeUpsertMock('rolePermission'),
      user: makeUpsertMock('user'),
      userRole: makeUpsertMock('userRole'),
      systemSetting: makeUpsertMock('systemSetting'),
      dynamicMenuItem: makeUpsertMock('dynamicMenuItem'),
      vehiclePartCatalog: makeUpsertMock('vehiclePartCatalog'),
      depreciationRule: makeUpsertMock('depreciationRule'),
      automationRule: makeUpsertMock('automationRule'),
      repairGarage: makeUpsertMock('repairGarage'),
      ledgerAccount: makeUpsertMock('ledgerAccount'),
      policy: makeUpsertMock('policy'),
      claim: makeUpsertMock('claim'),
      claimEvidence: makeUpsertMock('claimEvidence'),
      detectedDamage: makeUpsertMock('detectedDamage'),
      billDocument: makeUpsertMock('billDocument'),
      billLineItem: makeUpsertMock('billLineItem'),
      reconciliationSummary: makeUpsertMock('reconciliationSummary'),
      reconciledLineItem: makeUpsertMock('reconciledLineItem'),
      actuarialAssessment: makeUpsertMock('actuarialAssessment'),
      fraudScorecard: makeUpsertMock('fraudScorecard'),
      fraudIndicator: makeUpsertMock('fraudIndicator'),
      claimTransitionLog: makeUpsertMock('claimTransitionLog'),
      claimAuditLog: makeUpsertMock('claimAuditLog'),
      claimLock: makeUpsertMock('claimLock'),
      settlementVoucher: makeUpsertMock('settlementVoucher'),
      securityAuditLog: makeUpsertMock('securityAuditLog'),
      ledgerJournalEntry: {
        findUnique: jest.fn(({ where: { entryNumber } }) => {
          calledModels.add('ledgerJournalEntry');
          return Promise.resolve(journalNumbers.has(entryNumber) ? { entryNumber } : null);
        }),
        create: jest.fn(({ data }) => {
          journalNumbers.add(data.entryNumber);
          return Promise.resolve({ id: `je-${journalNumbers.size}`, ...data });
        }),
      },
    };

    // First run on empty DB
    const run1 = await seedOmniClaimDatabase(mockPrisma);
    expect(run1.permissions).toBeGreaterThanOrEqual(30);
    expect(run1.roles).toBe(6);
    expect(run1.users).toBe(5);
    expect(run1.settings).toBe(8);
    expect(run1.menus).toBe(15);
    expect(run1.parts).toBe(6);
    expect(run1.depreciationRules).toBe(8);
    expect(run1.automationRules).toBe(4);
    expect(run1.garages).toBe(3);
    expect(run1.ledgerAccounts).toBe(6);
    expect(run1.policies).toBe(3);
    expect(run1.claims).toBe(3);
    expect(run1.journals).toBe(2);

    // Every single domain model seeded
    expect(calledModels.size).toBe(29);
    expect(mockPrisma.ledgerJournalEntry.create).toHaveBeenCalledTimes(2);

    // Second run (Idempotency Check!) -> journals must NOT duplicate!
    await seedOmniClaimDatabase(mockPrisma);
    expect(mockPrisma.ledgerJournalEntry.create).toHaveBeenCalledTimes(2);
  });
});
