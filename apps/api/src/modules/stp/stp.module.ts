import { Module } from '@nestjs/common';
import { StpRuleEngineService } from './stp.service';
import { ClaimFsmModule } from '../fsm/claim-fsm.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [ClaimFsmModule, LedgerModule],
  providers: [StpRuleEngineService],
  exports: [StpRuleEngineService],
})
export class StpModule {}
