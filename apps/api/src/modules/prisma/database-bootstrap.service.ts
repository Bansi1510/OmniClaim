import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { seedOmniClaimDatabase, SeedSummary } from '@omniclaim/database';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || process.env.AUTO_SEED_ON_BOOT === 'false') {
      return;
    }

    try {
      const [roleCount, settingCount, menuCount] = await Promise.all([
        this.prisma.role.count(),
        this.prisma.systemSetting.count(),
        this.prisma.dynamicMenuItem.count(),
      ]);

      if (roleCount === 0 || settingCount === 0 || menuCount === 0) {
        this.logger.log(
          '🌱 Fresh or incomplete database detected on startup — running idempotent OmniClaim seeder automatically...',
        );
        const summary = await seedOmniClaimDatabase(this.prisma);
        this.logger.log(
          `✔ Auto-seed completed! Roles=${summary.roles}, Users=${summary.users}, Permissions=${summary.permissions}, Menus=${summary.menus}, Claims=${summary.claims}`,
        );
      } else {
        this.logger.log(
          `✔ Database verified ready (${roleCount} roles, ${settingCount} settings, ${menuCount} menus).`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Skipping startup auto-seed (database unreachable or migrations pending): ${(err as Error).message}. Run "pnpm db:setup" once PostgreSQL is running.`,
      );
    }
  }

  async runIdempotentSeed(): Promise<SeedSummary> {
    this.logger.log('🌱 Running on-demand idempotent database seed via Super Admin...');
    return seedOmniClaimDatabase(this.prisma);
  }
}
