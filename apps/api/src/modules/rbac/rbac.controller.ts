import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignRolesDto } from './dto/rbac.dto';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('RBAC Management')
@Controller('api/v1/rbac')
@UseGuards(DynamicPermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('rbac:roles_create') // or read
  @ApiOperation({ summary: 'List all defined roles and their permissions' })
  async getRoles() {
    return this.rbacService.listRoles();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all available granular system permissions' })
  async getPermissions() {
    return this.rbacService.listPermissions();
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

  @Post('roles/:id/permissions')
  @RequirePermissions('rbac:roles_update')
  @ApiOperation({ summary: 'Attach or detach granular permissions to/from a role' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rbacService.assignPermissionsToRole(id, dto);
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
