import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission metadata is attached, the route is open or just authenticated
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.headers['x-user-id'];

    if (!userId) {
      throw new ForbiddenException('Unauthenticated request: user context missing.');
    }

    const userPermissions = await this.getUserPermissions(userId);

    // SUPER_ADMIN override or check all required permissions
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
      } catch (e) {
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
