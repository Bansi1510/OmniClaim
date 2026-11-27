import { Controller, Get, Param } from '@nestjs/common';
import { PolicyService } from '../services/PolicyService';

@Controller('policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.policyService.getPolicyById(id);
  }
}
// Assume PolicyService fetches policy with isAssetImageRequired and imageRequirementConfig