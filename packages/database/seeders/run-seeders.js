/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../dist');

const prisma = new PrismaClient();
const DATA_DIR = path.resolve(__dirname, 'data');

function readJson(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const resetRaw = process.argv.includes('--reset-raw');

  const permissions = readJson('permissions');
  const roles = readJson('roles');
  const rolePermissions = readJson('role_permissions');
  const dynamicMenus = readJson('dynamic_menus');
  const categories = readJson('policy_categories');
  const vehicleTypes = readJson('vehicle_types');
  const products = readJson('policy_products');
  const parts = readJson('vehicle_parts');
  const depRules = readJson('depreciation_rules');
  const autoRules = readJson('automation_rules');
  const garages = readJson('repair_garages');
  const settings = readJson('system_settings');

  if (resetRaw) {
    console.log('Deleting raw permission & menu rows before re-seeding...');
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({}),
      prisma.permission.deleteMany({}),
      prisma.dynamicMenuItem.deleteMany({}),
    ]);
  }

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { module: p.module, description: p.description },
      create: p,
    });
  }
  console.log(`Seeded ${permissions.length} permissions from seeders/data/permissions.json`);

  for (const r of roles) {
    await prisma.role.upsert({
      where: { slug: r.slug },
      update: { name: r.name, description: r.description, isSystem: r.isSystem },
      create: r,
    });
  }
  console.log(`Seeded ${roles.length} roles from seeders/data/roles.json`);

  if (rolePermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: rolePermissions,
      skipDuplicates: true,
    });
    console.log(`Seeded ${rolePermissions.length} role_permissions from seeders/data/role_permissions.json`);
  }

  for (const m of dynamicMenus) {
    await prisma.dynamicMenuItem.upsert({
      where: { menuKey: m.menuKey },
      update: {
        label: m.label,
        navLink: m.navLink,
        icon: m.icon,
        parentKey: m.parentKey,
        requiredPermission: m.requiredPermission,
        badgeName: m.badgeName,
        badgeColor: m.badgeColor,
        sortOrder: m.sortOrder,
        isVisible: m.isVisible,
        isSystem: m.isSystem,
      },
      create: m,
    });
  }
  console.log(`Seeded ${dynamicMenus.length} dynamic_menus from seeders/data/dynamic_menus.json`);

  for (const c of categories) {
    await prisma.policyCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, isActive: c.isActive, sortOrder: c.sortOrder },
      create: c,
    });
  }

  for (const vt of vehicleTypes) {
    await prisma.vehicleType.upsert({
      where: { id: vt.id },
      update: { name: vt.name, description: vt.description, isActive: vt.isActive, sortOrder: vt.sortOrder },
      create: vt,
    });
  }

  for (const pr of products) {
    await prisma.policyProduct.upsert({
      where: { productCode: pr.productCode },
      update: {
        name: pr.name,
        description: pr.description,
        isActive: pr.isActive,
        vehicleTypeId: pr.vehicleTypeId,
        eligibilityJson: pr.eligibilityJson,
        exclusionsJson: pr.exclusionsJson,
        addonsJson: pr.addonsJson,
      },
      create: pr,
    });
  }

  for (const pt of parts) {
    await prisma.vehiclePartCatalog.upsert({
      where: { partCode: pt.partCode },
      update: { partName: pt.partName, oemBasePrice: pt.oemBasePrice, aftermarketPrice: pt.aftermarketPrice },
      create: pt,
    });
  }

  for (const dr of depRules) {
    await prisma.depreciationRule.upsert({
      where: { id: dr.id },
      update: { name: dr.name, depreciationPercent: dr.depreciationPercent, priority: dr.priority, isActive: dr.isActive },
      create: dr,
    });
  }

  for (const ar of autoRules) {
    await prisma.automationRule.upsert({
      where: { id: ar.id },
      update: { name: ar.name, thresholdValue: ar.thresholdValue, riskWeight: ar.riskWeight, isActive: ar.isActive },
      create: ar,
    });
  }

  for (const g of garages) {
    await prisma.repairGarage.upsert({
      where: { code: g.code },
      update: { name: g.name, city: g.city, hourlyLaborRate: g.hourlyLaborRate, isPreferredNetwork: g.isPreferredNetwork },
      create: g,
    });
  }

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { label: s.label, value: s.value, category: s.category },
      create: s,
    });
  }

  console.log('All JSON seeders re-entered cleanly without timestamps.');
}

main()
  .catch((err) => {
    console.error('Seeder run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
