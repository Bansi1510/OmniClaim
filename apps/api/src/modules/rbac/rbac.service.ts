import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignRolesDto } from './dto/rbac.dto';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
    });
  }

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { OR: [{ slug: dto.slug }, { name: dto.name }] },
    });
    if (existing) {
      throw new BadRequestException(`Role with slug '${dto.slug}' or name '${dto.name}' already exists.`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        slug: dto.slug.toUpperCase(),
        description: dto.description,
        isSystem: false,
      },
    });

    if (dto.permissionSlugs && dto.permissionSlugs.length > 0) {
      await this.assignPermissionsToRole(role.id, { permissionSlugs: dto.permissionSlugs });
    }

    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found.`);

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description ? { description: dto.description } : {}),
      },
    });

    // Invalidate all users caches because role definition changed
    await this.redis.deletePattern('user_permissions:*');
    return updated;
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found.`);
    if (role.isSystem) {
      throw new BadRequestException(`System role '${role.name}' cannot be deleted.`);
    }

    await this.prisma.role.delete({ where: { id } });
    await this.redis.deletePattern('user_permissions:*');
    return { success: true, deletedRoleId: id };
  }

  async assignPermissionsToRole(roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found.`);

    // 1. Resolve permissions from slugs
    const permissions = await this.prisma.permission.findMany({
      where: { slug: { in: dto.permissionSlugs } },
    });

    // 2. Transactionally replace permissions for this role
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }
    });

    // 3. Invalidate Redis permissions cache for all users holding this role
    await this.redis.deletePattern('user_permissions:*');
    this.logger.log(`Permissions updated for role ${role.slug}. Permission cache invalidated.`);

    return { success: true, assignedCount: permissions.length };
  }

  async assignRolesToUser(userId: string, dto: AssignRolesDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found.`);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });

      if (dto.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId,
            roleId,
          })),
        });
      }
    });

    // Invalidate specific user cache
    await this.redis.del(`user_permissions:${userId}`);
    this.logger.log(`Roles updated for user ${user.email}. Cache invalidated.`);

    return { success: true, assignedRoles: dto.roleIds.length };
  }
}
