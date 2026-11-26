import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

export interface AuditFieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface RouteAuditContext {
  module: string;
  entityType: string | null;
  entityId: string | null;
  action: string;
  routePattern: string;
}

export interface AuditActorInfo {
  userId: string | null;
  username: string | null;
  userEmail: string | null;
  userFullName: string | null;
  userRole: string | null;
  isMasterLogin: boolean;
}

const SENSITIVE_KEY_PATTERN =
  /(password|passwordhash|secret|token|authorization|apikey|api_key|privatekey|cookie)/i;

const IGNORED_DIFF_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'passwordHash',
  'roles',
  'permissions',
  'lines',
  'policy',
  'adjuster',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Deeply sanitizes payloads for JSON storage: redacts secrets/passwords,
   * converts Prisma Decimal / Date / BigInt, and caps large collections.
   */
  sanitizeValue(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return value ?? null;
    if (depth > 4) return '[TRUNCATED]';

    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') {
      return value.length > 500 ? `${value.slice(0, 500)}…` : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;

    // Prisma 6 Decimal objects (constructor name may be minified like "i" or "o")
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as any).toNumber === 'function' &&
      typeof (value as any).toFixed === 'function' &&
      'd' in (value as any) &&
      'e' in (value as any) &&
      's' in (value as any)
    ) {
      return (value as any).toNumber();
    }

    if (Array.isArray(value)) {
      const slice = value.slice(0, 25).map((item) => this.sanitizeValue(item, depth + 1));
      if (value.length > 25) slice.push(`...(+${value.length - 25} more)`);
      return slice;
    }

    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>).slice(0, 40);
      for (const [k, v] of entries) {
        if (typeof v === 'function') continue;
        if (SENSITIVE_KEY_PATTERN.test(k)) {
          out[k] = '[REDACTED]';
        } else if (k === 'value' && (value as any).valueType === 'SECRET') {
          out[k] = '[REDACTED]';
        } else {
          out[k] = this.sanitizeValue(v, depth + 1);
        }
      }
      return out;
    }

    return String(value);
  }

  /**
   * Maps any HTTP method + URL path into structured module, entityType, entityId, and action labels.
   */
  parseRouteContext(
    method: string,
    rawUrl: string,
    params?: Record<string, string>,
    body?: Record<string, any>,
  ): RouteAuditContext {
    const cleanPath = (rawUrl || '/').split('?')[0];
    const upperMethod = (method || 'GET').toUpperCase();
    const segments = cleanPath.split('/').filter(Boolean);
    const paramId = params?.id || params?.userId || params?.claimId || null;

    const rules: Array<{
      pattern: RegExp;
      module: string;
      entityType: string;
      routePattern: string;
      idGroup?: number;
    }> = [
      { pattern: /^\/api\/v1\/super-admin\/policies(?:\/([^/]+))?$/, module: 'POLICIES', entityType: 'Policy', routePattern: '/api/v1/super-admin/policies/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/users(?:\/([^/]+))?$/, module: 'USERS', entityType: 'User', routePattern: '/api/v1/super-admin/users/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/parts(?:\/([^/]+))?$/, module: 'PARTS', entityType: 'VehiclePartCatalog', routePattern: '/api/v1/super-admin/parts/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/depreciation-rules(?:\/([^/]+))?$/, module: 'DEPRECIATION', entityType: 'DepreciationRule', routePattern: '/api/v1/super-admin/depreciation-rules/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/automation-rules(?:\/([^/]+))?$/, module: 'RULES', entityType: 'AutomationRule', routePattern: '/api/v1/super-admin/automation-rules/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/garages(?:\/([^/]+))?$/, module: 'GARAGES', entityType: 'RepairGarage', routePattern: '/api/v1/super-admin/garages/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/menus(?:\/([^/]+))?$/, module: 'MENUS', entityType: 'DynamicMenuItem', routePattern: '/api/v1/super-admin/menus/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/permissions(?:\/([^/]+))?$/, module: 'PERMISSIONS', entityType: 'Permission', routePattern: '/api/v1/super-admin/permissions/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/settings(?:\/([^/]+))?$/, module: 'SETTINGS', entityType: 'SystemSetting', routePattern: '/api/v1/super-admin/settings/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/ledger-accounts(?:\/([^/]+))?$/, module: 'LEDGER', entityType: 'LedgerAccount', routePattern: '/api/v1/super-admin/ledger-accounts/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/journals(?:\/([^/]+))?$/, module: 'LEDGER', entityType: 'LedgerJournalEntry', routePattern: '/api/v1/super-admin/journals/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/locks(?:\/([^/]+))?$/, module: 'PRESENCE', entityType: 'ClaimLock', routePattern: '/api/v1/super-admin/locks/:claimId', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/claims\/([^/]+)\/force-status$/, module: 'CLAIMS', entityType: 'Claim', routePattern: '/api/v1/super-admin/claims/:id/force-status', idGroup: 1 },
      { pattern: /^\/api\/v1\/super-admin\/(bootstrap|overview|database\/reseed)$/, module: 'SUPER_ADMIN', entityType: 'System', routePattern: cleanPath },
      { pattern: /^\/api\/v1\/rbac\/roles(?:\/([^/]+))?(?:\/permissions)?$/, module: 'ROLES', entityType: 'Role', routePattern: '/api/v1/rbac/roles/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/rbac\/users(?:\/([^/]+))?(?:\/roles)?$/, module: 'USERS', entityType: 'User', routePattern: '/api/v1/rbac/users/:id/roles', idGroup: 1 },
      { pattern: /^\/api\/v1\/rbac\/(permissions|navigation-menu|user-permissions)$/, module: 'RBAC', entityType: 'Permission', routePattern: cleanPath },
      { pattern: /^\/api\/v1\/claims(?:\/([^/]+))?(?:\/(.+))?$/, module: 'CLAIMS', entityType: 'Claim', routePattern: '/api/v1/claims/:id', idGroup: 1 },
      { pattern: /^\/api\/v1\/auth\/(.+)$/, module: 'AUTH', entityType: 'AuthSession', routePattern: cleanPath },
      { pattern: /^\/api\/v1\/audit(?:\/(.+))?$/, module: 'AUDIT', entityType: 'SystemActivityAuditLog', routePattern: cleanPath },
      { pattern: /^\/api\/v1\/webhooks(?:\/(.+))?$/, module: 'WEBHOOKS', entityType: 'WebhookEvent', routePattern: cleanPath },
    ];

    for (const rule of rules) {
      const m = cleanPath.match(rule.pattern);
      if (m) {
        const extractedId =
          paramId ||
          (rule.idGroup && m[rule.idGroup] ? decodeURIComponent(m[rule.idGroup]) : null) ||
          (rule.entityType === 'SystemSetting' && body?.key ? String(body.key) : null);

        const verbPrefix =
          upperMethod === 'GET'
            ? 'READ'
            : upperMethod === 'POST'
              ? cleanPath.includes('login')
                ? 'LOGIN'
                : cleanPath.includes('impersonate')
                  ? 'IMPERSONATE'
                  : cleanPath.includes('rotate-master-password')
                    ? 'ROTATE_MASTER_PASSWORD'
                    : cleanPath.includes('reseed')
                      ? 'RESEED_DATABASE'
                      : cleanPath.includes('permissions') && rule.entityType === 'Role'
                        ? 'ASSIGN_ROLE_PERMISSIONS'
                        : cleanPath.includes('force-status')
                          ? 'FORCE_CLAIM_STATUS'
                          : `CREATE_${rule.entityType.toUpperCase()}`
              : upperMethod === 'PUT' || upperMethod === 'PATCH'
                ? `UPDATE_${rule.entityType.toUpperCase()}`
                : upperMethod === 'DELETE'
                  ? `DELETE_${rule.entityType.toUpperCase()}`
                  : `${upperMethod}_${rule.module}`;

        return {
          module: rule.module,
          entityType: rule.entityType,
          entityId: extractedId,
          action: verbPrefix,
          routePattern: extractedId ? rule.routePattern : cleanPath,
        };
      }
    }

    const fallbackMod = (segments[2] || segments[0] || 'SYSTEM').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    return {
      module: fallbackMod,
      entityType: null,
      entityId: paramId,
      action: `${upperMethod}_${fallbackMod}`,
      routePattern: cleanPath,
    };
  }

  /**
   * Fetches the current DB state of an entity BEFORE a PATCH/PUT/DELETE/Upsert executes,
   * enabling accurate oldValues -> newValues -> changedFields diffs automatically!
   */
  async fetchEntitySnapshot(
    entityType: string | null,
    entityId: string | null,
    body?: Record<string, any>,
  ): Promise<Record<string, unknown> | null> {
    if (!entityType) return null;
    try {
      let record: any = null;
      switch (entityType) {
        case 'Claim': {
          if (!entityId) return null;
          const c = await this.prisma.claim.findUnique({
            where: { id: entityId },
            include: {
              actuarialAssessment: { select: { netPayout: true } },
              fraudScorecard: { select: { compositeScore: true, riskTier: true } },
            },
          });
          if (c) {
            record = {
              id: c.id,
              claimNumber: c.claimNumber,
              policyId: c.policyId,
              status: c.status,
              version: c.version,
              incidentDescription: c.incidentDescription,
              adjusterId: c.adjusterId,
              netPayout: c.actuarialAssessment ? Number(c.actuarialAssessment.netPayout) : null,
              fraudScore: c.fraudScorecard?.compositeScore ?? null,
              riskTier: c.fraudScorecard?.riskTier ?? null,
            };
          }
          break;
        }
        case 'Policy':
          if (entityId) record = await this.prisma.policy.findUnique({ where: { id: entityId } });
          break;
        case 'User': {
          if (!entityId) return null;
          const u = await this.prisma.user.findUnique({
            where: { id: entityId },
            include: { roles: { include: { role: { select: { slug: true } } } } },
          });
          if (u) {
            record = {
              id: u.id,
              username: u.username,
              email: u.email,
              fullName: u.fullName,
              isActive: u.isActive,
              isSuperAdmin: u.isSuperAdmin,
              roleSlug: u.roles[0]?.role.slug || null,
            };
          }
          break;
        }
        case 'Role': {
          if (!entityId) return null;
          const r = await this.prisma.role.findUnique({
            where: { id: entityId },
            include: { permissions: { include: { permission: { select: { slug: true } } } } },
          });
          if (r) {
            record = {
              id: r.id,
              name: r.name,
              slug: r.slug,
              description: r.description,
              isSystem: r.isSystem,
              permissionSlugs: r.permissions.map((p) => p.permission.slug).sort(),
            };
          }
          break;
        }
        case 'VehiclePartCatalog':
          if (entityId) record = await this.prisma.vehiclePartCatalog.findUnique({ where: { id: entityId } });
          break;
        case 'DepreciationRule':
          if (entityId) record = await this.prisma.depreciationRule.findUnique({ where: { id: entityId } });
          break;
        case 'AutomationRule':
          if (entityId) record = await this.prisma.automationRule.findUnique({ where: { id: entityId } });
          break;
        case 'RepairGarage':
          if (entityId) record = await this.prisma.repairGarage.findUnique({ where: { id: entityId } });
          break;
        case 'DynamicMenuItem':
          if (entityId) record = await this.prisma.dynamicMenuItem.findUnique({ where: { id: entityId } });
          break;
        case 'Permission':
          if (entityId) record = await this.prisma.permission.findUnique({ where: { id: entityId } });
          break;
        case 'SystemSetting':
          if (entityId) {
            record =
              (await this.prisma.systemSetting.findUnique({ where: { id: entityId } })) ||
              (await this.prisma.systemSetting.findUnique({ where: { key: entityId } }));
          } else if (body?.key) {
            record = await this.prisma.systemSetting.findUnique({ where: { key: String(body.key) } });
          }
          break;
        case 'LedgerAccount':
          if (entityId) record = await this.prisma.ledgerAccount.findUnique({ where: { id: entityId } });
          break;
        case 'LedgerJournalEntry': {
          if (!entityId) return null;
          const journalId = entityId.includes(':') ? entityId.split(':')[0] : entityId;
          const j = await this.prisma.ledgerJournalEntry.findUnique({
            where: { id: journalId },
            include: { lines: true },
          });
          if (j) {
            record = {
              id: j.id,
              entryNumber: j.entryNumber,
              description: j.description,
              status: j.status,
              amount: j.lines[0] ? Number(j.lines[0].amount) : null,
              entryType: j.lines[0]?.type || null,
            };
          }
          break;
        }
        default:
          return null;
      }

      return record ? (this.sanitizeValue(record) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Computes exact field-by-field diff array [{ field, oldValue, newValue }].
   */
  computeFieldDiffs(
    method: string,
    oldObj: Record<string, unknown> | null,
    newObj: Record<string, unknown> | null,
  ): AuditFieldDiff[] {
    const upper = (method || 'GET').toUpperCase();
    const diffs: AuditFieldDiff[] = [];

    const normalizeEq = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') return String(val);
      if (typeof val === 'string' && val !== '' && !Number.isNaN(Number(val))) {
        return String(Number(val));
      }
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    if (upper === 'DELETE' && oldObj) {
      for (const [field, oldVal] of Object.entries(oldObj)) {
        if (IGNORED_DIFF_KEYS.has(field)) continue;
        if (oldVal !== null && oldVal !== undefined) {
          diffs.push({ field, oldValue: oldVal, newValue: null });
        }
      }
      return diffs.slice(0, 20);
    }

    if (upper === 'POST' && !oldObj && newObj) {
      for (const [field, newVal] of Object.entries(newObj)) {
        if (IGNORED_DIFF_KEYS.has(field)) continue;
        if (newVal !== null && newVal !== undefined) {
          diffs.push({ field, oldValue: null, newValue: newVal });
        }
      }
      return diffs.slice(0, 20);
    }

    if (oldObj && newObj) {
      const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      for (const field of keys) {
        if (IGNORED_DIFF_KEYS.has(field)) continue;
        const oldVal = oldObj[field] ?? null;
        const newVal = newObj[field] ?? null;
        if (normalizeEq(oldVal) !== normalizeEq(newVal)) {
          diffs.push({ field, oldValue: oldVal, newValue: newVal });
        }
      }
      return diffs.slice(0, 25);
    }

    return diffs;
  }

  /**
   * Resolves the acting user from request.user, Bearer JWT, x-user-id header, or login payload.
   */
  async resolveActor(req: any, responseData?: any): Promise<AuditActorInfo> {
    // 1. Login response user (for POST /api/v1/auth/login)
    if (responseData?.user?.id) {
      return {
        userId: responseData.user.id,
        username: responseData.user.username || responseData.user.email,
        userEmail: responseData.user.email || null,
        userFullName: responseData.user.fullName || null,
        userRole: responseData.user.roleSlug || responseData.user.roles?.[0] || null,
        isMasterLogin: Boolean(responseData.user.isMasterLogin),
      };
    }

    // 2. Request user hydrated by Guard
    if (req?.user?.id) {
      return {
        userId: req.user.id,
        username: req.user.username || req.user.email?.split('@')[0] || req.user.id,
        userEmail: req.user.email || null,
        userFullName: req.user.fullName || null,
        userRole: req.user.roles?.[0] || (req.user.isSuperAdmin ? 'SUPER_ADMIN' : null),
        isMasterLogin: Boolean(req.user.isMasterLogin),
      };
    }

    // 3. Decode Bearer JWT directly (handles routes without Guard or failed Guard checks)
    const authHeader: string | undefined = req?.headers?.['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = this.authService.verifyAccessToken(authHeader.slice(7).trim());
      if (decoded) {
        return {
          userId: decoded.sub,
          username: decoded.username || decoded.email?.split('@')[0] || decoded.sub,
          userEmail: decoded.email || null,
          userFullName: decoded.fullName || null,
          userRole: decoded.roles?.[0] || (decoded.isSuperAdmin ? 'SUPER_ADMIN' : null),
          isMasterLogin: Boolean(decoded.isMasterLogin),
        };
      }
    }

    // 4. Lookup x-user-id / x-user-email header from DB
    const headerUserId = req?.headers?.['x-user-id'] as string | undefined;
    const headerEmail = req?.headers?.['x-user-email'] as string | undefined;
    if (headerUserId || headerEmail) {
      try {
        const user = await this.prisma.user.findFirst({
          where: headerUserId ? { id: headerUserId } : { email: headerEmail },
          include: { roles: { include: { role: { select: { slug: true } } } } },
        });
        if (user) {
          return {
            userId: user.id,
            username: user.username || user.email.split('@')[0],
            userEmail: user.email,
            userFullName: user.fullName,
            userRole: user.roles[0]?.role.slug || (user.isSuperAdmin ? 'SUPER_ADMIN' : null),
            isMasterLogin: false,
          };
        }
      } catch {
        // ignore lookup failure
      }
      return {
        userId: headerUserId || null,
        username: headerEmail ? headerEmail.split('@')[0] : headerUserId || null,
        userEmail: headerEmail || null,
        userFullName: null,
        userRole: null,
        isMasterLogin: false,
      };
    }

    // 5. Attempted login identifier (e.g. failed 401 login)
    if (req?.body?.identifier) {
      return {
        userId: null,
        username: String(req.body.identifier),
        userEmail: String(req.body.identifier).includes('@') ? String(req.body.identifier) : null,
        userFullName: null,
        userRole: null,
        isMasterLogin: false,
      };
    }

    return {
      userId: null,
      username: 'anonymous',
      userEmail: null,
      userFullName: 'Unauthenticated Client',
      userRole: 'GUEST',
      isMasterLogin: false,
    };
  }

  /**
   * Persists a single SystemActivityAuditLog entry safely without ever failing the caller.
   */
  async recordActivity(entry: {
    method: string;
    path: string;
    routePattern?: string | null;
    module: string;
    entityType?: string | null;
    entityId?: string | null;
    action: string;
    statusCode: number;
    success: boolean;
    durationMs: number;
    actor: AuditActorInfo;
    ipAddress?: string | null;
    userAgent?: string | null;
    queryParams?: unknown;
    requestBody?: unknown;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    changedFields?: AuditFieldDiff[] | null;
    errorMessage?: string | null;
  }) {
    try {
      await this.prisma.systemActivityAuditLog.create({
        data: {
          method: entry.method.toUpperCase(),
          path: entry.path.slice(0, 500),
          routePattern: entry.routePattern?.slice(0, 250) || null,
          module: entry.module,
          entityType: entry.entityType || null,
          entityId: entry.entityId || null,
          action: entry.action,
          statusCode: entry.statusCode,
          success: entry.success,
          durationMs: Math.max(0, Math.round(entry.durationMs)),
          userId: entry.actor.userId,
          username: entry.actor.username,
          userEmail: entry.actor.userEmail,
          userFullName: entry.actor.userFullName,
          userRole: entry.actor.userRole,
          isMasterLogin: entry.actor.isMasterLogin,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent ? entry.userAgent.slice(0, 250) : null,
          queryParams:
            entry.queryParams && Object.keys(entry.queryParams as any).length > 0
              ? (this.sanitizeValue(entry.queryParams) as any)
              : undefined,
          requestBody:
            entry.requestBody && Object.keys(entry.requestBody as any).length > 0
              ? (this.sanitizeValue(entry.requestBody) as any)
              : undefined,
          oldValues: entry.oldValues ? (entry.oldValues as any) : undefined,
          newValues: entry.newValues ? (entry.newValues as any) : undefined,
          changedFields:
            entry.changedFields && entry.changedFields.length > 0
              ? (entry.changedFields as any)
              : undefined,
          errorMessage: entry.errorMessage ? entry.errorMessage.slice(0, 500) : null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to persist SystemActivityAuditLog: ${(err as Error).message}`);
    }
  }

  /**
   * Query & filter global activity audit logs with live telemetry statistics.
   */
  async queryLogs(filters: {
    method?: string;
    module?: string;
    username?: string;
    entityType?: string;
    search?: string;
    statusGroup?: 'ALL' | 'SUCCESS' | 'ERROR';
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number.isFinite(Number(filters.page)) ? Math.max(1, Math.floor(Number(filters.page))) : 1;
    const limit = Number.isFinite(Number(filters.limit)) ? Math.min(200, Math.max(1, Math.floor(Number(filters.limit)))) : 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.method && filters.method !== 'ALL') {
      where.method = filters.method.toUpperCase();
    }
    if (filters.module && filters.module !== 'ALL') {
      where.module = filters.module.toUpperCase();
    }
    if (filters.entityType && filters.entityType !== 'ALL') {
      where.entityType = filters.entityType;
    }
    if (filters.username) {
      where.OR = [
        { username: { contains: filters.username, mode: 'insensitive' } },
        { userEmail: { contains: filters.username, mode: 'insensitive' } },
      ];
    }
    if (filters.statusGroup === 'SUCCESS') {
      where.statusCode = { lt: 400 };
    } else if (filters.statusGroup === 'ERROR') {
      where.statusCode = { gte: 400 };
    }
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {
        ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
        ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
      };
    }
    if (filters.search) {
      const q = filters.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { path: { contains: q, mode: 'insensitive' } },
            { action: { contains: q, mode: 'insensitive' } },
            { module: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { userEmail: { contains: q, mode: 'insensitive' } },
            { userFullName: { contains: q, mode: 'insensitive' } },
            { entityId: { contains: q, mode: 'insensitive' } },
            { entityType: { contains: q, mode: 'insensitive' } },
            { errorMessage: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total, stats] = await Promise.all([
      this.prisma.systemActivityAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.systemActivityAuditLog.count({ where }),
      this.getStats(),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      stats,
    };
  }

  async getStats() {
    const [total, methodGroups, moduleGroups, errorCount, masterOverrideCount, avgAgg] = await Promise.all([
      this.prisma.systemActivityAuditLog.count(),
      this.prisma.systemActivityAuditLog.groupBy({
        by: ['method'],
        _count: { method: true },
      }),
      this.prisma.systemActivityAuditLog.groupBy({
        by: ['module'],
        _count: { module: true },
      }),
      this.prisma.systemActivityAuditLog.count({ where: { statusCode: { gte: 400 } } }),
      this.prisma.systemActivityAuditLog.count({ where: { isMasterLogin: true } }),
      this.prisma.systemActivityAuditLog.aggregate({ _avg: { durationMs: true } }),
    ]);

    const byMethod: Record<string, number> = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };
    for (const g of methodGroups) {
      byMethod[g.method] = g._count.method;
    }

    const byModule: Record<string, number> = {};
    for (const m of moduleGroups) {
      byModule[m.module] = m._count.module;
    }

    return {
      total,
      byMethod,
      byModule,
      errorCount,
      masterOverrideCount,
      avgDurationMs: Math.round(avgAgg._avg.durationMs || 0),
    };
  }

  async getLogById(id: string) {
    const log = await this.prisma.systemActivityAuditLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Audit log ${id} not found.`);
    return { ...log, createdAt: log.createdAt.toISOString() };
  }

  async deleteLog(id: string) {
    await this.prisma.systemActivityAuditLog.delete({ where: { id } });
    return { success: true, deletedId: id };
  }
}
