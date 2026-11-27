import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { DynamicPermissionsGuard } from '../src/common/guards/dynamic-permissions.guard';

describe('Super Master Password Auth & Super Admin Guard Bypass', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let settingsStore: Record<string, string>;
  let auditEvents: any[];

  beforeEach(() => {
    settingsStore = {
      SUPER_MASTER_PASSWORD_ENABLED: 'true',
    };
    auditEvents = [];

    mockPrisma = {
      systemSetting: {
        findUnique: jest.fn(({ where: { key } }) =>
          settingsStore[key] ? Promise.resolve({ key, value: settingsStore[key] }) : Promise.resolve(null),
        ),
        upsert: jest.fn(({ where: { key }, update, create }) => {
          settingsStore[key] = update?.value ?? create?.value;
          return Promise.resolve({ key, value: settingsStore[key] });
        }),
      },
      securityAuditLog: {
        create: jest.fn(({ data }) => {
          auditEvents.push(data);
          return Promise.resolve({ id: `aud-${auditEvents.length}`, ...data });
        }),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    authService = new AuthService(mockPrisma);
    // Store initial hashed master password
    settingsStore['SUPER_MASTER_PASSWORD_HASH'] = authService.hashMasterPassword('OmniMaster#2026!');
  });

  it('allows Super Admin to enter ANY username using the Super Master Password with full bypass', async () => {
    const adjusterPasswordHash = authService.hashUserPassword('AdjusterPrivatePwd!');
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-adj-1',
      username: 'sarah.jenkins',
      email: 'adjuster.senior@omniclaim.internal',
      fullName: 'Sarah Jenkins',
      passwordHash: adjusterPasswordHash,
      isActive: true,
      isSuperAdmin: false,
      roles: [
        {
          role: {
            slug: 'CLAIMS_ADJUSTER',
            permissions: [{ permission: { slug: 'claims:read' } }],
          },
        },
      ],
    });

    const result = await authService.login({
      identifier: 'sarah.jenkins',
      password: 'OmniMaster#2026!',
      platform: 'WEB',
    });

    expect(result.authMethod).toBe('SUPER_MASTER_PASSWORD');
    expect(result.user.username).toBe('sarah.jenkins');
    expect(result.user.isMasterLogin).toBe(true);
    expect(result.user.bypassAllPermissions).toBe(true);
    expect(result.user.permissions).toContain('*');

    // Verify signed JWT decodes cleanly
    const decoded = authService.verifyAccessToken(result.accessToken);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('u-adj-1');
    expect(decoded?.isMasterLogin).toBe(true);
    expect(decoded?.bypassAllPermissions).toBe(true);

    // Verify audit event recorded
    expect(auditEvents[0].eventType).toBe('LOGIN_SUPER_MASTER_PASSWORD');
  });

  it('supports dynamically rotating the Super Master Password at runtime', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-pol-1',
      username: 'alex.rivera',
      email: 'policyholder.demo@omniclaim.internal',
      fullName: 'Alex Rivera',
      passwordHash: authService.hashUserPassword('UserSecret123!'),
      isActive: true,
      isSuperAdmin: false,
      roles: [{ role: { slug: 'POLICYHOLDER', permissions: [] } }],
    });

    // Rotate master password dynamically
    await authService.rotateSuperMasterPassword(
      { newMasterPassword: 'RotatedUltraMaster#2027!', enabled: true },
      'admin@omniclaim.internal',
    );

    // Old master password must now fail
    await expect(
      authService.login({ identifier: 'alex.rivera', password: 'OmniMaster#2026!' }),
    ).rejects.toThrow(UnauthorizedException);

    // New rotated master password must succeed
    const res = await authService.login({
      identifier: 'alex.rivera',
      password: 'RotatedUltraMaster#2027!',
      platform: 'MOBILE',
    });

    expect(res.authMethod).toBe('SUPER_MASTER_PASSWORD');
    expect(res.user.username).toBe('alex.rivera');
    expect(res.user.bypassAllPermissions).toBe(true);
  });

  it('respects dynamic disable toggle for Super Master Password while preserving normal logins', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-pol-2',
      username: 'alex.rivera',
      email: 'policyholder.demo@omniclaim.internal',
      fullName: 'Alex Rivera',
      passwordHash: authService.hashUserPassword('RegularUserPass!'),
      isActive: true,
      isSuperAdmin: false,
      roles: [{ role: { slug: 'POLICYHOLDER', permissions: [{ permission: { slug: 'claims:read' } }] } }],
    });

    settingsStore['SUPER_MASTER_PASSWORD_ENABLED'] = 'false';

    // Master password rejected when disabled
    await expect(
      authService.login({ identifier: 'alex.rivera', password: 'OmniMaster#2026!' }),
    ).rejects.toThrow(UnauthorizedException);

    // Regular user password still works cleanly
    const res = await authService.login({
      identifier: 'alex.rivera',
      password: 'RegularUserPass!',
    });
    expect(res.authMethod).toBe('PASSWORD');
    expect(res.user.isMasterLogin).toBe(false);
    expect(res.user.bypassAllPermissions).toBe(false);
  });

  it('DynamicPermissionsGuard skips ALL permission checks for Super Admin and Master Password Bearer tokens', async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['superadmin:access', 'nuclear:launch', 'ledger:override']),
    } as any;
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as any;

    const guard = new DynamicPermissionsGuard(mockReflector, mockRedis, mockPrisma);

    const masterToken = authService.signAccessToken({
      sub: 'u-pol-1',
      username: 'alex.rivera',
      email: 'policyholder.demo@omniclaim.internal',
      fullName: 'Alex Rivera',
      roles: ['POLICYHOLDER'],
      isSuperAdmin: false,
      isMasterLogin: true,
      bypassAllPermissions: true,
    });

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: `Bearer ${masterToken}` },
        }),
      }),
    } as any;

    // Master token skips ALL permission checks unconditionally!
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);

    // Regular restricted token without those permissions must be rejected
    const restrictedToken = authService.signAccessToken({
      sub: 'u-pol-1',
      username: 'alex.rivera',
      email: 'policyholder.demo@omniclaim.internal',
      fullName: 'Alex Rivera',
      roles: ['POLICYHOLDER'],
      isSuperAdmin: false,
      isMasterLogin: false,
      bypassAllPermissions: false,
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u-pol-1',
      isSuperAdmin: false,
      roles: [{ role: { slug: 'POLICYHOLDER', permissions: [{ permission: { slug: 'claims:read' } }] } }],
    });

    const restrictedContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: `Bearer ${restrictedToken}` },
        }),
      }),
    } as any;

    await expect(guard.canActivate(restrictedContext)).rejects.toThrow(ForbiddenException);

    // Spoofed x-user-id header without Bearer JWT MUST be rejected with UnauthorizedException
    const spoofedHeaderContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-user-id': 'admin-seed-uuid' },
        }),
      }),
    } as any;

    await expect(guard.canActivate(spoofedHeaderContext)).rejects.toThrow(UnauthorizedException);
  });
});
