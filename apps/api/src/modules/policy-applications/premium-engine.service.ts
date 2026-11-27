import { Injectable } from '@nestjs/common';
import { Prisma } from '@omniclaim/database';

export interface PremiumCalculationResult {
  basePremium: Prisma.Decimal;
  riskLoading: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalPremium: Prisma.Decimal;
  calculationBreakdownJson: Record<string, any>;
}

@Injectable()
export class PremiumEngineService {
  /**
   * Decimal-safe backend premium calculation using Prisma.Decimal.
   * Never trusts client-computed prices.
   */
  calculateQuote(params: {
    baseRateAnnual: Prisma.Decimal | number | string;
    defaultDeductible: Prisma.Decimal | number | string;
    requestedCoverage: Prisma.Decimal | number | string;
    requestedDeductible: Prisma.Decimal | number | string;
    termMonths: number;
    categoryCode: string;
    riskDetailsJson?: Record<string, any>;
    underwriterLoading?: Prisma.Decimal | number | string;
  }): PremiumCalculationResult {
    const baseRate = new Prisma.Decimal(params.baseRateAnnual);
    const defaultDeductible = new Prisma.Decimal(params.defaultDeductible);
    const coverage = new Prisma.Decimal(params.requestedCoverage);
    const deductible = new Prisma.Decimal(params.requestedDeductible);
    const termFactor = new Prisma.Decimal(params.termMonths).div(12);

    // Coverage scaling relative to $50,000 baseline
    const baselineCoverage = new Prisma.Decimal(50000);
    let coverageMultiplier = coverage.div(baselineCoverage);
    if (coverageMultiplier.lessThan('0.5')) {
      coverageMultiplier = new Prisma.Decimal('0.5');
    }

    const basePremium = baseRate
      .mul(coverageMultiplier)
      .mul(termFactor)
      .toDecimalPlaces(2);

    // Risk loading from category-specific underwriting factors + explicit underwriter loading
    let riskRatio = new Prisma.Decimal('0.00');
    const risk = params.riskDetailsJson || {};

    if (params.categoryCode === 'AUTO' && risk.vehicleYear) {
      const age = Math.max(0, new Date().getFullYear() - Number(risk.vehicleYear));
      if (age > 8) riskRatio = riskRatio.add('0.15');
      else if (age > 4) riskRatio = riskRatio.add('0.07');
    } else if (params.categoryCode === 'HEALTH' && risk.applicantAge) {
      const age = Number(risk.applicantAge);
      if (age >= 50) riskRatio = riskRatio.add('0.25');
      else if (age >= 35) riskRatio = riskRatio.add('0.10');
      if (risk.preExistingConditions) riskRatio = riskRatio.add('0.20');
    } else if (params.categoryCode === 'HOME' && risk.propertyAgeYears) {
      if (Number(risk.propertyAgeYears) > 25) riskRatio = riskRatio.add('0.12');
    } else if (params.categoryCode === 'LIFE' && risk.smoker) {
      riskRatio = riskRatio.add('0.30');
    } else if (params.categoryCode === 'TRAVEL' && risk.highRiskSports) {
      riskRatio = riskRatio.add('0.20');
    }

    const underwriterLoad = new Prisma.Decimal(params.underwriterLoading ?? 0);
    const riskLoading = basePremium.mul(riskRatio).add(underwriterLoad).toDecimalPlaces(2);

    // Higher deductible discount (up to 15% of basePremium)
    let discountAmount = new Prisma.Decimal('0.00');
    if (deductible.greaterThan(defaultDeductible)) {
      const extraDeductibleRatio = deductible.sub(defaultDeductible).div(5000);
      const cappedDiscountPct = Prisma.Decimal.min(new Prisma.Decimal('0.15'), extraDeductibleRatio.mul('0.10'));
      discountAmount = basePremium.mul(cappedDiscountPct).toDecimalPlaces(2);
    }

    const preTax = Prisma.Decimal.max(
      new Prisma.Decimal('25.00'),
      basePremium.add(riskLoading).sub(discountAmount),
    ).toDecimalPlaces(2);

    // 8% statutory insurance premium tax
    const taxRate = new Prisma.Decimal('0.08');
    const taxAmount = preTax.mul(taxRate).toDecimalPlaces(2);
    const totalPremium = preTax.add(taxAmount).toDecimalPlaces(2);

    return {
      basePremium,
      riskLoading,
      discountAmount,
      taxAmount,
      totalPremium,
      calculationBreakdownJson: {
        categoryCode: params.categoryCode,
        termMonths: params.termMonths,
        coverageAmount: coverage.toFixed(2),
        deductible: deductible.toFixed(2),
        basePremium: basePremium.toFixed(2),
        riskLoading: riskLoading.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxRatePct: '8.00',
        taxAmount: taxAmount.toFixed(2),
        totalPremium: totalPremium.toFixed(2),
      },
    };
  }
}
