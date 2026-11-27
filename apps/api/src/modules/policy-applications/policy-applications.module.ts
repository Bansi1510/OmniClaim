import { Module } from '@nestjs/common';
import { PremiumEngineService } from './premium-engine.service';
import { PolicyApplicationsService } from './policy-applications.service';
import { PolicyApplicationsController } from './policy-applications.controller';

@Module({
  controllers: [PolicyApplicationsController],
  providers: [PremiumEngineService, PolicyApplicationsService],
  exports: [PremiumEngineService, PolicyApplicationsService],
})
export class PolicyApplicationsModule {}
