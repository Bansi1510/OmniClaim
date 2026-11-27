import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignRolesDto } from './dto/rbac.dto';
import { CreatePermissionDto } from './dto/permission.dto';

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
  permissions: Array<{ id: string; slug: string; action: string; description: string }>;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  // Full enterprise master menu navigation tree matching college erp module_master menu
  private readonly masterNavigationMenu: MenuItem[] = [/* ...existing menu... */];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listAllPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { slug: 'asc' },
    });
    return permissions.map((p) => ({
      id: p.id,
      slug: p.slug,
      module: p.module,
      displayName: p.displayName,
      description: p.description,
    }));
  }

  async createPermission(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findFirst({
      where: { OR: [{ slug: dto.slug }, { module: dto.module }] },
    });
    if (existing) {
      throw new BadRequestException(`Permission slug '${dto.slug}' or module '${dto.module}' already exists`);
    }

    const permission = await this.prisma.permission.create({
      data: {
        slug: dto.slug,
        module: dto.module,
        displayName: dto.displayName,
        description: dto.description,
      },
    });

    await this.redis.deletePattern('user_permissions:*');
    return permission;
  }

  // ... existing methods ...
}
