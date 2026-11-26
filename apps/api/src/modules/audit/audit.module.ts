import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLoggingInterceptor } from './audit-logging.interceptor';
import { AuditFallbackMiddleware } from './audit-fallback.middleware';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditFallbackMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor,
    },
  ],
  exports: [AuditService, AuditFallbackMiddleware],
})
export class AuditModule {}
