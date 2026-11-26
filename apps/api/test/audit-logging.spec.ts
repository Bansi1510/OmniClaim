import { AuditService } from '../src/modules/audit/audit.service';

describe('Global Request & Field-Diff AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;
  let mockAuth: any;

  beforeEach(() => {
    mockPrisma = {
      systemActivityAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { durationMs: 22 } }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'u-1',
          username: 'sarah.jenkins',
          email: 'adjuster.senior@omniclaim.internal',
          fullName: 'Sarah Jenkins',
          isSuperAdmin: false,
          roles: [{ role: { slug: 'CLAIMS_ADJUSTER' } }],
        }),
      },
    };
    mockAuth = {
      verifyAccessToken: jest.fn().mockReturnValue(null),
    };
    service = new AuditService(mockPrisma, mockAuth);
  });

  it('classifies GET, POST, PUT, PATCH, DELETE routes into module, entityType, entityId & action', () => {
    expect(service.parseRouteContext('GET', '/api/v1/claims?status=APPROVED')).toMatchObject({
      module: 'CLAIMS',
      entityType: 'Claim',
      action: 'READ',
    });
    expect(service.parseRouteContext('POST', '/api/v1/super-admin/policies')).toMatchObject({
      module: 'POLICIES',
      entityType: 'Policy',
      action: 'CREATE_POLICY',
    });
    expect(service.parseRouteContext('PATCH', '/api/v1/super-admin/policies/pol-123')).toMatchObject({
      module: 'POLICIES',
      entityType: 'Policy',
      entityId: 'pol-123',
      action: 'UPDATE_POLICY',
    });
    expect(service.parseRouteContext('PUT', '/api/v1/super-admin/garages/grg-9')).toMatchObject({
      module: 'GARAGES',
      entityType: 'RepairGarage',
      entityId: 'grg-9',
      action: 'UPDATE_REPAIRGARAGE',
    });
    expect(service.parseRouteContext('DELETE', '/api/v1/super-admin/users/u-99')).toMatchObject({
      module: 'USERS',
      entityType: 'User',
      entityId: 'u-99',
      action: 'DELETE_USER',
    });
  });

  it('automatically redacts passwords, tokens, and secret settings during sanitization', () => {
    const minifiedDecimal = { s: 1, e: 4, d: [95000], toNumber: () => 95000, toFixed: () => '95000.00' };
    const sanitized = service.sanitizeValue({
      username: 'superadmin',
      coverageLimit: minifiedDecimal,
      password: 'PlaintextPassword!',
      newMasterPassword: 'SecretMasterKey!',
      nested: { accessToken: 'eyJhbGciOiJIUzI1NiJ9.xxx.yyy', safe: 'ok' },
      secretBlob: { sensitive: true },
      settingRow: { key: 'SUPER_MASTER_PASSWORD_HASH', valueType: 'SECRET', value: 'deadbeef' },
    }) as any;

    expect(sanitized.username).toBe('superadmin');
    expect(sanitized.coverageLimit).toBe(95000);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.newMasterPassword).toBe('[REDACTED]');
    expect(sanitized.nested.accessToken).toBe('[REDACTED]');
    expect(sanitized.nested.safe).toBe('ok');
    expect(sanitized.secretBlob).toBe('[REDACTED]');
    expect(sanitized.settingRow.value).toBe('[REDACTED]');
  });

  it('computes accurate field-by-field oldValue -> newValue diffs for POST, PATCH/PUT, and DELETE', () => {
    const updateDiffs = service.computeFieldDiffs(
      'PATCH',
      { coverageLimit: 50000, isActive: true, vehicleModel: 'Accord', updatedAt: '2026-01-01' },
      { coverageLimit: 82000, isActive: false, vehicleModel: 'Accord', updatedAt: '2026-01-02' },
    );
    expect(updateDiffs).toEqual([
      { field: 'coverageLimit', oldValue: 50000, newValue: 82000 },
      { field: 'isActive', oldValue: true, newValue: false },
    ]);

    const createDiffs = service.computeFieldDiffs('POST', null, { code: 'GRG-1', hourlyLaborRate: 115 });
    expect(createDiffs).toEqual([
      { field: 'code', oldValue: null, newValue: 'GRG-1' },
      { field: 'hourlyLaborRate', oldValue: null, newValue: 115 },
    ]);

    const deleteDiffs = service.computeFieldDiffs('DELETE', { code: 'GRG-1', city: 'Austin' }, null);
    expect(deleteDiffs).toEqual([
      { field: 'code', oldValue: 'GRG-1', newValue: null },
      { field: 'city', oldValue: 'Austin', newValue: null },
    ]);
  });

  it('resolves acting user from JWT, x-user-id header, or login payload', async () => {
    const fromHeader = await service.resolveActor({ headers: { 'x-user-id': 'u-1' } });
    expect(fromHeader).toMatchObject({
      userId: 'u-1',
      username: 'sarah.jenkins',
      userRole: 'CLAIMS_ADJUSTER',
    });

    const fromFailedLogin = await service.resolveActor({
      headers: {},
      body: { identifier: 'alex.rivera', password: 'bad' },
    });
    expect(fromFailedLogin.username).toBe('alex.rivera');
  });

  it('persists activity audit records cleanly with redacted payloads', async () => {
    await service.recordActivity({
      method: 'PATCH',
      path: '/api/v1/super-admin/policies/pol-1',
      module: 'POLICIES',
      entityType: 'Policy',
      entityId: 'pol-1',
      action: 'UPDATE_POLICY',
      statusCode: 200,
      success: true,
      durationMs: 31,
      actor: {
        userId: 'u-1',
        username: 'superadmin',
        userEmail: 'admin@omniclaim.internal',
        userFullName: 'Chief Enterprise Admin',
        userRole: 'SUPER_ADMIN',
        isMasterLogin: true,
      },
      ipAddress: '127.0.0.1',
      requestBody: { coverageLimit: 82000, password: 'secret' },
      oldValues: { coverageLimit: 50000 },
      newValues: { coverageLimit: 82000 },
      changedFields: [{ field: 'coverageLimit', oldValue: 50000, newValue: 82000 }],
    });

    expect(mockPrisma.systemActivityAuditLog.create).toHaveBeenCalledTimes(1);
    const saved = mockPrisma.systemActivityAuditLog.create.mock.calls[0][0].data;
    expect(saved.method).toBe('PATCH');
    expect(saved.username).toBe('superadmin');
    expect(saved.isMasterLogin).toBe(true);
    expect(saved.requestBody.password).toBe('[REDACTED]');
    expect(saved.changedFields).toEqual([{ field: 'coverageLimit', oldValue: 50000, newValue: 82000 }]);
  });
});
