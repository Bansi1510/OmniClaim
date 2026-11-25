import { Module } from '@nestjs/common';
import { FraudEngineService } from './fraud.service';

@Module({
  providers: [FraudEngineService],
  exports: [FraudEngineService],
})
export class FraudEngineModule {}
