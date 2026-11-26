import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, UpdateClaimDto, TransitionClaimDto, AssignAdjusterDto } from './dto/claims.dto';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { ActuarialService } from '../actuarial/actuarial.service';
import { FraudEngineService } from '../fraud/fraud.service';
import { LedgerService } from '../ledger/ledger.service';
import { StpRuleEngineService } from '../stp/stp.service';
import { ClaimStatus } from '@omniclaim/database';
import { IsString, IsNotEmpty, IsBoolean, IsNumber } from 'class-validator';

class SettleClaimDto {
  @ApiProperty({ example: 'ACH', enum: ['ACH', 'UPI', 'STRIPE', 'DIRECT_GARAGE'] })
  @IsString()
  @IsNotEmpty()
  payoutMethod: 'ACH' | 'UPI' | 'STRIPE' | 'DIRECT_GARAGE';
}

class OverrideReconciliationDto {
  @ApiProperty({ example: 'item-uuid' })
  @IsString()
  @IsNotEmpty()
  reconciledItemId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isApproved: boolean;

  @ApiProperty({ example: 450.00 })
  @IsNumber()
  approvedCost: number;

  @ApiProperty({ example: 'Mechanic provided supplementary physical evidence photo' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

class OverrideFraudDto {
  @ApiProperty({ example: 'indicator-uuid' })
  @IsString()
  @IsNotEmpty()
  indicatorId: string;

  @ApiProperty({ example: 'Policyholder proved they moved vehicle 2km to gas station for safety' })
  @IsString()
  @IsNotEmpty()
  overrideReason: string;
}

@ApiTags('Claims Management')
@Controller('api/v1/claims')
@UseGuards(DynamicPermissionsGuard)
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
    private readonly reconciliationService: ReconciliationService,
    private readonly actuarialService: ActuarialService,
    private readonly fraudService: FraudEngineService,
    private readonly ledgerService: LedgerService,
    private readonly stpService: StpRuleEngineService,
  ) {}

  @Post()
  @RequirePermissions('claims:create')
  @ApiOperation({ summary: 'Initiate a new auto insurance claim' })
  async createClaim(
    @Body() dto: CreateClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.createClaim(dto, user.id);
  }

  @Get()
  @RequirePermissions('claims:read')
  @ApiOperation({ summary: 'List and filter claims queue' })
  @ApiQuery({ name: 'status', enum: ClaimStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  async listClaims(
    @Query('status') status?: ClaimStatus,
    @Query('search') search?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.claimsService.listClaims({ status, search, skip, take });
  }

  @Get(':id')
  @RequirePermissions('claims:read')
  @ApiOperation({ summary: 'Fetch complete multi-modal claim detail dossier' })
  async getClaim(@Param('id') id: string) {
    return this.claimsService.getClaimById(id);
  }

  @Patch(':id')
  @RequirePermissions('claims:update')
  @ApiOperation({ summary: 'Dynamically edit claim details, GPS coordinates, or description' })
  async updateClaim(
    @Param('id') id: string,
    @Body() dto: UpdateClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.updateClaim(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('claims:delete')
  @ApiOperation({ summary: 'Delete a claim dossier' })
  async deleteClaim(@Param('id') id: string) {
    return this.claimsService.deleteClaim(id);
  }

  @Post(':id/transition')
  @RequirePermissions('claims:approve')
  @ApiOperation({ summary: 'Atomically transition claim status using FSM & OCC' })
  async transitionClaim(
    @Param('id') id: string,
    @Body() dto: TransitionClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.transitionClaim(id, dto, user.id);
  }

  @Post(':id/reconcile')
  @RequirePermissions('claims:update')
  @ApiOperation({ summary: 'Run Bill Reconciliation Engine (OCR vs YOLO damage diff)' })
  async runReconciliation(@Param('id') id: string) {
    return this.reconciliationService.reconcileClaimBills(id);
  }

  @Post(':id/reconcile/override')
  @RequirePermissions('claims:override_reconciliation')
  @ApiOperation({ summary: 'Manually override a phantom line item' })
  async overrideReconciliationItem(
    @Param('id') id: string,
    @Body() dto: OverrideReconciliationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.overrideLineItem({
      claimId: id,
      reconciledItemId: dto.reconciledItemId,
      isApproved: dto.isApproved,
      approvedCost: dto.approvedCost,
      reason: dto.reason,
      userId: user.id,
    });
  }

  @Post(':id/actuarial')
  @RequirePermissions('claims:update')
  @ApiOperation({ summary: 'Compute Actuarial Depreciation & Net Settlement Math' })
  async runActuarial(@Param('id') id: string) {
    return this.actuarialService.computeNetPayout(id);
  }

  @Post(':id/fraud-evaluate')
  @RequirePermissions('fraud:read')
  @ApiOperation({ summary: 'Compute Multi-Factor Fraud Scorecard & pgvector similarity' })
  async runFraudEvaluation(@Param('id') id: string) {
    return this.fraudService.evaluateClaimFraud(id);
  }

  @Post(':id/fraud/override')
  @RequirePermissions('fraud:override')
  @ApiOperation({ summary: 'Override a triggered fraud flag with justification' })
  async overrideFraudFlag(
    @Param('id') id: string,
    @Body() dto: OverrideFraudDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fraudService.overrideFraudFlag({
      indicatorId: dto.indicatorId,
      overrideReason: dto.overrideReason,
      userId: user.id,
    });
  }

  @Post(':id/settle')
  @RequirePermissions('claims:settle')
  @ApiOperation({ summary: 'Execute final double-entry balanced ledger settlement' })
  async settleClaim(
    @Param('id') id: string,
    @Body() dto: SettleClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const claim = await this.claimsService.getClaimById(id);
    const payout = claim.actuarialAssessment?.netPayout;
    if (!payout) {
      throw new Error('Claim requires actuarial assessment before settlement.');
    }

    return this.ledgerService.recordClaimSettlementVouchers({
      claimId: id,
      settlementAmount: payout,
      payoutMethod: dto.payoutMethod,
      userId: user.id,
    });
  }

  @Post(':id/stp')
  @RequirePermissions('claims:approve')
  @ApiOperation({ summary: 'Execute autonomous Straight-Through Processing (STP) fast-track' })
  async runStp(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stpService.evaluateAndExecuteStp(id, user.id);
  }

  @Post(':id/assign')
  @RequirePermissions('claims:update')
  @ApiOperation({ summary: 'Assign an adjuster to a claim' })
  async assignAdjuster(
    @Param('id') id: string,
    @Body() dto: AssignAdjusterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.assignAdjuster(id, dto, user.id);
  }

  @Post(':id/lock')
  @RequirePermissions('claims:read')
  @ApiOperation({ summary: 'Acquire or refresh an adjuster presence lock' })
  async acquireLock(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.acquireLock(id, user.id);
  }

  @Delete(':id/lock')
  @RequirePermissions('claims:read')
  @ApiOperation({ summary: 'Release active claim presence lock' })
  async releaseLock(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.releaseLock(id, user.id);
  }
}
