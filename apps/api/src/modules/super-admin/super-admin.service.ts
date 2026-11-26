import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';
import { SettingValueType, AuthAuditEventType } from '@omniclaim/database';
import {
  UpsertSystemSettingDto,
  CreatePolicyDto,
  UpdatePolicyDto,
  CreatePartCatalogDto,
  UpdatePartCatalogDto,
  CreateDepreciationRuleDto,
  UpdateDepreciationRuleDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  CreateGarageDto,
  UpdateGarageDto,
  CreateDynamicMenuDto,
  UpdateDynamicMenuDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  CreateUserDto,
  UpdateUserDto,
  CreateLedgerAccountDto,
  UpdateLedgerAccountDto,
  ForceClaimStatusDto,
} from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
  ) {}

  // =========================================================================
  // 1. SUPER ADMIN TELEMETRY OVERVIEW
  // =========================================================================
  async getDashboardOverview() {
    const [
      claimsCount,
      usersCount,
      rolesCount,
      policiesCount,
      partsCount,
      rulesCount,
      garagesCount,
      settingsCount,
      recentSecurityLogs,
    ] = await Promise.all([
      this.prisma.claim.count(),
      this.prisma.user.count(),
      this.prisma.role.count(),
      this.prisma.policy.count(),
      this.prisma.vehiclePartCatalog.count(),
      this.prisma.automationRule.count(),
      this.prisma.repairGarage.count(),
      this.prisma.systemSetting.count(),
      this.prisma.securityAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { targetUser: { select: { username: true, email: true, fullName: true } } },
      }),
    ]);

    return {
      metrics: {
        claimsCount,
        usersCount,
        rolesCount,
        policiesCount,
        partsCount,
        rulesCount,
        garagesCount,
        settingsCount,
      },
      recentSecurityLogs,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // 2. DYNAMIC SYSTEM SETTINGS CRUD
  // =========================================================================
  async listSettings(category?: string) {
    const settings = await this.prisma.systemSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    // Mask SECRET hashes in API responses while exposing metadata
    return settings.map((s) => ({
      ...s,
      value: s.valueType === SettingValueType.SECRET ? '•••••••••••• (HASHED)' : s.value,
    }));
  }

  async upsertSetting(dto: UpsertSystemSettingDto, actorEmail: string) {
    return this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      update: {
        label: dto.label,
        value: dto.value,
        valueType: dto.valueType || SettingValueType.STRING,
        category: dto.category,
        description: dto.description,
        isEditable: dto.isEditable ?? true,
        updatedBy: actorEmail,
      },
      create: {
        key: dto.key,
        label: dto.label,
        value: dto.value,
        valueType: dto.valueType || SettingValueType.STRING,
        category: dto.category,
        description: dto.description,
        isEditable: dto.isEditable ?? true,
        updatedBy: actorEmail,
      },
    });
  }

  async deleteSetting(id: string) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Setting ${id} not found.`);
    if (existing.key === 'SUPER_MASTER_PASSWORD_HASH') {
      throw new BadRequestException('Cannot delete core Super Master Password key. Rotate it instead.');
    }
    await this.prisma.systemSetting.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 3. DYNAMIC POLICIES MASTER CRUD
  // =========================================================================
  async listPolicies() {
    return this.prisma.policy.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPolicy(dto: CreatePolicyDto) {
    return this.prisma.policy.create({
      data: {
        policyNumber: dto.policyNumber,
        policyHolderId: dto.policyHolderId,
        vehicleVin: dto.vehicleVin,
        vehicleMake: dto.vehicleMake,
        vehicleModel: dto.vehicleModel,
        vehicleYear: dto.vehicleYear,
        coverageLimit: dto.coverageLimit,
        baseDeductible: dto.baseDeductible,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePolicy(id: string, dto: UpdatePolicyDto) {
    return this.prisma.policy.update({
      where: { id },
      data: {
        ...(dto.vehicleVin !== undefined ? { vehicleVin: dto.vehicleVin } : {}),
        ...(dto.vehicleMake !== undefined ? { vehicleMake: dto.vehicleMake } : {}),
        ...(dto.vehicleModel !== undefined ? { vehicleModel: dto.vehicleModel } : {}),
        ...(dto.vehicleYear !== undefined ? { vehicleYear: dto.vehicleYear } : {}),
        ...(dto.coverageLimit !== undefined ? { coverageLimit: dto.coverageLimit } : {}),
        ...(dto.baseDeductible !== undefined ? { baseDeductible: dto.baseDeductible } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deletePolicy(id: string) {
    await this.prisma.policy.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 4. DYNAMIC VEHICLE PARTS CATALOG CRUD
  // =========================================================================
  async listParts() {
    return this.prisma.vehiclePartCatalog.findMany({ orderBy: { partCode: 'asc' } });
  }

  async createPart(dto: CreatePartCatalogDto) {
    return this.prisma.vehiclePartCatalog.create({ data: dto });
  }

  async updatePart(id: string, dto: UpdatePartCatalogDto) {
    return this.prisma.vehiclePartCatalog.update({ where: { id }, data: dto });
  }

  async deletePart(id: string) {
    await this.prisma.vehiclePartCatalog.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 5. DYNAMIC DEPRECIATION RULES CRUD
  // =========================================================================
  async listDepreciationRules() {
    return this.prisma.depreciationRule.findMany({ orderBy: { priority: 'asc' } });
  }

  async createDepreciationRule(dto: CreateDepreciationRuleDto) {
    return this.prisma.depreciationRule.create({ data: dto });
  }

  async updateDepreciationRule(id: string, dto: UpdateDepreciationRuleDto) {
    return this.prisma.depreciationRule.update({ where: { id }, data: dto });
  }

  async deleteDepreciationRule(id: string) {
    await this.prisma.depreciationRule.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 6. DYNAMIC STP & FRAUD AUTOMATION RULES CRUD
  // =========================================================================
  async listAutomationRules() {
    return this.prisma.automationRule.findMany({ orderBy: [{ ruleType: 'asc' }, { name: 'asc' }] });
  }

  async createAutomationRule(dto: CreateAutomationRuleDto) {
    return this.prisma.automationRule.create({ data: dto });
  }

  async updateAutomationRule(id: string, dto: UpdateAutomationRuleDto) {
    return this.prisma.automationRule.update({ where: { id }, data: dto });
  }

  async deleteAutomationRule(id: string) {
    await this.prisma.automationRule.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 7. DYNAMIC REPAIR GARAGES CRUD
  // =========================================================================
  async listGarages() {
    return this.prisma.repairGarage.findMany({ orderBy: { name: 'asc' } });
  }

  async createGarage(dto: CreateGarageDto) {
    return this.prisma.repairGarage.create({ data: dto });
  }

  async updateGarage(id: string, dto: UpdateGarageDto) {
    return this.prisma.repairGarage.update({ where: { id }, data: dto });
  }

  async deleteGarage(id: string) {
    await this.prisma.repairGarage.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 8. DYNAMIC MENUS & PERMISSIONS CRUD
  // =========================================================================
  async listMenus() {
    return this.prisma.dynamicMenuItem.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createMenu(dto: CreateDynamicMenuDto) {
    return this.prisma.dynamicMenuItem.create({ data: dto });
  }

  async updateMenu(id: string, dto: UpdateDynamicMenuDto) {
    return this.prisma.dynamicMenuItem.update({ where: { id }, data: dto });
  }

  async deleteMenu(id: string) {
    await this.prisma.dynamicMenuItem.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  async createPermission(dto: CreatePermissionDto) {
    const created = await this.prisma.permission.create({
      data: {
        slug: dto.slug.toLowerCase(),
        module: dto.module.toUpperCase(),
        description: dto.description,
      },
    });
    await this.redis.deletePattern('user_permissions:*');
    return created;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    const updated = await this.prisma.permission.update({
      where: { id },
      data: {
        ...(dto.module ? { module: dto.module.toUpperCase() } : {}),
        ...(dto.description ? { description: dto.description } : {}),
      },
    });
    await this.redis.deletePattern('user_permissions:*');
    return updated;
  }

  async deletePermission(id: string) {
    await this.prisma.permission.delete({ where: { id } });
    await this.redis.deletePattern('user_permissions:*');
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 9. DYNAMIC USERS FULL CRUD
  // =========================================================================
  async createUser(dto: CreateUserDto) {
    const passwordHash = this.authService.hashUserPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username.toLowerCase().trim(),
        email: dto.email.toLowerCase().trim(),
        fullName: dto.fullName,
        passwordHash,
        isActive: dto.isActive ?? true,
        isSuperAdmin: dto.isSuperAdmin ?? false,
        ...(dto.roleIds && dto.roleIds.length > 0
          ? {
              roles: {
                create: dto.roleIds.map((roleId) => ({ roleId })),
              },
            }
          : {}),
      },
      include: { roles: { include: { role: true } } },
    });
    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found.`);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(dto.username !== undefined ? { username: dto.username.toLowerCase().trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.toLowerCase().trim() } : {}),
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.password ? { passwordHash: this.authService.hashUserPassword(dto.password) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.isSuperAdmin !== undefined ? { isSuperAdmin: dto.isSuperAdmin } : {}),
        },
        include: { roles: { include: { role: true } } },
      });
    });

    await this.redis.del(`user_permissions:${id}`);
    return updated;
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    await this.redis.del(`user_permissions:${id}`);
    return { success: true, deletedId: id };
  }

  // =========================================================================
  // 10. LEDGER ACCOUNTS CRUD & SUPER ADMIN FORCE CLAIM OVERRIDE
  // =========================================================================
  async listLedgerAccounts() {
    return this.prisma.ledgerAccount.findMany({ orderBy: { accountNumber: 'asc' } });
  }

  async createLedgerAccount(dto: CreateLedgerAccountDto) {
    return this.prisma.ledgerAccount.create({ data: dto });
  }

  async updateLedgerAccount(id: string, dto: UpdateLedgerAccountDto) {
    return this.prisma.ledgerAccount.update({ where: { id }, data: dto });
  }

  async deleteLedgerAccount(id: string) {
    await this.prisma.ledgerAccount.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  async forceUpdateClaimStatus(claimId: string, dto: ForceClaimStatusDto, actorId: string, actorEmail: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundException(`Claim ${claimId} not found.`);

    const updated = await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: dto.status,
        version: { increment: 1 },
      },
    });

    await this.prisma.securityAuditLog.create({
      data: {
        eventType: AuthAuditEventType.SUPER_ADMIN_OVERRIDE,
        actorIdentifier: actorEmail || actorId,
        platform: 'API',
        metadata: {
          claimId,
          fromStatus: claim.status,
          toStatus: dto.status,
          reason: dto.reason,
        },
      },
    });

    this.logger.warn(`Super Admin force-moved claim ${claim.claimNumber} from ${claim.status} -> ${dto.status}`);
    return updated;
  }
}
