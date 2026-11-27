import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FraudRiskTier } from '@omniclaim/database';

@Injectable()
export class StpRuleEngineService {
  private readonly logger = new Logger(StpRuleEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if a claim qualifies for Straight-Through Processing (STP) recommendation.
   * Security invariant: AI / STP engine NEVER directly authorizes financial disbursement
   * or settles ledger entries — human finance authorization (`ledger:post` / `claims:settle`) is required.
   */
  async evaluateAndExecuteStp(claimId: string, systemUserId: string) {
    const claim = await this.prisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: {
        actuarialAssessment: true,
        fraudScorecard: true,
        reconciliation: true,
        policy: true,
      },
    });

    if (!claim.actuarialAssessment || !claim.fraudScorecard) {
      return {
        qualified: false,
        recommendation: 'MANUAL_REVIEW' as const,
        requiresHumanPaymentAuthorization: true,
        reason: 'Incomplete actuarial or fraud assessment',
      };
    }

    const { netPayout, isStpQualified } = claim.actuarialAssessment;
    const { compositeScore, riskTier } = claim.fraudScorecard;
    const discrepancyCount = claim.reconciliation?.discrepancyCount || 0;

    // STP Criteria Checklist:
    // 1. Net payout <= STP_MAX_PAYOUT
    // 2. Fraud risk is strictly LOW (score < 15)
    // 3. Zero unverified / phantom items
    // 4. Policy is active
    const qualifies =
      isStpQualified &&
      riskTier === FraudRiskTier.LOW &&
      compositeScore < 15 &&
      discrepancyCount === 0 &&
      claim.policy.isActive;

    const recommendation = qualifies ? ('STP_RECOMMENDED' as const) : ('MANUAL_REVIEW' as const);

    this.logger.log(
      `STP evaluation for Claim ${claim.claimNumber} (by ${systemUserId}): ${recommendation} (Payout=${netPayout}, Score=${compositeScore}, Discrepancies=${discrepancyCount}). Payment still requires human authorization.`,
    );

    return {
      qualified: qualifies,
      recommendation,
      requiresHumanPaymentAuthorization: true,
      metrics: { netPayout, compositeScore, discrepancyCount },
    };
  }
}
