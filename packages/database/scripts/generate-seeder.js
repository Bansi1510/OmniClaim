/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../dist');

const prisma = new PrismaClient();
const DATA_DIR = path.resolve(__dirname, '../seeders/data');

function stripTimestamps(rows) {
  return rows.map((row) => {
    const clean = { ...row };
    delete clean.createdAt;
    delete clean.updatedAt;
    return clean;
  });
}

async function exportTable(name, queryFn) {
  const rows = await queryFn();
  const clean = stripTimestamps(rows);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  console.log(`Exported ${clean.length} rows -> seeders/data/${name}.json`);
  return clean.length;
}

async function main() {
  console.log('Exporting OmniClaim database tables to JSON (without timestamps)...');

  await exportTable('permissions', () =>
    prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { slug: 'asc' }] }),
  );
  await exportTable('roles', () =>
    prisma.role.findMany({ orderBy: { slug: 'asc' } }),
  );
  await exportTable('role_permissions', () =>
    prisma.rolePermission.findMany({ orderBy: [{ roleId: 'asc' }, { permissionId: 'asc' }] }),
  );
  await exportTable('dynamic_menus', () =>
    prisma.dynamicMenuItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { menuKey: 'asc' }] }),
  );
  await exportTable('policy_categories', () =>
    prisma.policyCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
  );
  await exportTable('vehicle_types', () =>
    prisma.vehicleType.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
  );
  await exportTable('policy_products', () =>
    prisma.policyProduct.findMany({ orderBy: { productCode: 'asc' } }),
  );
  await exportTable('vehicle_parts', () =>
    prisma.vehiclePartCatalog.findMany({ orderBy: { partCode: 'asc' } }),
  );
  await exportTable('depreciation_rules', () =>
    prisma.depreciationRule.findMany({ orderBy: { priority: 'asc' } }),
  );
  await exportTable('automation_rules', () =>
    prisma.automationRule.findMany({ orderBy: [{ ruleType: 'asc' }, { name: 'asc' }] }),
  );
  await exportTable('repair_garages', () =>
    prisma.repairGarage.findMany({ orderBy: { code: 'asc' } }),
  );
  await exportTable('system_settings', () =>
    prisma.systemSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] }),
  );

  console.log('All seeder JSON exports completed.');
}

main()
  .catch((err) => {
    console.error('Seeder export failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
