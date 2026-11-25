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
    if (vehicleAgeYears < 1) return new Prisma.Decimal('0.00');
    if (vehicleAgeYears <= 2) return new Prisma.Decimal('0.10');
    if (vehicleAgeYears <= 3) return new Prisma.Decimal('0.20');
    if (vehicleAgeYears <= 4) return new Prisma.Decimal('0.30');
    if (vehicleAgeYears <= 5) return new Prisma.Decimal('0.40');
    return new Prisma.Decimal('0.50'); // 50% cap
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
      const metalRate = this.getMetalDepreciationRate(vehicleAge);
      const plasticRate = new Prisma.Decimal('0.50'); // Fixed 50%
      const glassRate = new Prisma.Decimal('0.00');   // Fixed 0%

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
          case MaterialType.RUBBER:
            plasticDep = plasticDep.add(item.approvedCost.mul(plasticRate));
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

      // Check STP qualification (minor claim under $750)
      const isStpQualified = netPayout.lessThanOrEqualTo(new Prisma.Decimal(750.00));

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
        },
      });

      this.logger.log(
        `Actuarial calculation completed for claim ${claimId}: GrossParts=${grossParts}, TotalDep=${totalDepreciation}, Labor=${laborApproved}, NetPayout=${netPayout}, STP=${isStpQualified}`,
      );

      return assessment;
    });
  }
}
