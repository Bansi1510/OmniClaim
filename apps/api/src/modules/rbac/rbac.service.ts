import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignRolesDto } from './dto/rbac.dto';

export interface ModulePermissionsGroup {
  module: string;
  displayName: string;
  description: string;
  permissions: Array<{
    id: string;
    slug: string;
    action: string;
    description: string;
  }>;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * List all roles with attached permissions and user counts.
   */
  async listRoles(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const roles = await this.prisma.role.findMany({
      where,
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

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissionsCount: role.permissions.length,
      permissionSlugs: role.permissions.map((p) => p.permission.slug),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  /**
   * Get single role details with complete permissions list.
   */
  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) throw new NotFoundException(`Role ${id} not found.`);

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissionSlugs: role.permissions.map((p) => p.permission.slug),
      permissionIds: role.permissions.map((p) => p.permissionId),
    };
  }

  /**
   * Returns permissions grouped hierarchically by Module (matching college erp accordion format).
   */
  async listGroupedPermissions(): Promise<ModulePermissionsGroup[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
    });

    const moduleDisplayNames: Record<string, { name: string; desc: string }> = {
      CLAIMS: {
        name: 'Claims Lifecycle Management',
        desc: 'Intake, triage, review, approval, dispute rejection, and financial settlement',
      },
      RECONCILIATION: {
        name: 'Bill Reconciliation & Phantom Diff Engine',
        desc: 'OCR invoice line item diffing against AI detected physical damage and manual overrides',
      },
      ACTUARIAL: {
        name: 'Actuarial Math & Depreciation Engine',
        desc: 'Statutory depreciation schedules, deductibles, salvage value, and net payout calculation',
      },
      FRAUD: {
        name: 'Fraud Detection & SIU Special Investigation Unit',
        desc: 'Haversine GPS checks, anti-mocking, and pgvector cosine vector similarity audits',
      },
      LEDGER: {
        name: 'Financial Accounting & Balanced Ledger',
        desc: 'Double-entry accounting journal posting, accrual/payout vouchers, and zero-sum audits',
      },
      STP: {
        name: 'Straight-Through Processing (STP)',
        desc: 'Autonomous fast-track auto-approval for low-risk minor claims under $750',
      },
      RBAC: {
        name: 'Dynamic Role & Access Rights Management',
        desc: 'Runtime creation of custom roles, assignment of module permissions, and user role binding',
      },
      AUDIT: {
        name: 'Audit Trail & Collaborative Locks',
        desc: 'Immutable time-travel field modification history and active adjuster presence leases',
      },
    };

    const grouped = new Map<string, ModulePermissionsGroup>();

    for (const p of permissions) {
      if (!grouped.has(p.module)) {
        const meta = moduleDisplayNames[p.module] || {
          name: p.module,
          desc: `${p.module} operations`,
        };
        grouped.set(p.module, {
          module: p.module,
          displayName: meta.name,
          description: meta.desc,
          permissions: [],
        });
      }

      // Extract action from slug (e.g., "claims:approve" -> action "approve")
      const parts = p.slug.split(':');
      const action = parts.length > 1 ? parts[1].replace('_', ' ') : 'access';

      grouped.get(p.module)!.permissions.push({
        id: p.id,
        slug: p.slug,
        action: action.toUpperCase(),
        description: p.description,
      });
    }

    return Array.from(grouped.values());
  }

  /**
   * Create a new custom role.
   */
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

  /**
   * Update role details.
   */
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

    await this.redis.deletePattern('user_permissions:*');
    return updated;
  }

  /**
   * Delete role (system roles protected).
   */
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

  /**
   * Assign or replace rights/permissions for a role.
   * Matches college erp POST /permission/:roleId
   */
  async assignPermissionsToRole(roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found.`);

    // 1. Resolve permissions from slugs or ids
    const permissions = await this.prisma.permission.findMany({
      where: {
        OR: [
          { slug: { in: dto.permissionSlugs } },
          { id: { in: dto.permissionSlugs } },
        ],
      },
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

    return {
      success: true,
      roleId,
      assignedCount: permissions.length,
      permissions: permissions.map((p) => p.slug),
    };
  }

  /**
   * List users with their assigned roles.
   */
  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        roles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      roles: u.roles.map((r) => ({
        id: r.role.id,
        name: r.role.name,
        slug: r.role.slug,
        isSystem: r.role.isSystem,
      })),
      createdAt: u.createdAt,
    }));
  }

  /**
   * Assign roles to a user.
   */
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

    await this.redis.del(`user_permissions:${userId}`);
    this.logger.log(`Roles updated for user ${user.email}. Cache invalidated.`);

    return { success: true, userId, assignedRoles: dto.roleIds.length };
  }

  /**
   * Get permissions list for current user token/session.
   * Matches college erp GET /permission
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) return [];

    const isSuperAdmin = user.roles.some((r) => r.role.slug === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      const allPerms = await this.prisma.permission.findMany({ select: { slug: true } });
      return allPerms.map((p) => p.slug);
    }

    const set = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        set.add(rp.permission.slug);
      }
    }

    return Array.from(set);
  }
}
