import { Module } from '@nestjs/common';
import { ClaimFsmService } from './claim-fsm.service';

@Module({
  providers: [ClaimFsmService],
  exports: [ClaimFsmService],
})
export class ClaimFsmModule {}
