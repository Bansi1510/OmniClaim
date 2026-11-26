import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimFsmService } from '../fsm/claim-fsm.service';
import { CreateClaimDto, UpdateClaimDto, TransitionClaimDto, AssignAdjusterDto } from './dto/claims.dto';
import { ClaimStatus, FraudRiskTier } from '@omniclaim/database';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fsmService: ClaimFsmService,
  ) {}

  /**
   * Generates a readable, sequential claim number: CLM-YYYYMM-XXXX
   */
  private generateClaimNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `CLM-${dateStr}-${randomSuffix}`;
  }

  async createClaim(dto: CreateClaimDto, userId: string) {
    const policy = dto.policyId
      ? await this.prisma.policy.findUnique({ where: { id: dto.policyId } })
      : dto.policyNumber
        ? await this.prisma.policy.findUnique({ where: { policyNumber: dto.policyNumber } })
        : await this.prisma.policy.findFirst({ where: { isActive: true } });

    if (!policy) {
      throw new NotFoundException(`Policy ${dto.policyId || dto.policyNumber} not found.`);
    }

    if (!policy.isActive) {
      throw new BadRequestException(`Policy ${policy.policyNumber} is inactive or lapsed.`);
    }

    const claimNumber = this.generateClaimNumber();
    const actor = await this.prisma.user.findUnique({ where: { id: userId } })
      || await this.prisma.user.findFirst({ where: { isSuperAdmin: true } });

    const claim = await this.prisma.claim.create({
      data: {
        claimNumber,
        policyId: policy.id,
        status: dto.status || ClaimStatus.TRIAGE_PENDING,
        incidentDate: dto.incidentDate ? new Date(dto.incidentDate) : new Date(),
        incidentLatitude: dto.incidentLatitude ?? 37.7749,
        incidentLongitude: dto.incidentLongitude ?? -122.4194,
        incidentDescription: dto.incidentDescription || 'Submitted via OmniClaim Command Center',
        adjusterId: dto.adjusterId || actor?.id,
        version: 1,
      },
      include: {
        policy: true,
        adjuster: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (typeof dto.netPayout === 'number') {
      await this.prisma.actuarialAssessment.create({
        data: {
          claimId: claim.id,
          grossPartsTotal: dto.netPayout,
          metalDepreciation: 0,
          plasticDepreciation: 0,
          glassDepreciation: 0,
          totalDepreciation: 0,
          totalLaborApproved: 0,
          applicableDeductible: policy.baseDeductible,
          salvageValue: 0,
          netPayout: dto.netPayout,
          isStpQualified: dto.netPayout <= 750 && (dto.fraudScore ?? 0) < 15,
        },
      });
    }

    if (typeof dto.fraudScore === 'number') {
      const score = Math.min(100, Math.max(0, dto.fraudScore));
      const riskTier: FraudRiskTier =
        score >= 70
          ? FraudRiskTier.CRITICAL
          : score >= 45
            ? FraudRiskTier.HIGH
            : score >= 20
              ? FraudRiskTier.MEDIUM
              : FraudRiskTier.LOW;
      await this.prisma.fraudScorecard.create({
        data: {
          claimId: claim.id,
          compositeScore: score,
          riskTier,
        },
      });
    }

    // Record creation transition log
    if (actor) {
      await this.prisma.claimTransitionLog.create({
        data: {
          claimId: claim.id,
          fromStatus: ClaimStatus.DRAFT,
          toStatus: claim.status,
          reason: 'Claim initiated via intake portal',
          triggeredById: actor.id,
        },
      });
    }

    this.logger.log(`Created new claim ${claim.claimNumber} for policy ${policy.policyNumber}`);
    return claim;
  }

  async getClaimById(id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: {
        policy: true,
        adjuster: {
          select: { id: true, fullName: true, email: true },
        },
        evidences: {
          include: {
            damages: true,
          },
        },
        billDocuments: {
          include: {
            lineItems: {
              include: {
                reconciledItem: true,
              },
            },
          },
        },
        reconciliation: {
          include: {
            items: {
              include: {
                billLineItem: true,
              },
            },
          },
        },
        actuarialAssessment: true,
        fraudScorecard: {
          include: {
            indicators: true,
          },
        },
        transitionLogs: {
          include: {
            triggeredBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { timestamp: 'desc' },
        },
        activeLock: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException(`Claim ${id} not found.`);
    }

    return claim;
  }

  async listClaims(params: {
    status?: ClaimStatus;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const { status, search } = params;
    const skip = Number.isFinite(Number(params.skip)) ? Math.max(0, Math.floor(Number(params.skip))) : 0;
    const take = Number.isFinite(Number(params.take)) ? Math.min(100, Math.max(1, Math.floor(Number(params.take)))) : 20;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { claimNumber: { contains: search, mode: 'insensitive' } },
        { policy: { vehicleVin: { contains: search, mode: 'insensitive' } } },
        { policy: { policyNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.claim.findMany({
        where,
        include: {
          policy: true,
          adjuster: { select: { fullName: true } },
          fraudScorecard: { select: { compositeScore: true, riskTier: true } },
          actuarialAssessment: { select: { netPayout: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.claim.count({ where }),
    ]);

    return { total, items, skip, take };
  }

  async transitionClaim(claimId: string, dto: TransitionClaimDto, userId: string) {
    return this.fsmService.executeTransition({
      claimId,
      targetStatus: dto.targetStatus,
      expectedVersion: dto.expectedVersion,
      userId,
      reason: dto.reason,
    });
  }

  async assignAdjuster(claimId: string, dto: AssignAdjusterDto, currentUserId: string) {
    const adjuster = await this.prisma.user.findUnique({
      where: { id: dto.adjusterId },
    });
    if (!adjuster) {
      throw new NotFoundException(`Adjuster ${dto.adjusterId} does not exist.`);
    }

    const claim = await this.prisma.claim.update({
      where: { id: claimId },
      data: { adjusterId: dto.adjusterId },
    });

    await this.prisma.claimAuditLog.create({
      data: {
        claimId,
        userId: currentUserId,
        action: 'ASSIGN_ADJUSTER',
        fieldName: 'adjusterId',
        newValue: dto.adjusterId,
      },
    });

    return claim;
  }

  async acquireLock(claimId: string, userId: string) {
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60s lease

    return this.prisma.claimLock.upsert({
      where: { claimId },
      update: {
        userId,
        lockedAt: new Date(),
        expiresAt,
      },
      create: {
        claimId,
        userId,
        expiresAt,
      },
      include: {
        user: { select: { fullName: true, email: true } },
      },
    });
  }

  async releaseLock(claimId: string, userId: string) {
    await this.prisma.claimLock.deleteMany({
      where: { claimId, userId },
    });
    return { success: true };
  }

  async updateClaim(claimId: string, dto: UpdateClaimDto, userId: string) {
    const existing = await this.prisma.claim.findUnique({ where: { id: claimId }, include: { policy: true } });
    if (!existing) throw new NotFoundException(`Claim ${claimId} not found.`);

    const updated = await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        ...(dto.incidentDate ? { incidentDate: new Date(dto.incidentDate) } : {}),
        ...(dto.incidentLatitude !== undefined ? { incidentLatitude: dto.incidentLatitude } : {}),
        ...(dto.incidentLongitude !== undefined ? { incidentLongitude: dto.incidentLongitude } : {}),
        ...(dto.incidentDescription !== undefined ? { incidentDescription: dto.incidentDescription } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adjusterId !== undefined ? { adjusterId: dto.adjusterId } : {}),
        version: { increment: 1 },
      },
      include: { policy: true },
    });

    if (typeof dto.netPayout === 'number') {
      await this.prisma.actuarialAssessment.upsert({
        where: { claimId },
        update: { netPayout: dto.netPayout },
        create: {
          claimId,
          grossPartsTotal: dto.netPayout,
          metalDepreciation: 0,
          plasticDepreciation: 0,
          glassDepreciation: 0,
          totalDepreciation: 0,
          totalLaborApproved: 0,
          applicableDeductible: existing.policy.baseDeductible,
          salvageValue: 0,
          netPayout: dto.netPayout,
          isStpQualified: dto.netPayout <= 750,
        },
      });
    }

    if (typeof dto.fraudScore === 'number') {
      const score = Math.min(100, Math.max(0, dto.fraudScore));
      const riskTier: FraudRiskTier =
        score >= 70
          ? FraudRiskTier.CRITICAL
          : score >= 45
            ? FraudRiskTier.HIGH
            : score >= 20
              ? FraudRiskTier.MEDIUM
              : FraudRiskTier.LOW;
      await this.prisma.fraudScorecard.upsert({
        where: { claimId },
        update: { compositeScore: score, riskTier },
        create: { claimId, compositeScore: score, riskTier },
      });
    }

    const actor = await this.prisma.user.findUnique({ where: { id: userId } })
      || await this.prisma.user.findFirst({ where: { isSuperAdmin: true } });
    if (actor) {
      await this.prisma.claimAuditLog.create({
        data: {
          claimId,
          userId: actor.id,
          action: 'UPDATE_CLAIM',
          fieldName: dto.status ? 'status' : 'metadata',
          oldValue: existing.status,
          newValue: dto.status || JSON.stringify(dto),
        },
      });
    }

    return updated;
  }

  async deleteClaim(claimId: string) {
    const existing = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: { reconciliation: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException(`Claim ${claimId} not found.`);

    await this.prisma.$transaction(async (tx) => {
      // Detach any financial ledger journal entries to preserve double-entry history safely
      await tx.ledgerJournalEntry.updateMany({
        where: { claimId },
        data: { claimId: null },
      });
      // Remove reconciled line items first so BillLineItem cascades cleanly
      if (existing.reconciliation?.id) {
        await tx.reconciledLineItem.deleteMany({
          where: { summaryId: existing.reconciliation.id },
        });
      }
      await tx.claim.delete({ where: { id: claimId } });
    });

    return { success: true, deletedClaimId: claimId, claimNumber: existing.claimNumber };
  }
}
