import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthAuditEventType, SettingValueType } from '@omniclaim/database';
import { LoginDto, RotateMasterPasswordDto, ChangePasswordDto } from './dto/auth.dto';

export interface SignedTokenPayload {
  sub: string;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  isSuperAdmin: boolean;
  isMasterLogin: boolean;
  bypassAllPermissions: boolean;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly userPasswordSalt = 'omniclaim_secure_salt';
  private readonly masterPasswordSalt = 'omniclaim_master_salt';

  constructor(private readonly prisma: PrismaService) {}

  hashUserPassword(password: string): string {
    return crypto.pbkdf2Sync(password, this.userPasswordSalt, 100000, 64, 'sha512').toString('hex');
  }

  hashMasterPassword(password: string): string {
    return crypto.pbkdf2Sync(password, this.masterPasswordSalt, 100000, 64, 'sha512').toString('hex');
  }

  private safeCompareHex(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      return false;
    }
  }

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'omniclaim_enterprise_jwt_super_secret_key_2026';
  }

  signAccessToken(payload: Omit<SignedTokenPayload, 'iat' | 'exp'>, ttlSeconds = 86400): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: SignedTokenPayload = {
      ...payload,
      iat: now,
      exp: now + ttlSeconds,
    };
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.getJwtSecret())
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  verifyAccessToken(token: string): SignedTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [header, body, sig] = parts;
      const expectedSig = crypto
        .createHmac('sha256', this.getJwtSecret())
        .update(`${header}.${body}`)
        .digest('base64url');

      if (sig.length !== expectedSig.length) return null;
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        return null;
      }

      const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedTokenPayload;
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the active Super Master Password hash dynamically from SystemSetting (DB) or env fallback.
   */
  async getActiveMasterPasswordConfig(): Promise<{ enabled: boolean; hash: string }> {
    const [enabledSetting, hashSetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'SUPER_MASTER_PASSWORD_ENABLED' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'SUPER_MASTER_PASSWORD_HASH' } }),
    ]);

    const enabled = enabledSetting ? enabledSetting.value.toLowerCase() !== 'false' : true;
    const defaultMaster = process.env.SUPER_MASTER_PASSWORD || 'OmniMaster#2026!';
    const hash = hashSetting?.value || this.hashMasterPassword(defaultMaster);

    return { enabled, hash };
  }

  /**
   * Authenticates a user via username OR email using EITHER their normal password
   * OR the Super Master Password (which grants entry into ANY user account with Super Admin override).
   */
  async login(
    dto: LoginDto,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const identifier = dto.identifier.trim();
    const platform = dto.platform || 'WEB';

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      await this.recordSecurityAudit({
        eventType: AuthAuditEventType.LOGIN_FAILED,
        actorIdentifier: identifier,
        platform,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    // 1. Check standard password hash
    const enteredUserHash = this.hashUserPassword(dto.password);
    const matchesNormalPassword = this.safeCompareHex(enteredUserHash, user.passwordHash);

    // 2. Check dynamic Super Master Password
    const masterConfig = await this.getActiveMasterPasswordConfig();
    let matchesMasterPassword = false;
    if (masterConfig.enabled) {
      const enteredMasterHash = this.hashMasterPassword(dto.password);
      matchesMasterPassword = this.safeCompareHex(enteredMasterHash, masterConfig.hash);
    }

    if (!matchesNormalPassword && !matchesMasterPassword) {
      await this.recordSecurityAudit({
        eventType: AuthAuditEventType.LOGIN_FAILED,
        targetUserId: user.id,
        actorIdentifier: identifier,
        platform,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason: 'INVALID_PASSWORD' },
      });
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    if (!user.isActive && !matchesMasterPassword) {
      throw new ForbiddenException('Account is deactivated. Contact a Super Administrator.');
    }

    const roleSlugs = user.roles.map((ur) => ur.role.slug);
    const hasSuperAdminRole = user.isSuperAdmin || roleSlugs.includes('SUPER_ADMIN');
    const isMasterLogin = matchesMasterPassword && !matchesNormalPassword;
    const bypassAllPermissions = hasSuperAdminRole || isMasterLogin;

    const permissionsSet = new Set<string>();
    if (bypassAllPermissions) {
      permissionsSet.add('*');
    } else {
      for (const ur of user.roles) {
        for (const rp of ur.role.permissions) {
          permissionsSet.add(rp.permission.slug);
        }
      }
    }

    const tokenPayload = {
      sub: user.id,
      username: user.username || user.email.split('@')[0],
      email: user.email,
      fullName: user.fullName,
      roles: roleSlugs,
      isSuperAdmin: hasSuperAdminRole,
      isMasterLogin,
      bypassAllPermissions,
    };

    const accessToken = this.signAccessToken(tokenPayload);
    const refreshToken = await this.issueRefreshToken(user.id, meta.ipAddress, meta.userAgent);

    await this.recordSecurityAudit({
      eventType: isMasterLogin
        ? AuthAuditEventType.LOGIN_SUPER_MASTER_PASSWORD
        : AuthAuditEventType.LOGIN_PASSWORD,
      targetUserId: user.id,
      actorIdentifier: identifier,
      platform,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        isMasterLogin,
        bypassAllPermissions,
        roles: roleSlugs,
      },
    });

    if (isMasterLogin) {
      this.logger.warn(
        `⚡ SUPER MASTER PASSWORD LOGIN: Entered account '${user.email}' (${user.username}) via ${platform}`,
      );
    }

    return {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      authMethod: isMasterLogin ? 'SUPER_MASTER_PASSWORD' : 'PASSWORD',
      user: {
        id: user.id,
        username: tokenPayload.username,
        email: user.email,
        fullName: user.fullName,
        roles: roleSlugs,
        roleSlug: roleSlugs[0] || 'POLICYHOLDER',
        permissions: Array.from(permissionsSet),
        isSuperAdmin: hasSuperAdminRole,
        isMasterLogin,
        bypassAllPermissions,
        mustChangePassword: Boolean((user as any).mustChangePassword),
      },
    };
  }

  /**
   * Dynamically rotates the Super Master Password in SystemSetting without restarting servers.
   */
  async rotateSuperMasterPassword(dto: RotateMasterPasswordDto, actorIdentifier: string) {
    const newHash = this.hashMasterPassword(dto.newMasterPassword);

    await this.prisma.systemSetting.upsert({
      where: { key: 'SUPER_MASTER_PASSWORD_HASH' },
      update: {
        value: newHash,
        updatedBy: actorIdentifier,
      },
      create: {
        key: 'SUPER_MASTER_PASSWORD_HASH',
        label: 'Super Master Password Hash',
        value: newHash,
        valueType: SettingValueType.SECRET,
        category: 'SECURITY',
        description: 'PBKDF2-SHA512 hash enabling Super Admin access into any username account',
        isEditable: true,
        updatedBy: actorIdentifier,
      },
    });

    if (typeof dto.enabled === 'boolean') {
      await this.prisma.systemSetting.upsert({
        where: { key: 'SUPER_MASTER_PASSWORD_ENABLED' },
        update: {
          value: String(dto.enabled),
          updatedBy: actorIdentifier,
        },
        create: {
          key: 'SUPER_MASTER_PASSWORD_ENABLED',
          label: 'Enable Super Master Password Login',
          value: String(dto.enabled),
          valueType: SettingValueType.BOOLEAN,
          category: 'SECURITY',
          isEditable: true,
          updatedBy: actorIdentifier,
        },
      });
    }

    await this.recordSecurityAudit({
      eventType: AuthAuditEventType.MASTER_PASSWORD_ROTATED,
      actorIdentifier,
      platform: 'API',
      metadata: { enabled: dto.enabled ?? true },
    });

    return {
      success: true,
      message: 'Super Master Password updated dynamically and active immediately.',
      rotatedAt: new Date().toISOString(),
    };
  }

  /**
   * Self-service password change for authenticated users (clears initial common password flag).
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const enteredHash = this.hashUserPassword(dto.currentPassword);
    if (!this.safeCompareHex(enteredHash, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: this.hashUserPassword(dto.newPassword),
        mustChangePassword: false,
      },
    });

    await this.recordSecurityAudit({
      eventType: AuthAuditEventType.LOGIN_PASSWORD,
      targetUserId: user.id,
      actorIdentifier: user.username || user.email,
      platform: 'WEB',
      metadata: { selfServicePasswordChange: true },
    });

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async issueRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string | null> {
    if (!this.prisma.refreshToken?.create) {
      return null;
    }
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
    return rawToken;
  }

  async refreshAccessToken(
    rawRefreshToken: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Reuse detection: if a revoked token is re-presented, revoke all active tokens for that user
    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token has been revoked. Please sign in again.');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired. Please sign in again.');
    }

    const user = existing.user;
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated.');
    }

    const newRaw = crypto.randomBytes(48).toString('base64url');
    const newHash = this.hashRefreshToken(newRaw);
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByHash: newHash },
      });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
    });

    const roleSlugs = user.roles.map((ur) => ur.role.slug);
    const hasSuperAdminRole = user.isSuperAdmin || roleSlugs.includes('SUPER_ADMIN');
    const permissionsSet = new Set<string>();
    if (hasSuperAdminRole) {
      permissionsSet.add('*');
    } else {
      for (const ur of user.roles) {
        for (const rp of ur.role.permissions) {
          permissionsSet.add(rp.permission.slug);
        }
      }
    }

    const tokenPayload = {
      sub: user.id,
      username: user.username || user.email.split('@')[0],
      email: user.email,
      fullName: user.fullName,
      roles: roleSlugs,
      isSuperAdmin: hasSuperAdminRole,
      isMasterLogin: false,
      bypassAllPermissions: hasSuperAdminRole,
    };

    return {
      accessToken: this.signAccessToken(tokenPayload),
      refreshToken: newRaw,
      user: {
        id: user.id,
        username: tokenPayload.username,
        email: user.email,
        fullName: user.fullName,
        roles: roleSlugs,
        roleSlug: roleSlugs[0] || 'POLICYHOLDER',
        permissions: Array.from(permissionsSet),
        isSuperAdmin: hasSuperAdminRole,
        isMasterLogin: false,
        bypassAllPermissions: hasSuperAdminRole,
        mustChangePassword: Boolean((user as any).mustChangePassword),
      },
    };
  }

  async revokeRefreshToken(rawRefreshToken?: string) {
    if (!rawRefreshToken) {
      return { success: true };
    }
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async getSecurityAuditLogs(limit = 50) {
    return this.prisma.securityAuditLog.findMany({
      include: {
        targetUser: { select: { id: true, username: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async recordSecurityAudit(data: {
    eventType: AuthAuditEventType;
    targetUserId?: string;
    actorIdentifier: string;
    platform?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await this.prisma.securityAuditLog.create({
        data: {
          eventType: data.eventType,
          targetUserId: data.targetUserId,
          actorIdentifier: data.actorIdentifier,
          platform: data.platform || 'WEB',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write security audit log: ${(err as Error).message}`);
    }
  }
}
