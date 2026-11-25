import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ClaimFsmModule } from '../fsm/claim-fsm.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { ActuarialModule } from '../actuarial/actuarial.module';
import { FraudEngineModule } from '../fraud/fraud.module';
import { StpModule } from '../stp/stp.module';

@Module({
  imports: [
    ClaimFsmModule,
    ReconciliationModule,
    ActuarialModule,
    FraudEngineModule,
    StpModule,
  ],
  controllers: [WebhookController],
})
export class WebhookModule {}
