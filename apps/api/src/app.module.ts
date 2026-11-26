import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { ClaimFsmModule } from './modules/fsm/claim-fsm.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { ActuarialModule } from './modules/actuarial/actuarial.module';
import { FraudEngineModule } from './modules/fraud/fraud.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { StpModule } from './modules/stp/stp.module';
import { WebhookModule } from './modules/webhooks/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    RbacModule,
    SuperAdminModule,
    ClaimFsmModule,
    ReconciliationModule,
    ActuarialModule,
    FraudEngineModule,
    LedgerModule,
    StpModule,
    ClaimsModule,
    WebhookModule,
  ],
})
export class AppModule {}
