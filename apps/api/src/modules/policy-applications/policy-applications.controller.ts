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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PolicyApplicationsService } from './policy-applications.service';
import { PolicyApplicationStatus } from '@omniclaim/database';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UploadApplicationDocDto,
  UnderwritingDecisionDto,
  PayAndIssueDto,
  CreateEndorsementDto,
  CancelPolicyDto,
  UpsertProductDto,
  UpsertCategoryDto,
  UpsertVehicleTypeDto,
} from './dto/policy-application.dto';

@ApiTags('Policy Catalog, Applications, Underwriting & Issuance')
@ApiBearerAuth()
@Controller('api/v1')
@UseGuards(DynamicPermissionsGuard)
export class PolicyApplicationsController {
  constructor(private readonly service: PolicyApplicationsService) {}

  // ==========================================
  // CATALOG ENDPOINTS
  // ==========================================

  @Get('policy-catalog/categories')
  @RequirePermissions('policies:read')
  @ApiOperation({ summary: 'List active insurance policy categories and products' })
  listCategories() {
    return this.service.listCategories();
  }

  @Post('policy-catalog/categories')
  @RequirePermissions('products:manage')
  @ApiOperation({ summary: 'Create or update an insurance policy category' })
  upsertCategory(@Body() dto: UpsertCategoryDto) {
    return this.service.upsertCategory(dto);
  }

  @Delete('policy-catalog/categories/:id')
  @RequirePermissions('products:manage')
  @ApiOperation({ summary: 'Delete or deactivate a policy category' })
  deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }

  @Get('policy-catalog/vehicle-types')
  @RequirePermissions('policies:read')
  @ApiQuery({ name: 'categoryCode', required: false })
  @ApiOperation({ summary: 'List active configurable vehicle types' })
  listVehicleTypes(@Query('categoryCode') categoryCode?: string) {
    return this.service.listVehicleTypes(categoryCode);
  }

  @Post('policy-catalog/vehicle-types')
  @RequirePermissions('products:manage')
  @ApiOperation({ summary: 'Create or update a configurable vehicle type under a policy category' })
  upsertVehicleType(@Body() dto: UpsertVehicleTypeDto) {
    return this.service.upsertVehicleType(dto);
  }

  @Delete('policy-catalog/vehicle-types/:id')
  @RequirePermissions('products:manage')
  @ApiOperation({ summary: 'Delete or deactivate a vehicle type' })
  deleteVehicleType(@Param('id') id: string) {
    return this.service.deleteVehicleType(id);
  }

  @Get('policy-catalog/products')
  @RequirePermissions('policies:read')
  @ApiQuery({ name: 'categoryCode', required: false })
  @ApiQuery({ name: 'vehicleTypeId', required: false })
  @ApiOperation({ summary: 'List active insurance policy products' })
  listProducts(
    @Query('categoryCode') categoryCode?: string,
    @Query('vehicleTypeId') vehicleTypeId?: string,
  ) {
    return this.service.listProducts(categoryCode, vehicleTypeId);
  }

  @Post('policy-catalog/products')
  @RequirePermissions('products:manage')
  @ApiOperation({ summary: 'Create or version-bump a policy product' })
  upsertProduct(@Body() dto: UpsertProductDto) {
    return this.service.upsertProduct(dto);
  }

  @Delete('policy-catalog/products/:id')
  @RequirePermissions('products:manage')
  @ApiOperation({ summary: 'Delete or deactivate a policy product' })
  deleteProduct(@Param('id') id: string) {
    return this.service.deleteProduct(id);
  }

  // ==========================================
  // POLICY APPLICATION WORKFLOW
  // ==========================================

  @Get('policy-applications')
  @RequirePermissions('policies:read')
  @ApiQuery({ name: 'status', enum: PolicyApplicationStatus, required: false })
  @ApiOperation({ summary: 'List policy applications scoped to current user or all for underwriters' })
  listApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: PolicyApplicationStatus,
  ) {
    return this.service.listApplications(user, status);
  }

  @Get('policy-applications/:id')
  @RequirePermissions('policies:read')
  @ApiOperation({ summary: 'Fetch complete policy application dossier with documents, quotes & reviews' })
  getApplication(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getApplication(id, user);
  }

  @Post('policy-applications')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Create a new draft policy application' })
  createDraft(@Body() dto: CreateApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDraft(dto, user.id);
  }

  @Patch('policy-applications/:id')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Update draft or docs-required policy application' })
  updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateDraft(id, dto, user);
  }

  @Post('policy-applications/:id/documents')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Attach versioned supporting document metadata to application' })
  uploadDocument(
    @Param('id') id: string,
    @Body() dto: UploadApplicationDocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.uploadDocument(id, dto, user);
  }

  @Post('policy-applications/:id/submit')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Submit draft application for underwriting or instant auto-quote' })
  submitApplication(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submitApplication(id, user);
  }

  @Post('policy-applications/:id/quote')
  @RequirePermissions('underwriting:review')
  @ApiOperation({ summary: 'Generate a binding decimal-safe insurance quote' })
  generateQuote(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generateQuote(id, user);
  }

  @Post('policy-applications/:id/quotes/:quoteId/accept')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Accept generated insurance quote before payment' })
  acceptQuote(
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.acceptQuote(id, quoteId, user);
  }

  @Post('policy-applications/:id/quotes/:quoteId/reject')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Reject generated insurance quote' })
  rejectQuote(
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.rejectQuote(id, quoteId, user);
  }

  @Post('policy-applications/:id/underwriting')
  @RequirePermissions('underwriting:approve')
  @ApiOperation({ summary: 'Submit underwriting decision (APPROVED -> auto-quote, DECLINED -> REJECTED, NEEDS_INFO -> DOCS_REQUIRED)' })
  submitUnderwritingDecision(
    @Param('id') id: string,
    @Body() dto: UnderwritingDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submitUnderwritingDecision(id, dto, user.id);
  }

  @Post('policy-applications/:id/pay-and-issue')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Execute idempotent premium payment and instant Policy issuance' })
  payAndIssuePolicy(
    @Param('id') id: string,
    @Body() dto: PayAndIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.payAndIssuePolicy(id, dto, user);
  }

  // ==========================================
  // ISSUED POLICY LIFECYCLE ENDPOINTS
  // ==========================================

  @Get('policies')
  @RequirePermissions('policies:read')
  @ApiOperation({ summary: 'List issued policies scoped by customer ownership or staff role' })
  listPolicies(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listPolicies(user);
  }

  @Post('policies/:id/endorsements')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Create policy endorsement updating coverage, deductible, or risk metadata' })
  createEndorsement(
    @Param('id') id: string,
    @Body() dto: CreateEndorsementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createEndorsement(id, dto, user);
  }

  @Post('policies/:id/renew')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Renew policy term for another 12 months' })
  renewPolicy(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.renewPolicy(id, user);
  }

  @Post('policies/:id/cancel')
  @RequirePermissions('policies:apply')
  @ApiOperation({ summary: 'Cancel an active policy with audit reason' })
  cancelPolicy(
    @Param('id') id: string,
    @Body() dto: CancelPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelPolicy(id, dto, user);
  }
}
