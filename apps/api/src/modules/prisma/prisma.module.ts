import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseBootstrapService } from './database-bootstrap.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseBootstrapService],
  exports: [PrismaService, DatabaseBootstrapService],
})
export class PrismaModule {}
