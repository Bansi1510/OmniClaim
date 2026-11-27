import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';
import { SettingValueType, AuthAuditEventType, LedgerEntryType, JournalStatus } from '@omniclaim/database';
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
  CreateManualJournalDto,
  UpdateManualJournalDto,
} from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
  ) {}

  async getBootstrapSnapshot(actor?: {
    id: string;
    permissions?: string[];
    roles?: string[];
    isSuperAdmin?: boolean;
    isMasterLogin?: boolean;
    bypassAllPermissions?: boolean;
  }) {
    const hasAdminOrOps =
      !actor ||
      actor.isSuperAdmin ||
      actor.isMasterLogin ||
      actor.bypassAllPermissions ||
      actor.roles?.includes('SUPER_ADMIN') ||
      actor.permissions?.includes('*') ||
      ['claims:update', 'claims:approve', 'claims:settle', 'fraud:read', 'ledger:read', 'audit:read', 'superadmin:access'].some(
        (p) => actor.permissions?.includes(p),
      );
    const restrictedUserId = !hasAdminOrOps ? actor.id : undefined;

    const [
      users,
      roles,
      permissions,
      claims,
      policies,
      parts,
      depreciationRules,
      automationRules,
      garages,
      menus,
      settings,
      ledgerAccounts,
      journals,
      auditLogs,
      locks,
      securityLogs,
    ] = await Promise.all([
      restrictedUserId
        ? Promise.resolve([])
        : this.prisma.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { slug: 'asc' }] }),
      this.prisma.claim.findMany({
        where: restrictedUserId ? { policy: { policyHolderId: restrictedUserId } } : undefined,
        include: {
          policy: true,
          adjuster: { select: { fullName: true } },
          detectedDamages: true,
          reconciliation: { include: { items: { include: { billLineItem: true } } } },
          actuarialAssessment: true,
          fraudScorecard: { include: { indicators: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.policy.findMany({
        where: restrictedUserId ? { policyHolderId: restrictedUserId } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehiclePartCatalog.findMany({ orderBy: { partCode: 'asc' } }),
      this.prisma.depreciationRule.findMany({ orderBy: { priority: 'asc' } }),
      this.prisma.automationRule.findMany({ orderBy: [{ ruleType: 'asc' }, { name: 'asc' }] }),
      this.prisma.repairGarage.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.dynamicMenuItem.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.systemSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] }),
      restrictedUserId
        ? Promise.resolve([])
        : this.prisma.ledgerAccount.findMany({ orderBy: { accountNumber: 'asc' } }),
      restrictedUserId
        ? Promise.resolve([])
        : this.prisma.ledgerJournalEntry.findMany({
            include: { claim: { select: { claimNumber: true } }, lines: { include: { account: true } } },
            orderBy: { createdAt: 'desc' },
          }),
      this.prisma.claimAuditLog.findMany({
        where: restrictedUserId ? { claim: { policy: { policyHolderId: restrictedUserId } } } : undefined,
        include: {
          claim: { select: { claimNumber: true } },
          user: { select: { fullName: true, email: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
      restrictedUserId
        ? Promise.resolve([])
        : this.prisma.claimLock.findMany({
            include: {
              claim: { select: { claimNumber: true } },
              user: { select: { fullName: true, email: true } },
            },
          }),
      restrictedUserId
        ? Promise.resolve([])
        : this.prisma.securityAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.fullName]));
    const masterEnabledSetting = settings.find((s) => s.key === 'SUPER_MASTER_PASSWORD_ENABLED');

    return {
      superMasterPasswordEnabled: masterEnabledSetting ? masterEnabledSetting.value !== 'false' : true,
      users: users.map((u) => ({
        id: u.id,
        username: u.username || u.email.split('@')[0],
        email: u.email,
        fullName: u.fullName,
        password: '',
        roleSlug: u.roles[0]?.role.slug || 'POLICYHOLDER',
        roleName: u.roles[0]?.role.name || 'Policyholder',
        isActive: u.isActive,
        isSuperAdmin: u.isSuperAdmin,
        assignedAt: u.createdAt.toISOString().slice(0, 10),
      })),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.slug === 'SUPER_ADMIN' ? ['*'] : r.permissions.map((p) => p.permission.slug),
      })),
      permissionsCatalog: permissions.map((p) => {
        const parts = p.slug.split(':');
        return {
          id: p.id,
          slug: p.slug,
          module: p.module,
          action: (parts[1] || 'ACCESS').replace(/_/g, ' ').toUpperCase(),
          description: p.description,
        };
      }),
      claims: claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        policyNumber: c.policy.policyNumber,
        vehicle: `${c.policy.vehicleYear} ${c.policy.vehicleMake} ${c.policy.vehicleModel} (VIN: ${c.policy.vehicleVin})`,
        incidentDate: c.incidentDate.toISOString().replace('T', ' ').slice(0, 16),
        incidentDescription: c.incidentDescription || '',
        status: c.status,
        version: c.version,
        fraudScore: c.fraudScorecard?.compositeScore ?? 0,
        riskTier: c.fraudScorecard?.riskTier ?? 'LOW',
        netPayout: Number(c.actuarialAssessment?.netPayout ?? 0),
        deductible: Number(c.policy.baseDeductible ?? 500),
        adjuster: c.adjuster?.fullName || 'Unassigned',
        damages: c.detectedDamages.map((d) => ({
          id: d.id,
          evidenceId: d.evidenceId,
          partType: d.partType,
          materialType: d.materialType,
          severity: d.severity,
          confidence: d.confidence,
          boundingBox: (d.boundingBoxJson as any) || { xmin: 0.2, ymin: 0.3, xmax: 0.7, ymax: 0.8 },
          repairAction: d.repairAction === 'REPAIR' ? 'REPAIR' : 'REPLACE',
          isManualAdded: d.isManualAdded,
        })),
        reconciliationItems: (c.reconciliation?.items || []).map((i) => ({
          id: i.id,
          billLineItemId: i.billLineItemId,
          rawDescription: i.billLineItem.rawDescription,
          claimedCost: Number(i.billLineItem.claimedCost),
          isLabor: i.billLineItem.isLabor,
          isVerifiedByDamage: i.isVerifiedByDamage,
          matchedDamagePart: i.matchedDamagePart,
          systemDeduction: Number(i.systemDeduction),
          approvedCost: Number(i.approvedCost),
          rejectionReason: i.rejectionReason,
          isManualOverride: i.isManualOverride,
          overrideReason: i.overrideReason,
        })),
        fraudIndicators: (c.fraudScorecard?.indicators || []).map((fi) => ({
          id: fi.id,
          type: fi.type,
          riskContribution: fi.riskContribution,
          evidenceMetadata: (fi.evidenceMetadata as any) || {},
          isOverridden: fi.isOverridden,
          overrideReason: fi.overrideReason || undefined,
        })),
      })),
      policies: policies.map((p) => ({
        id: p.id,
        policyNumber: p.policyNumber,
        policyHolderId: p.policyHolderId,
        policyHolderName: userMap.get(p.policyHolderId) || 'Insured Policyholder',
        vehicleVin: p.vehicleVin,
        vehicleMake: p.vehicleMake,
        vehicleModel: p.vehicleModel,
        vehicleYear: p.vehicleYear,
        coverageLimit: Number(p.coverageLimit),
        baseDeductible: Number(p.baseDeductible),
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate: p.endDate.toISOString().slice(0, 10),
        isActive: p.isActive,
      })),
      partsCatalog: parts.map((pt) => ({
        id: pt.id,
        partCode: pt.partCode,
        partName: pt.partName,
        partType: pt.partType,
        materialType: pt.materialType,
        oemBasePrice: Number(pt.oemBasePrice),
        aftermarketPrice: Number(pt.aftermarketPrice),
        defaultLaborHours: pt.defaultLaborHours,
        laborRatePerHour: Number(pt.laborRatePerHour),
        depreciationOverridePct: pt.depreciationOverridePct,
        isActive: pt.isActive,
      })),
      depreciationRules,
      automationRules,
      garages: garages.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        city: g.city,
        taxId: g.taxId || undefined,
        hourlyLaborRate: Number(g.hourlyLaborRate),
        rating: g.rating,
        isPreferredNetwork: g.isPreferredNetwork,
        isBlacklisted: g.isBlacklisted,
        phone: g.phone || undefined,
        email: g.email || undefined,
      })),
      menus,
      settings: settings
        .filter((s) => s.valueType !== SettingValueType.SECRET)
        .map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
          value: s.value,
          valueType: s.valueType,
          category: s.category,
          description: s.description || undefined,
          isEditable: s.isEditable,
          updatedAt: s.updatedAt.toISOString().slice(0, 10),
        })),
      ledgerAccounts,
      journalEntries: journals.flatMap((j) =>
        j.lines.map((l) => ({
          id: `${j.id}:${l.id}`,
          voucherNumber: j.entryNumber,
          date: j.postedAt.toISOString().replace('T', ' ').slice(0, 16),
          claimNumber: j.claim?.claimNumber || 'MANUAL-ADJ',
          account: l.account.name,
          entryType: l.type,
          amount: Number(l.amount),
          description: j.description,
          isReconciled: j.status === JournalStatus.POSTED,
        })),
      ),
      auditLogs: auditLogs.map((a) => ({
        id: a.id,
        claimId: a.claimId,
        claimNumber: a.claim.claimNumber,
        field: a.fieldName || a.action,
        oldValue: a.oldValue || '—',
        newValue: a.newValue || a.action,
        modifiedBy: a.user.fullName,
        modifiedByEmail: a.user.email,
        timestamp: a.timestamp.toISOString().replace('T', ' ').slice(0, 19),
        reason: a.action,
      })),
      presenceLeases: locks.map((lk) => ({
        claimId: lk.claimId,
        claimNumber: lk.claim.claimNumber,
        adjusterName: lk.user.fullName,
        adjusterEmail: lk.user.email,
        leasedAt: lk.lockedAt.toISOString().replace('T', ' ').slice(0, 16),
        expiresInSeconds: Math.max(0, Math.floor((lk.expiresAt.getTime() - Date.now()) / 1000)),
      })),
      securityAuditLogs: securityLogs.map((sl) => ({
        id: sl.id,
        eventType: sl.eventType,
        targetUserId: sl.targetUserId,
        actorIdentifier: sl.actorIdentifier,
        platform: sl.platform,
        metadata: (sl.metadata as any) || {},
        createdAt: sl.createdAt.toISOString().replace('T', ' ').slice(0, 19),
      })),
    };
  }

  async createManualJournal(dto: CreateManualJournalDto) {
    const account =
      (await this.prisma.ledgerAccount.findFirst({ where: { name: { contains: dto.account, mode: 'insensitive' } } })) ||
      (await this.prisma.ledgerAccount.findFirst());
    if (!account) throw new BadRequestException('No ledger account found.');

    const claim = dto.claimNumber
      ? await this.prisma.claim.findUnique({ where: { claimNumber: dto.claimNumber } })
      : null;

    const entryNumber = `JRNL-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    return this.prisma.ledgerJournalEntry.create({
      data: {
        entryNumber,
        claimId: claim?.id || null,
        description: dto.description || 'Manual adjustment voucher',
        status: JournalStatus.POSTED,
        lines: {
          create: [
            {
              accountId: account.id,
              type: dto.entryType === 'DEBIT' ? LedgerEntryType.DEBIT : LedgerEntryType.CREDIT,
              amount: dto.amount,
            },
          ],
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  async updateManualJournal(compositeOrId: string, dto: UpdateManualJournalDto) {
    const [journalId, lineId] = compositeOrId.includes(':')
      ? compositeOrId.split(':')
      : [compositeOrId, undefined];

    const updated = await this.prisma.ledgerJournalEntry.update({
      where: { id: journalId },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isReconciled !== undefined
          ? { status: dto.isReconciled ? JournalStatus.POSTED : JournalStatus.DRAFT }
          : {}),
      },
    });

    if (lineId && (dto.amount !== undefined || dto.entryType !== undefined)) {
      await this.prisma.ledgerTransactionLine.update({
        where: { id: lineId },
        data: {
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.entryType !== undefined
            ? { type: dto.entryType === 'DEBIT' ? LedgerEntryType.DEBIT : LedgerEntryType.CREDIT }
            : {}),
        },
      });
    }

    return updated;
  }

  async deleteJournalEntry(compositeOrId: string) {
    const journalId = compositeOrId.includes(':') ? compositeOrId.split(':')[0] : compositeOrId;
    await this.prisma.ledgerJournalEntry.delete({ where: { id: journalId } });
    return { success: true, deletedId: journalId };
  }

  async releaseLockByClaimId(claimId: string) {
    await this.prisma.claimLock.deleteMany({ where: { claimId } });
    return { success: true, claimId };
  }

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
    let holderId: string | undefined;
    if (dto.policyHolderId) {
      const existingHolder = await this.prisma.user.findUnique({ where: { id: dto.policyHolderId } });
      if (existingHolder) holderId = existingHolder.id;
    }
    if (!holderId && dto.policyHolderName) {
      const namedHolder = await this.prisma.user.findFirst({
        where: { fullName: { contains: dto.policyHolderName, mode: 'insensitive' } },
      });
      if (namedHolder) holderId = namedHolder.id;
    }
    if (!holderId) {
      const firstUser =
        (await this.prisma.user.findFirst({ where: { isSuperAdmin: false } })) ||
        (await this.prisma.user.findFirst());
      holderId = firstUser?.id || 'seed-holder';
    }
    return this.prisma.policy.create({
      data: {
        policyNumber: dto.policyNumber,
        policyHolderId: holderId,
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
    const linkedClaims = await this.prisma.claim.count({ where: { policyId: id } });
    if (linkedClaims > 0) {
      throw new BadRequestException(
        `Cannot delete policy while ${linkedClaims} claim(s) reference it. Delete or reassign those claims first.`,
      );
    }
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
  private async generateUniqueUsername(dto: CreateUserDto): Promise<string> {
    const rolePrefix = (dto.roleSlug || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 10);
    const nameSlug = dto.fullName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 20);

    const requested = dto.username?.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '');
    const base = requested || `${rolePrefix || 'user'}.${nameSlug || 'member'}`;

    let candidate = base;
    for (let attempt = 0; attempt < 25; attempt++) {
      const existing = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!existing) {
        return candidate;
      }
      const suffix = Math.floor(1000 + Math.random() * 9000);
      candidate = `${base}.${suffix}`;
    }
    return `${base}.${Date.now().toString(36)}`;
  }

  async createUser(dto: CreateUserDto) {
    const initialPassword =
      dto.password?.trim() || process.env.DEFAULT_USER_PASSWORD || 'OmniClaim@123';
    const passwordHash = this.authService.hashUserPassword(initialPassword);
    const uniqueUsername = await this.generateUniqueUsername(dto);

    let resolvedRoleIds = dto.roleIds || [];
    if (resolvedRoleIds.length === 0 && dto.roleSlug) {
      const role = await this.prisma.role.findUnique({ where: { slug: dto.roleSlug } });
      if (role) resolvedRoleIds = [role.id];
    }

    const user = await this.prisma.user.create({
      data: {
        username: uniqueUsername,
        email: dto.email.toLowerCase().trim(),
        fullName: dto.fullName.trim(),
        passwordHash,
        mustChangePassword: true,
        isActive: dto.isActive ?? true,
        isSuperAdmin: dto.isSuperAdmin ?? (dto.roleSlug === 'SUPER_ADMIN'),
        ...(resolvedRoleIds.length > 0
          ? {
              roles: {
                create: resolvedRoleIds.map((roleId) => ({ roleId })),
              },
            }
          : {}),
      },
      include: { roles: { include: { role: true } } },
    });
    return {
      ...user,
      temporaryPassword: initialPassword,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found.`);

    let resolvedRoleIds = dto.roleIds;
    if (!resolvedRoleIds && dto.roleSlug) {
      const role = await this.prisma.role.findUnique({ where: { slug: dto.roleSlug } });
      if (role) resolvedRoleIds = [role.id];
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (resolvedRoleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (resolvedRoleIds.length > 0) {
          await tx.userRole.createMany({
            data: resolvedRoleIds.map((roleId) => ({ userId: id, roleId })),
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
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found.`);
    if (existing.username === 'superadmin') {
      throw new BadRequestException('Root superadmin account is protected and cannot be deleted.');
    }

    const fallbackSuper = await this.prisma.user.findFirst({
      where: { isSuperAdmin: true, id: { not: id } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.claim.updateMany({ where: { adjusterId: id }, data: { adjusterId: null } });
      await tx.claimLock.deleteMany({ where: { userId: id } });
      if (fallbackSuper) {
        await tx.claimAuditLog.updateMany({ where: { userId: id }, data: { userId: fallbackSuper.id } });
        await tx.claimTransitionLog.updateMany({ where: { triggeredById: id }, data: { triggeredById: fallbackSuper.id } });
      }
      await tx.user.delete({ where: { id } });
    });

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
    const linkedLines = await this.prisma.ledgerTransactionLine.count({ where: { accountId: id } });
    if (linkedLines > 0) {
      throw new BadRequestException(
        `Cannot delete ledger account with ${linkedLines} posted journal transaction line(s).`,
      );
    }
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
