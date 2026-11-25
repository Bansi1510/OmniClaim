import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignRolesDto } from './dto/rbac.dto';

export interface MenuItem {
  id: string;
  title: string;
  navLink?: string;
  icon?: string;
  requiredPermission?: string;
  badgeName?: string;
  badgeColor?: string;
  children?: MenuItem[];
}

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

  // Full enterprise master menu navigation tree matching college erp module_master menu
  private readonly masterNavigationMenu: MenuItem[] = [
    {
      id: 'claims-management',
      title: 'Claims Operations',
      icon: 'FileText',
      requiredPermission: 'claims:read',
      children: [
        {
          id: 'claims-queue',
          title: 'Triage Queue',
          navLink: '/claims',
          requiredPermission: 'claims:read',
          badgeName: 'Active',
          badgeColor: 'primary',
        },
        {
          id: 'claims-intake',
          title: 'Initiate New Claim',
          navLink: '/claims/new',
          requiredPermission: 'claims:create',
        },
      ],
    },
    {
      id: 'fraud-siu',
      title: 'Fraud & SIU Unit',
      icon: 'ShieldAlert',
      requiredPermission: 'fraud:read',
      children: [
        {
          id: 'fraud-audits',
          title: 'Scorecard Audits',
          navLink: '/claims?filter=fraud',
          requiredPermission: 'fraud:read',
        },
        {
          id: 'vector-search',
          title: 'pgvector Damage Search',
          navLink: '/claims?filter=vector',
          requiredPermission: 'fraud:read',
          badgeName: 'AI',
          badgeColor: 'teal',
        },
      ],
    },
    {
      id: 'ledger-accounting',
      title: 'Financial Ledger',
      icon: 'BookOpen',
      requiredPermission: 'ledger:read',
      children: [
        {
          id: 'ledger-journals',
          title: 'General Journals',
          navLink: '/ledger',
          requiredPermission: 'ledger:read',
        },
        {
          id: 'ledger-vouchers',
          title: 'Settlement Vouchers',
          navLink: '/ledger/vouchers',
          requiredPermission: 'ledger:read',
        },
      ],
    },
    {
      id: 'system-setup',
      title: 'Setup & Access Control',
      icon: 'Settings',
      requiredPermission: 'rbac:roles_create',
      children: [
        {
          id: 'roles-rights',
          title: 'Roles & Rights Setup',
          navLink: '/admin/roles',
          requiredPermission: 'rbac:roles_create',
        },
        {
          id: 'matrix-overview',
          title: 'Permission Matrix Grid',
          navLink: '/admin/rbac',
          requiredPermission: 'rbac:roles_create',
        },
        {
          id: 'user-access',
          title: 'User Role Assignment',
          navLink: '/admin/users',
          requiredPermission: 'rbac:users_assign',
        },
      ],
    },
    {
      id: 'audit-trail',
      title: 'Audit & Compliance',
      icon: 'History',
      requiredPermission: 'audit:read',
      children: [
        {
          id: 'audit-logs',
          title: 'Field Modification Logs',
          navLink: '/audit',
          requiredPermission: 'audit:read',
        },
      ],
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Filters and returns navigation menu items dynamically based on current user permissions.
   * Matches college erp GET /menu endpoint!
   */
  async getNavigationMenuForUser(userId: string): Promise<MenuItem[]> {
    const userPermissions = await this.getUserPermissions(userId);
    const permSet = new Set(userPermissions);

    const isSuperAdmin = permSet.has('SUPER_ADMIN') || userPermissions.includes('rbac:roles_create') && userPermissions.includes('claims:settle');

    const filterItem = (item: MenuItem): MenuItem | null => {
      // 1. Check if user satisfies required permission
      if (item.requiredPermission && !isSuperAdmin && !permSet.has(item.requiredPermission)) {
        return null;
      }

      // 2. Filter children recursively
      if (item.children && item.children.length > 0) {
        const permittedChildren = item.children
          .map(filterItem)
          .filter((c): c is MenuItem => c !== null);

        // If parent has children but user has 0 allowed children, hide parent
        if (permittedChildren.length === 0) {
          return null;
        }

        return {
          ...item,
          children: permittedChildren,
        };
      }

      return item;
    };

    return this.masterNavigationMenu
      .map(filterItem)
      .filter((m): m is MenuItem => m !== null);
  }

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

    const permissions = await this.prisma.permission.findMany({
      where: {
        OR: [
          { slug: { in: dto.permissionSlugs } },
          { id: { in: dto.permissionSlugs } },
        ],
      },
    });

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

    await this.redis.deletePattern('user_permissions:*');
    this.logger.log(`Permissions updated for role ${role.slug}. Permission cache invalidated.`);

    return {
      success: true,
      roleId,
      assignedCount: permissions.length,
      permissions: permissions.map((p) => p.slug),
    };
  }

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
