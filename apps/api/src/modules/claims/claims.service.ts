import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimFsmService } from '../fsm/claim-fsm.service';
import { CreateClaimDto, TransitionClaimDto, AssignAdjusterDto } from './dto/claims.dto';
import { ClaimStatus } from '@omniclaim/database';

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
    const policy = await this.prisma.policy.findUnique({
      where: { id: dto.policyId },
    });

    if (!policy) {
      throw new NotFoundException(`Policy ${dto.policyId} not found.`);
    }

    if (!policy.isActive) {
      throw new BadRequestException(`Policy ${policy.policyNumber} is inactive or lapsed.`);
    }

    const claimNumber = this.generateClaimNumber();

    const claim = await this.prisma.claim.create({
      data: {
        claimNumber,
        policyId: dto.policyId,
        status: ClaimStatus.DRAFT,
        incidentDate: new Date(dto.incidentDate),
        incidentLatitude: dto.incidentLatitude,
        incidentLongitude: dto.incidentLongitude,
        incidentDescription: dto.incidentDescription,
        version: 0,
      },
      include: {
        policy: true,
      },
    });

    // Record creation transition log
    await this.prisma.claimTransitionLog.create({
      data: {
        claimId: claim.id,
        fromStatus: ClaimStatus.DRAFT,
        toStatus: ClaimStatus.DRAFT,
        reason: 'Claim initiated via intake portal',
        triggeredById: userId,
      },
    });

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
    const { status, search, skip = 0, take = 20 } = params;

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
}
