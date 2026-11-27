import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditFallbackMiddleware } from './modules/audit/audit-fallback.middleware';
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
import { PolicyApplicationsModule } from './modules/policy-applications/policy-applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    AuditModule,
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
    PolicyApplicationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditFallbackMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
