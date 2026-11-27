import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { DatabaseBootstrapService } from '../prisma/database-bootstrap.service';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  UpsertSystemSettingDto,
  CreatePolicyDto,
  UpdatePolicyDto,
  CreatePartCatalogDto,
  UpdatePartCatalogDto,
  CreateDepreciationRuleDto,
  UpdateDepreciationRuleDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  CreateGarageDto,
  UpdateGarageDto,
  CreateDynamicMenuDto,
  UpdateDynamicMenuDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  CreateUserDto,
  UpdateUserDto,
  CreateLedgerAccountDto,
  UpdateLedgerAccountDto,
  ForceClaimStatusDto,
  CreateManualJournalDto,
  UpdateManualJournalDto,
} from './dto/super-admin.dto';

@ApiTags('Super Admin & Dynamic Runtime Master CRUD')
@ApiBearerAuth()
@Controller('api/v1/super-admin')
@UseGuards(DynamicPermissionsGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly dbBootstrap: DatabaseBootstrapService,
  ) {}

  @Post('database/reseed')
  @RequirePermissions('superadmin:access')
  @ApiOperation({ summary: 'Trigger safe 100% idempotent database re-seed across all tables (Super Admin only)' })
  reseedDatabase() {
    return this.dbBootstrap.runIdempotentSeed();
  }

  @Get('bootstrap')
  @ApiOperation({ summary: 'Hydrate entire web/mobile workspace with live PostgreSQL state' })
  getBootstrapSnapshot(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required to bootstrap workspace.');
    }
    return this.superAdminService.getBootstrapSnapshot(user);
  }

  @Post('journals')
  @RequirePermissions('ledger:override')
  createManualJournal(@Body() dto: CreateManualJournalDto) {
    return this.superAdminService.createManualJournal(dto);
  }

  @Patch('journals/:id')
  @RequirePermissions('ledger:override')
  updateManualJournal(@Param('id') id: string, @Body() dto: UpdateManualJournalDto) {
    return this.superAdminService.updateManualJournal(id, dto);
  }

  @Delete('journals/:id')
  @RequirePermissions('ledger:override')
  deleteJournalEntry(@Param('id') id: string) {
    return this.superAdminService.deleteJournalEntry(id);
  }

  @Delete('locks/:claimId')
  @RequirePermissions('presence:unlock')
  releaseLockByClaimId(@Param('claimId') claimId: string) {
    return this.superAdminService.releaseLockByClaimId(claimId);
  }

  @Get('overview')
  @RequirePermissions('superadmin:access')
  @ApiOperation({ summary: 'Super Admin real-time platform telemetry overview' })
  getOverview() {
    return this.superAdminService.getDashboardOverview();
  }

  // ---- System Settings ----
  @Get('settings')
  @RequirePermissions('settings:manage')
  listSettings(@Query('category') category?: string) {
    return this.superAdminService.listSettings(category);
  }

  @Post('settings')
  @RequirePermissions('settings:manage')
  upsertSetting(@Body() dto: UpsertSystemSettingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.superAdminService.upsertSetting(dto, user.email || user.id);
  }

  @Delete('settings/:id')
  @RequirePermissions('settings:manage')
  deleteSetting(@Param('id') id: string) {
    return this.superAdminService.deleteSetting(id);
  }

  // ---- Policies ----
  @Get('policies')
  @RequirePermissions('policies:manage')
  listPolicies() {
    return this.superAdminService.listPolicies();
  }

  @Post('policies')
  @RequirePermissions('policies:manage')
  createPolicy(@Body() dto: CreatePolicyDto) {
    return this.superAdminService.createPolicy(dto);
  }

  @Patch('policies/:id')
  @RequirePermissions('policies:manage')
  updatePolicy(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.superAdminService.updatePolicy(id, dto);
  }

  @Delete('policies/:id')
  @RequirePermissions('policies:manage')
  deletePolicy(@Param('id') id: string) {
    return this.superAdminService.deletePolicy(id);
  }

  // ---- Vehicle Parts Catalog ----
  @Get('parts')
  @RequirePermissions('parts:manage')
  listParts() {
    return this.superAdminService.listParts();
  }

  @Post('parts')
  @RequirePermissions('parts:manage')
  createPart(@Body() dto: CreatePartCatalogDto) {
    return this.superAdminService.createPart(dto);
  }

  @Patch('parts/:id')
  @RequirePermissions('parts:manage')
  updatePart(@Param('id') id: string, @Body() dto: UpdatePartCatalogDto) {
    return this.superAdminService.updatePart(id, dto);
  }

  @Delete('parts/:id')
  @RequirePermissions('parts:manage')
  deletePart(@Param('id') id: string) {
    return this.superAdminService.deletePart(id);
  }

  // ---- Depreciation Rules ----
  @Get('depreciation-rules')
  @RequirePermissions('rules:manage')
  listDepreciationRules() {
    return this.superAdminService.listDepreciationRules();
  }

  @Post('depreciation-rules')
  @RequirePermissions('rules:manage')
  createDepreciationRule(@Body() dto: CreateDepreciationRuleDto) {
    return this.superAdminService.createDepreciationRule(dto);
  }

  @Patch('depreciation-rules/:id')
  @RequirePermissions('rules:manage')
  updateDepreciationRule(@Param('id') id: string, @Body() dto: UpdateDepreciationRuleDto) {
    return this.superAdminService.updateDepreciationRule(id, dto);
  }

  @Delete('depreciation-rules/:id')
  @RequirePermissions('rules:manage')
  deleteDepreciationRule(@Param('id') id: string) {
    return this.superAdminService.deleteDepreciationRule(id);
  }

  // ---- Automation Rules (STP & Fraud) ----
  @Get('automation-rules')
  @RequirePermissions('rules:manage')
  listAutomationRules() {
    return this.superAdminService.listAutomationRules();
  }

  @Post('automation-rules')
  @RequirePermissions('rules:manage')
  createAutomationRule(@Body() dto: CreateAutomationRuleDto) {
    return this.superAdminService.createAutomationRule(dto);
  }

  @Patch('automation-rules/:id')
  @RequirePermissions('rules:manage')
  updateAutomationRule(@Param('id') id: string, @Body() dto: UpdateAutomationRuleDto) {
    return this.superAdminService.updateAutomationRule(id, dto);
  }

  @Delete('automation-rules/:id')
  @RequirePermissions('rules:manage')
  deleteAutomationRule(@Param('id') id: string) {
    return this.superAdminService.deleteAutomationRule(id);
  }

  // ---- Repair Garages ----
  @Get('garages')
  @RequirePermissions('garages:manage')
  listGarages() {
    return this.superAdminService.listGarages();
  }

  @Post('garages')
  @RequirePermissions('garages:manage')
  createGarage(@Body() dto: CreateGarageDto) {
    return this.superAdminService.createGarage(dto);
  }

  @Patch('garages/:id')
  @RequirePermissions('garages:manage')
  updateGarage(@Param('id') id: string, @Body() dto: UpdateGarageDto) {
    return this.superAdminService.updateGarage(id, dto);
  }

  @Delete('garages/:id')
  @RequirePermissions('garages:manage')
  deleteGarage(@Param('id') id: string) {
    return this.superAdminService.deleteGarage(id);
  }

  // ---- Dynamic Navigation Menus ----
  @Get('menus')
  listMenus() {
    return this.superAdminService.listMenus();
  }

  @Post('menus')
  @RequirePermissions('menus:manage')
  createMenu(@Body() dto: CreateDynamicMenuDto) {
    return this.superAdminService.createMenu(dto);
  }

  @Patch('menus/:id')
  @RequirePermissions('menus:manage')
  updateMenu(@Param('id') id: string, @Body() dto: UpdateDynamicMenuDto) {
    return this.superAdminService.updateMenu(id, dto);
  }

  @Delete('menus/:id')
  @RequirePermissions('menus:manage')
  deleteMenu(@Param('id') id: string) {
    return this.superAdminService.deleteMenu(id);
  }

  // ---- Dynamic Permissions ----
  @Post('permissions')
  @RequirePermissions('rbac:roles_create')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.superAdminService.createPermission(dto);
  }

  @Patch('permissions/:id')
  @RequirePermissions('rbac:roles_update')
  updatePermission(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.superAdminService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  @RequirePermissions('rbac:roles_delete')
  deletePermission(@Param('id') id: string) {
    return this.superAdminService.deletePermission(id);
  }

  // ---- Dynamic Users Full CRUD ----
  @Post('users')
  @RequirePermissions('rbac:users_assign')
  createUser(@Body() dto: CreateUserDto) {
    return this.superAdminService.createUser(dto);
  }

  @Patch('users/:id')
  @RequirePermissions('rbac:users_assign')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.superAdminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @RequirePermissions('rbac:users_assign')
  deleteUser(@Param('id') id: string) {
    return this.superAdminService.deleteUser(id);
  }

  // ---- Dynamic Ledger Accounts CRUD ----
  @Get('ledger-accounts')
  @RequirePermissions('ledger:read')
  listLedgerAccounts() {
    return this.superAdminService.listLedgerAccounts();
  }

  @Post('ledger-accounts')
  @RequirePermissions('ledger:override')
  createLedgerAccount(@Body() dto: CreateLedgerAccountDto) {
    return this.superAdminService.createLedgerAccount(dto);
  }

  @Patch('ledger-accounts/:id')
  @RequirePermissions('ledger:override')
  updateLedgerAccount(@Param('id') id: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.superAdminService.updateLedgerAccount(id, dto);
  }

  @Delete('ledger-accounts/:id')
  @RequirePermissions('ledger:override')
  deleteLedgerAccount(@Param('id') id: string) {
    return this.superAdminService.deleteLedgerAccount(id);
  }

  // ---- Super Admin Emergency Claim Force Status Override ----
  @Post('claims/:id/force-status')
  @RequirePermissions('superadmin:access')
  forceClaimStatus(
    @Param('id') id: string,
    @Body() dto: ForceClaimStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.superAdminService.forceUpdateClaimStatus(id, dto, user.id, user.email);
  }
}
