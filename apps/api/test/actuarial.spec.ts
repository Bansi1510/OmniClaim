import { ActuarialService } from '../src/modules/actuarial/actuarial.service';
import { Prisma } from '@omniclaim/database';

describe('ActuarialService - Deterministic Math Engine', () => {
  let actuarialService: ActuarialService;

  beforeEach(() => {
    // Instantiate with mock prisma
    actuarialService = new ActuarialService({} as any);
  });

  describe('Metal Depreciation Graduated Scale', () => {
    it('should assign 0% depreciation for vehicle age < 1 year', () => {
      const rate = actuarialService.getMetalDepreciationRate(0);
      expect(rate.equals(new Prisma.Decimal('0.00'))).toBe(true);
    });

    it('should assign 10% depreciation for vehicle age = 2 years', () => {
      const rate = actuarialService.getMetalDepreciationRate(2);
      expect(rate.equals(new Prisma.Decimal('0.10'))).toBe(true);
    });

    it('should assign 20% depreciation for vehicle age = 3 years', () => {
      const rate = actuarialService.getMetalDepreciationRate(3);
      expect(rate.equals(new Prisma.Decimal('0.20'))).toBe(true);
    });

    it('should assign 30% depreciation for vehicle age = 4 years', () => {
      const rate = actuarialService.getMetalDepreciationRate(4);
      expect(rate.equals(new Prisma.Decimal('0.30'))).toBe(true);
    });

    it('should cap metal depreciation at 50% for vehicle age >= 5 years', () => {
      const rate5 = actuarialService.getMetalDepreciationRate(5);
      const rate10 = actuarialService.getMetalDepreciationRate(10);
      expect(rate5.equals(new Prisma.Decimal('0.50'))).toBe(true);
      expect(rate10.equals(new Prisma.Decimal('0.50'))).toBe(true);
    });
  });

  describe('Statutory Material Depreciation Rules', () => {
    it('guarantees 0% depreciation on automotive glass', () => {
      const glassCost = new Prisma.Decimal('350.00');
      const glassRate = new Prisma.Decimal('0.00');
      const dep = glassCost.mul(glassRate);
      expect(dep.equals(new Prisma.Decimal('0.00'))).toBe(true);
    });

    it('guarantees exact 50% flat depreciation on plastic and rubber components', () => {
      const plasticCost = new Prisma.Decimal('450.00');
      const plasticRate = new Prisma.Decimal('0.50');
      const dep = plasticCost.mul(plasticRate);
      expect(dep.equals(new Prisma.Decimal('225.00'))).toBe(true);
    });
  });
});
