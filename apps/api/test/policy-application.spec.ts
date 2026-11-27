import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@omniclaim/database';
import { PremiumEngineService } from '../src/modules/policy-applications/premium-engine.service';
import { PolicyApplicationsService } from '../src/modules/policy-applications/policy-applications.service';

describe('Policy Application, Decimal Premium Engine, Underwriting & Issuance', () => {
  it('computes decimal-safe premium breakdown accurately including tax and deductible discount', () => {
    const engine = new PremiumEngineService();
    const quote = engine.calculateQuote({
      baseRateAnnual: new Prisma.Decimal('1000.00'),
      defaultDeductible: new Prisma.Decimal('500.00'),
      requestedCoverage: new Prisma.Decimal('100000.00'),
      requestedDeductible: new Prisma.Decimal('500.00'),
      termMonths: 12,
      categoryCode: 'AUTO',
      riskDetailsJson: { vehicleYear: new Date().getFullYear() },
      underwriterLoading: 0,
    });

    // Coverage 100k vs 50k baseline = 2x baseRate -> $2000.00 + 8% tax ($160.00) = $2160.00
    expect(quote.basePremium.equals(new Prisma.Decimal('2000.00'))).toBe(true);
    expect(quote.taxAmount.equals(new Prisma.Decimal('160.00'))).toBe(true);
    expect(quote.totalPremium.equals(new Prisma.Decimal('2160.00'))).toBe(true);
  });

  it('enforces customer ownership on getApplication when a different policyholder requests it', async () => {
    const mockPrisma: any = {
      policyApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          applicantUserId: 'owner-uuid',
          product: { category: { code: 'AUTO' } },
          documents: [],
          quotes: [],
          underwritingReviews: [],
          payments: [],
        }),
      },
    };
    const service = new PolicyApplicationsService(mockPrisma, new PremiumEngineService());

    await expect(
      service.getApplication('app-1', {
        id: 'other-user-uuid',
        permissions: ['policies:read'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('guarantees idempotent payment replay prevention without creating duplicate Policy rows', async () => {
    const existingPayment = { id: 'pay-1', idempotencyKey: 'POLPAY-app-1', status: 'SUCCEEDED' };
    const existingPolicy = { id: 'pol-1', policyNumber: 'POL-AUTO-202611-12345' };

    const mockTx: any = {
      policyPayment: {
        findUnique: jest.fn().mockResolvedValue(existingPayment),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      policy: {
        findUnique: jest.fn().mockResolvedValue(existingPolicy),
        create: jest.fn(),
      },
    };

    const mockPrisma: any = {
      policyApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          applicantUserId: 'user-1',
          status: 'ISSUED',
          issuedPolicyId: 'pol-1',
          product: { category: { code: 'AUTO' } },
          documents: [],
          quotes: [],
          underwritingReviews: [],
          payments: [existingPayment],
        }),
      },
      $transaction: jest.fn((cb) => cb(mockTx)),
    };

    const service = new PolicyApplicationsService(mockPrisma, new PremiumEngineService());
    const result = await service.payAndIssuePolicy(
      'app-1',
      { paymentMethod: 'CARD', idempotencyKey: 'POLPAY-app-1' },
      { id: 'user-1', permissions: ['policies:apply'] },
    );

    expect(result.idempotentReplay).toBe(true);
    expect(mockTx.policyPayment.create).not.toHaveBeenCalled();
    expect(mockTx.policy.create).not.toHaveBeenCalled();
    expect(result.policy?.policyNumber).toBe('POL-AUTO-202611-12345');
  });

  it('transitions SUBMITTED -> QUOTED on underwriting APPROVED and REJECTED on DECLINED', async () => {
    const mockTx: any = {
      underwritingReview: { create: jest.fn().mockResolvedValue({ id: 'uw-1' }) },
      insuranceQuote: { create: jest.fn().mockResolvedValue({ id: 'qt-1', totalPremium: new Prisma.Decimal('1080.00') }) },
      policyApplication: {
        update: jest.fn(({ data }) => Promise.resolve({ id: 'app-1', status: data.status })),
      },
    };
    const mockPrisma: any = {
      policyApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          applicationNumber: 'APP-202611-0001',
          status: 'SUBMITTED',
          requestedCoverage: new Prisma.Decimal('50000.00'),
          requestedDeductible: new Prisma.Decimal('500.00'),
          termMonths: 12,
          riskDetailsJson: { vehicleYear: new Date().getFullYear() },
          product: {
            baseRateAnnual: new Prisma.Decimal('1000.00'),
            defaultDeductible: new Prisma.Decimal('500.00'),
            category: { code: 'AUTO' },
          },
        }),
      },
      $transaction: jest.fn((cb) => cb(mockTx)),
    };

    const service = new PolicyApplicationsService(mockPrisma, new PremiumEngineService());

    const approved = await service.submitUnderwritingDecision(
      'app-1',
      { decision: 'APPROVED', riskScore: 15, premiumLoading: 0 },
      'uw-user-1',
    );
    expect(approved.application.status).toBe('QUOTED');
    expect(approved.quote?.id).toBe('qt-1');

    const declined = await service.submitUnderwritingDecision(
      'app-1',
      { decision: 'DECLINED', riskScore: 95, notes: 'High fraud risk' },
      'uw-user-1',
    );
    expect(declined.application.status).toBe('REJECTED');
  });

  it('rejects cross-category VehicleType assignment on upsertProduct and vehicleType mismatch on createDraft', async () => {
    const mockPrisma: any = {
      policyCategory: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cat-auto', code: 'AUTO', name: 'Auto & Motor' }),
      },
      vehicleType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'vt-other', categoryId: 'cat-health', name: 'Other Type' }),
      },
      policyProduct: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prd-bike',
          name: 'Bike Basic',
          isActive: true,
          version: 1,
          minCoverageAmount: new Prisma.Decimal('5000'),
          maxCoverageAmount: new Prisma.Decimal('35000'),
          vehicleTypeId: 'vt-bike',
        }),
      },
    };
    const service = new PolicyApplicationsService(mockPrisma, new PremiumEngineService());

    await expect(
      service.upsertProduct({
        productCode: 'PRD-BAD',
        categoryCode: 'AUTO',
        vehicleTypeId: 'vt-other',
        name: 'Bad Cross Category',
        description: 'Should fail validation',
        baseRateAnnual: 500,
        minCoverageAmount: 10000,
        maxCoverageAmount: 50000,
        defaultDeductible: 500,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createDraft(
        {
          productId: 'prd-bike',
          vehicleTypeId: 'vt-car',
          requestedCoverage: 15000,
          requestedDeductible: 500,
          termMonths: 12,
          applicantDetailsJson: { fullName: 'Test' },
          riskDetailsJson: { vehicleMake: 'Yamaha' },
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
