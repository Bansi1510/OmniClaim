import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RedisService } from '../../modules/redis/redis.service';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class DynamicPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(DynamicPermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private decodeBearerToken(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
      const token = authHeader.slice(7).trim();
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [header, body, sig] = parts;
      const secret = process.env.JWT_SECRET || 'omniclaim_enterprise_jwt_super_secret_key_2026';
      const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return null;
      }
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Hydrate request.user from Bearer token if present
    const tokenPayload = this.decodeBearerToken(request.headers['authorization']);
    if (tokenPayload) {
      request.user = {
        id: tokenPayload.sub,
        username: tokenPayload.username,
        email: tokenPayload.email,
        fullName: tokenPayload.fullName,
        roles: tokenPayload.roles || [],
        isSuperAdmin: Boolean(tokenPayload.isSuperAdmin),
        isMasterLogin: Boolean(tokenPayload.isMasterLogin),
        bypassAllPermissions: Boolean(tokenPayload.bypassAllPermissions),
      };
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission metadata is attached, route is open or just authenticated
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 1. SUPER ADMIN & SUPER MASTER PASSWORD UNCONDITIONAL BYPASS
    // Skips ALL permission checks so Super Admin & Master Password sessions can access everything
    if (
      request.user?.isSuperAdmin === true ||
      request.user?.bypassAllPermissions === true ||
      request.user?.isMasterLogin === true ||
      request.user?.roles?.includes('SUPER_ADMIN')
    ) {
      if (request.user) {
        request.user.permissions = ['*'];
      }
      return true;
    }

    const userId = request.user?.id || request.headers['x-user-id'];

    if (!userId) {
      throw new ForbiddenException('Unauthenticated request: user context missing.');
    }

    const userPermissions = await this.getUserPermissions(userId);

    if (!request.user) {
      const dbUser = await this.prisma.user
        .findUnique({
          where: { id: userId },
          include: { roles: { include: { role: true } } },
        })
        .catch(() => null);
      request.user = {
        id: userId,
        username: dbUser?.username || undefined,
        email: dbUser?.email || (request.headers['x-user-email'] as string) || '',
        fullName: dbUser?.fullName || undefined,
        roles: dbUser?.roles?.map((ur) => ur.role.slug) || [],
        isSuperAdmin: Boolean(dbUser?.isSuperAdmin),
        isMasterLogin: false,
        bypassAllPermissions: false,
        permissions: Array.from(userPermissions),
      };
    } else {
      request.user.permissions = Array.from(userPermissions);
    }

    // Wildcard '*' or SUPER_ADMIN marker skips all permission requirements
    if (userPermissions.has('*') || userPermissions.has('SUPER_ADMIN')) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasAll) {
      this.logger.warn(
        `User ${userId} denied access. Required: [${requiredPermissions.join(', ')}], Possessed: [${Array.from(userPermissions).join(', ')}]`,
      );
      throw new ForbiddenException(
        `Insufficient privileges: missing required permissions [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = `user_permissions:${userId}`;

    // 1. Check Redis Cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as string[];
        return new Set(parsed);
      } catch {
        // Fall through to DB on cache parse error
      }
    }

    // 2. Query Database across User -> UserRole -> Role -> RolePermission -> Permission
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) {
      return new Set<string>();
    }

    // Super Admin flag or SUPER_ADMIN role grants unconditional wildcard bypass
    if (
      userWithRoles.isSuperAdmin ||
      userWithRoles.roles.some((ur) => ur.role.slug === 'SUPER_ADMIN')
    ) {
      const wildcard = new Set<string>(['*', 'SUPER_ADMIN']);
      await this.redis.set(cacheKey, JSON.stringify(Array.from(wildcard)), 3600);
      return wildcard;
    }

    const permissionSet = new Set<string>();
    for (const ur of userWithRoles.roles) {
      for (const rp of ur.role.permissions) {
        permissionSet.add(rp.permission.slug);
      }
    }

    // 3. Populate Redis Cache with 3600 seconds TTL
    const arrayPermissions = Array.from(permissionSet);
    await this.redis.set(cacheKey, JSON.stringify(arrayPermissions), 3600);

    return permissionSet;
  }
}
