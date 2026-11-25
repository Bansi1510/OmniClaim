import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, TransitionClaimDto, AssignAdjusterDto } from './dto/claims.dto';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ClaimStatus } from '@omniclaim/database';

@ApiTags('Claims Management')
@Controller('api/v1/claims')
@UseGuards(DynamicPermissionsGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

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

  @Post(':id/transition')
  @RequirePermissions('claims:approve') // Guard validates target permission dynamically
  @ApiOperation({ summary: 'Atomically transition claim status using FSM & OCC' })
  async transitionClaim(
    @Param('id') id: string,
    @Body() dto: TransitionClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claimsService.transitionClaim(id, dto, user.id);
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
