import { Module } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { ClaimFsmModule } from '../fsm/claim-fsm.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { ActuarialModule } from '../actuarial/actuarial.module';
import { FraudEngineModule } from '../fraud/fraud.module';
import { LedgerModule } from '../ledger/ledger.module';
import { StpModule } from '../stp/stp.module';

@Module({
  imports: [
    ClaimFsmModule,
    ReconciliationModule,
    ActuarialModule,
    FraudEngineModule,
    LedgerModule,
    StpModule,
  ],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
