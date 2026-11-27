import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimStatus, Prisma } from '@omniclaim/database';

@Injectable()
export class ClaimFsmService {
  private readonly logger = new Logger(ClaimFsmService.name);

  // Deterministic transition matrix defining legal paths
  private readonly allowedTransitions: Record<ClaimStatus, ClaimStatus[]> = {
    [ClaimStatus.DRAFT]: [ClaimStatus.SUBMITTED],
    [ClaimStatus.SUBMITTED]: [ClaimStatus.AI_PROCESSING],
    [ClaimStatus.AI_PROCESSING]: [
      ClaimStatus.TRIAGE_PENDING,
      ClaimStatus.AI_ANALYSIS_FAILED,
    ],
    [ClaimStatus.AI_ANALYSIS_FAILED]: [ClaimStatus.MANUAL_REVIEW],
    [ClaimStatus.TRIAGE_PENDING]: [
      ClaimStatus.MANUAL_REVIEW,
      ClaimStatus.APPROVED,
      ClaimStatus.REJECTED,
    ],
    [ClaimStatus.MANUAL_REVIEW]: [ClaimStatus.APPROVED, ClaimStatus.REJECTED],
    [ClaimStatus.APPROVED]: [
      ClaimStatus.PAYMENT_PENDING,
      ClaimStatus.SETTLED,
      ClaimStatus.DISPUTED,
    ],
    [ClaimStatus.PAYMENT_PENDING]: [
      ClaimStatus.SETTLED,
      ClaimStatus.PAYMENT_FAILED,
    ],
    [ClaimStatus.PAYMENT_FAILED]: [
      ClaimStatus.PAYMENT_PENDING,
      ClaimStatus.MANUAL_REVIEW,
    ],
    [ClaimStatus.SETTLED]: [ClaimStatus.REOPENED, ClaimStatus.DISPUTED],
    [ClaimStatus.REJECTED]: [ClaimStatus.REOPENED, ClaimStatus.DISPUTED],
    [ClaimStatus.DISPUTED]: [
      ClaimStatus.MANUAL_REVIEW,
      ClaimStatus.APPROVED,
      ClaimStatus.REJECTED,
    ],
    [ClaimStatus.REOPENED]: [
      ClaimStatus.MANUAL_REVIEW,
      ClaimStatus.TRIAGE_PENDING,
    ],
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if a proposed transition is legal according to the FSM matrix.
   */
  isTransitionAllowed(from: ClaimStatus, to: ClaimStatus): boolean {
    const targets = this.allowedTransitions[from] || [];
    return targets.includes(to);
  }

  /**
   * Executes an atomic state transition protected by Optimistic Concurrency Control (OCC).
   */
  async executeTransition(params: {
    claimId: string;
    targetStatus: ClaimStatus;
    expectedVersion: number;
    userId: string;
    reason: string;
    tx?: Prisma.TransactionClient;
  }) {
    const { claimId, targetStatus, expectedVersion, userId, reason, tx: outerTx } = params;

    const run = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch current status & version
      const claim = await tx.claim.findUnique({
        where: { id: claimId },
        select: { id: true, status: true, version: true, claimNumber: true },
      });

      if (!claim) {
        throw new BadRequestException(`Claim with ID ${claimId} does not exist.`);
      }

      // 2. Validate FSM Legal Transition
      if (!this.isTransitionAllowed(claim.status, targetStatus)) {
        throw new BadRequestException(
          `Illegal state transition: Cannot move claim ${claim.claimNumber} from '${claim.status}' to '${targetStatus}'.`,
        );
      }

      // 3. Optimistic Concurrency Check: Update where version matches expectedVersion
      const updateResult = await tx.claim.updateMany({
        where: {
          id: claimId,
          version: expectedVersion,
        },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
      });

      // If count is 0, another concurrent adjuster modified the claim version first
      if (updateResult.count === 0) {
        this.logger.warn(
          `Optimistic concurrency conflict on claim ${claimId}. Expected version: ${expectedVersion}, actual DB version: ${claim.version}`,
        );
        throw new ConflictException(
          `Conflict on claim ${claim.claimNumber}: The record was modified by another adjuster. Please refresh and retry.`,
        );
      }

      // 4. Record Immutable Transition Audit Log
      const log = await tx.claimTransitionLog.create({
        data: {
          claimId,
          fromStatus: claim.status,
          toStatus: targetStatus,
          reason,
          triggeredById: userId,
        },
      });

      this.logger.log(
        `Claim ${claim.claimNumber} successfully transitioned from ${claim.status} -> ${targetStatus} (New Version: ${expectedVersion + 1}) by ${userId}`,
      );

      return {
        success: true,
        claimId,
        previousStatus: claim.status,
        newStatus: targetStatus,
        newVersion: expectedVersion + 1,
        transitionLogId: log.id,
      };
    };

    return outerTx ? run(outerTx) : await this.prisma.$transaction(run);
  }
}
