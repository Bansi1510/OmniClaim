import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Global HTTP Activity & Change Audit Logs')
@ApiBearerAuth()
@Controller('api/v1/audit')
@UseGuards(DynamicPermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary: 'Query all tracked HTTP requests (GET/POST/PUT/PATCH/DELETE) with actor & old->new field diffs',
  })
  @ApiQuery({ name: 'method', required: false, example: 'PATCH' })
  @ApiQuery({ name: 'module', required: false, example: 'POLICIES' })
  @ApiQuery({ name: 'username', required: false, example: 'superadmin' })
  @ApiQuery({ name: 'entityType', required: false, example: 'Policy' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'statusGroup', required: false, enum: ['ALL', 'SUCCESS', 'ERROR'] })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getActivityLogs(
    @Query('method') method?: string,
    @Query('module') module?: string,
    @Query('username') username?: string,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
    @Query('statusGroup') statusGroup?: 'ALL' | 'SUCCESS' | 'ERROR',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page !== undefined && page !== '' ? Number(page) : 1;
    const parsedLimit = limit !== undefined && limit !== '' ? Number(limit) : 50;
    return this.auditService.queryLogs({
      method,
      module,
      username,
      entityType,
      search,
      statusGroup,
      fromDate,
      toDate,
      page: Number.isFinite(parsedPage) ? parsedPage : 1,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 50,
    });
  }

  @Get('stats')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Real-time HTTP audit breakdown by method, module, errors, and average latency' })
  getAuditStats() {
    return this.auditService.getStats();
  }

  @Get('logs/:id')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Inspect complete detail and old->new JSON diff of a single audit log entry' })
  getActivityLogDetail(@Param('id') id: string) {
    return this.auditService.getLogById(id);
  }

  @Delete('logs/:id')
  @RequirePermissions('superadmin:access')
  @ApiOperation({ summary: 'Delete a specific audit log entry (Super Admin only)' })
  deleteActivityLog(@Param('id') id: string) {
    return this.auditService.deleteLog(id);
  }
}
