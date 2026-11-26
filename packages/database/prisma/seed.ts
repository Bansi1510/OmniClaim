import { PrismaClient } from '@prisma/client';
import { seedOmniClaimDatabase } from '../src/seed-engine';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting OmniClaim Complete Idempotent Database Seeder...');
  const summary = await seedOmniClaimDatabase(prisma);
  console.log('✔ Seed finished successfully across ALL tables:', JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
