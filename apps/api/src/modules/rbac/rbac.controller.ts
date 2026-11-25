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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignRolesDto } from './dto/rbac.dto';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('RBAC Management (Exact College ERP Contract)')
@Controller('api/v1/rbac')
@UseGuards(DynamicPermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('rbac:roles_create')
  @ApiOperation({ summary: 'List all roles with user counts and permission counts' })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getRoles(@Query('search') search?: string) {
    return this.rbacService.listRoles(search);
  }

  @Get('roles/:id')
  @RequirePermissions('rbac:roles_create')
  @ApiOperation({ summary: 'Get single role details and its assigned permissions' })
  async getRole(@Param('id') id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Post('roles')
  @RequirePermissions('rbac:roles_create')
  @ApiOperation({ summary: 'Create a new custom runtime role' })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermissions('rbac:roles_update')
  @ApiOperation({ summary: 'Update custom role name or description' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('rbac:roles_delete')
  @ApiOperation({ summary: 'Delete a non-system custom role' })
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all granular system permissions grouped by Module (for Accordion Rights view)' })
  async getGroupedPermissions() {
    return this.rbacService.listGroupedPermissions();
  }

  @Get('roles/:id/permissions')
  @RequirePermissions('rbac:roles_update')
  @ApiOperation({ summary: 'Get assigned permissions for a given role (college erp GET /permission/:roleId)' })
  async getRolePermissions(@Param('id') id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Post('roles/:id/permissions')
  @RequirePermissions('rbac:roles_update')
  @ApiOperation({ summary: 'Assign / replace rights for a role (college erp POST /permission/:roleId)' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rbacService.assignPermissionsToRole(id, dto);
  }

  @Get('user-permissions')
  @ApiOperation({ summary: 'Get current logged-in user permissions array (college erp GET /permission)' })
  async getCurrentUserPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.rbacService.getUserPermissions(user.id);
  }

  @Get('users')
  @RequirePermissions('rbac:users_assign')
  @ApiOperation({ summary: 'List users with their assigned roles' })
  async listUsers() {
    return this.rbacService.listUsers();
  }

  @Post('users/:id/roles')
  @RequirePermissions('rbac:users_assign')
  @ApiOperation({ summary: 'Assign or revoke roles from a user' })
  async assignUserRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.rbacService.assignRolesToUser(id, dto);
  }
}
