import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimFsmService } from '../fsm/claim-fsm.service';
import { LedgerService } from '../ledger/ledger.service';
import { ClaimStatus, FraudRiskTier } from '@omniclaim/database';

@Injectable()
export class StpRuleEngineService {
  private readonly logger = new Logger(StpRuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fsmService: ClaimFsmService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Evaluates if a claim qualifies for Straight-Through Processing (STP) fast-track auto-settlement.
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
      return { qualified: false, reason: 'Incomplete actuarial or fraud assessment' };
    }

    const { netPayout, isStpQualified } = claim.actuarialAssessment;
    const { compositeScore, riskTier } = claim.fraudScorecard;
    const discrepancyCount = claim.reconciliation?.discrepancyCount || 0;

    // STP Criteria Checklist:
    // 1. Net payout <= $750.00
    // 2. Fraud risk is strictly LOW (score < 15)
    // 3. Zero unverified / phantom items
    // 4. Policy is active
    const qualifies =
      isStpQualified &&
      riskTier === FraudRiskTier.LOW &&
      compositeScore < 15 &&
      discrepancyCount === 0 &&
      claim.policy.isActive;

    if (!qualifies) {
      this.logger.log(
        `Claim ${claim.claimNumber} did not qualify for STP. (Payout=${netPayout}, Score=${compositeScore}, Discrepancies=${discrepancyCount})`,
      );
      return {
        qualified: false,
        metrics: { netPayout, compositeScore, discrepancyCount },
      };
    }

    this.logger.log(`⚡ Fast-Tracking Claim ${claim.claimNumber} via Autonomous STP!`);

    // 1. Transition to APPROVED via FSM
    let version = claim.version;
    const approveResult = await this.fsmService.executeTransition({
      claimId,
      targetStatus: ClaimStatus.APPROVED,
      expectedVersion: version,
      userId: systemUserId,
      reason: 'Autonomous STP Auto-Approval: Clean damage verification & low risk score',
    });

    version = approveResult.newVersion;

    // 2. Post Balanced Double-Entry Settlement Ledger
    const ledgerResult = await this.ledgerService.recordClaimSettlementVouchers({
      claimId,
      settlementAmount: netPayout,
      payoutMethod: 'ACH',
      userId: systemUserId,
    });

    // 3. Transition to SETTLED via FSM
    await this.fsmService.executeTransition({
      claimId,
      targetStatus: ClaimStatus.SETTLED,
      expectedVersion: version,
      userId: systemUserId,
      reason: `Autonomous STP Auto-Settlement Voucher generated: ${ledgerResult.voucher.voucherNumber}`,
    });

    return {
      qualified: true,
      settlementVoucherNumber: ledgerResult.voucher.voucherNumber,
      netPayout,
    };
  }
}
