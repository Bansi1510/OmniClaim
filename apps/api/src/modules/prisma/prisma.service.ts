import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@omniclaim/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma Database connection established successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma Database connection disconnected.');
  }
}
