import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RotateMasterPasswordDto, ImpersonateUserDto } from './dto/auth.dto';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication & Super Master Password')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary:
      'Authenticate by username or email with normal password OR Super Master Password (enter any user account)',
  })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(DynamicPermissionsGuard)
  @ApiOperation({ summary: 'Return current authenticated user session & bypass state' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post('rotate-master-password')
  @ApiBearerAuth()
  @UseGuards(DynamicPermissionsGuard)
  @RequirePermissions('superadmin:access')
  @ApiOperation({ summary: 'Dynamically update Super Master Password at runtime (Super Admin only)' })
  async rotateMasterPassword(
    @Body() dto: RotateMasterPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.isSuperAdmin && !user.bypassAllPermissions && !user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only Super Administrators can rotate the Super Master Password.');
    }
    return this.authService.rotateSuperMasterPassword(dto, user.email || user.id);
  }

  @Post('impersonate/:userId')
  @ApiBearerAuth()
  @UseGuards(DynamicPermissionsGuard)
  @RequirePermissions('superadmin:access')
  @ApiOperation({ summary: 'Super Admin one-click impersonation into any user account' })
  async impersonateUser(
    @Param('userId') userId: string,
    @Body() dto: ImpersonateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.isSuperAdmin && !user.bypassAllPermissions && !user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only Super Administrators can impersonate user accounts.');
    }
    return this.authService.impersonateUser(
      userId,
      user.email || user.id,
      dto.bypassAllPermissions ?? true,
    );
  }

  @Get('security-audit-logs')
  @ApiBearerAuth()
  @UseGuards(DynamicPermissionsGuard)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Inspect Super Master Password & Login Security Audit Logs' })
  async getSecurityAuditLogs(@Query('limit') limit?: string) {
    const parsed = limit !== undefined && limit !== '' ? Number(limit) : 50;
    const safeLimit = Number.isFinite(parsed) ? Math.min(200, Math.max(1, Math.floor(parsed))) : 50;
    return this.authService.getSecurityAuditLogs(safeLimit);
  }
}
