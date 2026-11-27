import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, MaterialType } from '@omniclaim/database';

@Injectable()
export class ActuarialService {
  private readonly logger = new Logger(ActuarialService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministic age-graduated depreciation schedule for sheet metal parts.
   */
  getMetalDepreciationRate(vehicleAgeYears: number): Prisma.Decimal {
    if (vehicleAgeYears <= 1) return new Prisma.Decimal('0.00');
    if (vehicleAgeYears <= 2) return new Prisma.Decimal('0.10');
    if (vehicleAgeYears <= 3) return new Prisma.Decimal('0.20');
    if (vehicleAgeYears <= 4) return new Prisma.Decimal('0.30');
    return new Prisma.Decimal('0.50'); // 50% cap for >= 5 years
  }

  /**
   * Computes deterministic net payout with strict arbitrary-precision decimals.
   */
  async computeNetPayout(claimId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUniqueOrThrow({
        where: { id: claimId },
        include: {
          policy: true,
          reconciliation: {
            include: {
              items: {
                include: { billLineItem: true },
              },
            },
          },
        },
      });

      const currentYear = new Date().getFullYear();
      const vehicleAge = Math.max(0, currentYear - claim.policy.vehicleYear);

      // Load active versioned DB depreciation rules & STP payout setting (fallback to statutory schedule)
      const [dbRules, stpSetting] = await Promise.all([
        tx.depreciationRule.findMany({
          where: { isActive: true },
          orderBy: { priority: 'asc' },
        }),
        tx.systemSetting.findUnique({ where: { key: 'STP_MAX_PAYOUT' } }),
      ]);

      const resolveRate = (material: MaterialType, fallbackRate: Prisma.Decimal): Prisma.Decimal => {
        const matched = dbRules.find(
          (r) =>
            r.materialType === material &&
            vehicleAge >= r.minVehicleAgeYears &&
            vehicleAge <= r.maxVehicleAgeYears,
        );
        if (matched) {
          return new Prisma.Decimal(matched.depreciationPercent).div(100);
        }
        return fallbackRate;
      };

      const metalRate = resolveRate(MaterialType.METAL, this.getMetalDepreciationRate(vehicleAge));
      const plasticRate = resolveRate(MaterialType.PLASTIC, new Prisma.Decimal('0.50'));
      const rubberRate = resolveRate(MaterialType.RUBBER, new Prisma.Decimal('0.50'));
      const glassRate = resolveRate(MaterialType.GLASS, new Prisma.Decimal('0.00'));
      const stpMaxPayout = new Prisma.Decimal(stpSetting?.value || '750.00');

      const ruleSnapshotJson = {
        vehicleAge,
        rates: {
          METAL: metalRate.toString(),
          PLASTIC: plasticRate.toString(),
          RUBBER: rubberRate.toString(),
          GLASS: glassRate.toString(),
        },
        stpMaxPayout: stpMaxPayout.toString(),
        matchedRuleIds: dbRules.map((r) => r.id),
      };

      let grossParts = new Prisma.Decimal(0);
      let metalDep = new Prisma.Decimal(0);
      let plasticDep = new Prisma.Decimal(0);
      let glassDep = new Prisma.Decimal(0);
      let laborApproved = new Prisma.Decimal(0);

      for (const item of claim.reconciliation?.items || []) {
        if (!item.isVerifiedByDamage) continue;

        const raw = item.billLineItem;
        if (raw.isLabor) {
          laborApproved = laborApproved.add(item.approvedCost);
          continue;
        }

        grossParts = grossParts.add(item.approvedCost);

        switch (raw.materialType) {
          case MaterialType.GLASS:
            glassDep = glassDep.add(item.approvedCost.mul(glassRate));
            break;
          case MaterialType.PLASTIC:
            plasticDep = plasticDep.add(item.approvedCost.mul(plasticRate));
            break;
          case MaterialType.RUBBER:
            plasticDep = plasticDep.add(item.approvedCost.mul(rubberRate));
            break;
          case MaterialType.METAL:
          default:
            metalDep = metalDep.add(item.approvedCost.mul(metalRate));
            break;
        }
      }

      const totalDepreciation = metalDep.add(plasticDep).add(glassDep);
      const netParts = grossParts.sub(totalDepreciation);
      const grossPayable = netParts.add(laborApproved);

      // Deductible and Sub-Limits
      const deductible = claim.policy.baseDeductible;
      const salvageValue = new Prisma.Decimal(0);

      // Net Payout cannot be negative
      let netPayout = grossPayable.sub(deductible).sub(salvageValue);
      if (netPayout.lessThan(0)) {
        netPayout = new Prisma.Decimal(0);
      }

      // Cap at policy coverage limit
      if (netPayout.greaterThan(claim.policy.coverageLimit)) {
        netPayout = claim.policy.coverageLimit;
      }

      // Check STP qualification against dynamic STP_MAX_PAYOUT setting
      const isStpQualified = netPayout.lessThanOrEqualTo(stpMaxPayout);

      const assessment = await tx.actuarialAssessment.upsert({
        where: { claimId },
        create: {
          claimId,
          grossPartsTotal: grossParts,
          metalDepreciation: metalDep,
          plasticDepreciation: plasticDep,
          glassDepreciation: glassDep,
          totalDepreciation,
          totalLaborApproved: laborApproved,
          applicableDeductible: deductible,
          salvageValue,
          netPayout,
          isStpQualified,
          ruleVersion: 'v1-db-rules',
          ruleSnapshotJson,
        },
        update: {
          grossPartsTotal: grossParts,
          metalDepreciation: metalDep,
          plasticDepreciation: plasticDep,
          glassDepreciation: glassDep,
          totalDepreciation,
          totalLaborApproved: laborApproved,
          applicableDeductible: deductible,
          salvageValue,
          netPayout,
          isStpQualified,
          ruleVersion: 'v1-db-rules',
          ruleSnapshotJson,
        },
      });

      this.logger.log(
        `Actuarial calculation completed for claim ${claimId}: GrossParts=${grossParts}, TotalDep=${totalDepreciation}, Labor=${laborApproved}, NetPayout=${netPayout}, STP=${isStpQualified}`,
      );

      return assessment;
    });
  }
}
