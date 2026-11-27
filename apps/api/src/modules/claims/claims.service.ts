import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimFsmService } from '../fsm/claim-fsm.service';
import {
  CreateClaimDto,
  UpdateClaimDto,
  TransitionClaimDto,
  AssignAdjusterDto,
  CreateClaimSupplementDto,
  ReopenClaimDto,
  CaptureEvidenceDto,
  StaffExceptionEvidenceDto,
} from './dto/claims.dto';
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
    policyHolderId?: string;
    skip?: number;
    take?: number;
  }) {
    const { status, search, policyHolderId } = params;
    const skip = Number.isFinite(Number(params.skip)) ? Math.max(0, Math.floor(Number(params.skip))) : 0;
    const take = Number.isFinite(Number(params.take)) ? Math.min(100, Math.max(1, Math.floor(Number(params.take)))) : 20;

    const where: any = {};
    if (status) where.status = status;
    if (policyHolderId) {
      where.policy = { policyHolderId };
    }
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

  async createSupplement(claimId: string, dto: CreateClaimSupplementDto, userId: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) {
      throw new NotFoundException(`Claim ${claimId} not found.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const supplement = await tx.claimSupplement.create({
        data: {
          claimId,
          type: dto.type,
          status: 'OPEN',
          requestedAmount: dto.requestedAmount ?? 0,
          reason: dto.reason,
          createdById: userId,
        },
      });

      if (
        (dto.type === 'DISPUTE' || dto.type === 'APPEAL') &&
        this.fsmService.isTransitionAllowed(claim.status, ClaimStatus.DISPUTED)
      ) {
        await this.fsmService.executeTransition({
          claimId,
          targetStatus: ClaimStatus.DISPUTED,
          expectedVersion: claim.version,
          userId,
          reason: `${dto.type}: ${dto.reason}`,
          tx,
        });
      }

      return supplement;
    });
  }

  async reopenClaim(claimId: string, dto: ReopenClaimDto, userId: string) {
    return this.fsmService.executeTransition({
      claimId,
      targetStatus: ClaimStatus.REOPENED,
      expectedVersion: dto.expectedVersion,
      userId,
      reason: dto.reason,
    });
  }

  private readonly maxEvidenceBytes = 8 * 1024 * 1024;
  private readonly evidenceRootDir = path.resolve(process.cwd(), 'uploads', 'evidence');

  /**
   * Validates raw decoded bytes against JPEG / PNG / WEBP magic headers, enforces max size,
   * computes SHA-256 checksum, and writes securely into local object storage directory.
   */
  private parseAndStoreImageBuffer(claimId: string, evidenceId: string, base64Input: string) {
    const cleanBase64 = base64Input.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    if (!cleanBase64) {
      throw new BadRequestException('Image payload cannot be empty.');
    }

    const buf = Buffer.from(cleanBase64, 'base64');
    if (buf.length < 16) {
      throw new BadRequestException('Invalid or corrupted image file.');
    }
    if (buf.length > this.maxEvidenceBytes) {
      throw new BadRequestException('Image exceeds maximum allowed size of 8 MB.');
    }

    let detectedMime: string | null = null;
    let ext = 'bin';

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      detectedMime = 'image/jpeg';
      ext = 'jpg';
    } else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      detectedMime = 'image/png';
      ext = 'png';
    } else if (
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      detectedMime = 'image/webp';
      ext = 'webp';
    }

    if (!detectedMime) {
      throw new BadRequestException(
        'Unsupported or spoofed image format. Only valid JPEG, PNG, or WEBP camera images are accepted.',
      );
    }

    const checksumSha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const safeClaimDir = path.basename(claimId);
    const claimDir = path.join(this.evidenceRootDir, safeClaimDir);
    fs.mkdirSync(claimDir, { recursive: true });

    const fileName = `${evidenceId}.${ext}`;
    const storageKey = `${safeClaimDir}/${fileName}`;
    fs.writeFileSync(path.join(claimDir, fileName), buf);

    return {
      mimeType: detectedMime,
      fileName,
      fileSizeBytes: buf.length,
      storageKey,
      checksumSha256,
    };
  }

  async uploadLiveCameraEvidence(claimId: string, dto: CaptureEvidenceDto, userId: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundException(`Claim ${claimId} not found.`);

    const evidenceId = crypto.randomUUID();
    const stored = this.parseAndStoreImageBuffer(claimId, evidenceId, dto.imageBase64);
    const serverNow = new Date();

    const record = await this.prisma.claimEvidence.create({
      data: {
        id: evidenceId,
        claimId,
        fileUrl: `/api/v1/claims/${claimId}/evidence/${evidenceId}/file`,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
        storageKey: stored.storageKey,
        checksumSha256: stored.checksumSha256,
        captureStep: dto.captureStep,
        captureSource: 'LIVE_CAMERA',
        uploadedById: userId,
        serverUploadedAt: serverNow,
        deviceLatitude: dto.deviceLatitude ?? claim.incidentLatitude,
        deviceLongitude: dto.deviceLongitude ?? claim.incidentLongitude,
        deviceTimestamp: serverNow,
      },
    });

    await this.prisma.claimAuditLog.create({
      data: {
        claimId,
        userId,
        action: 'LIVE_CAMERA_EVIDENCE_UPLOAD',
        fieldName: `evidence.${dto.captureStep}`,
        newValue: `${stored.fileName} (sha256:${stored.checksumSha256.slice(0, 12)})`,
      },
    });

    return record;
  }

  async uploadStaffExceptionEvidence(
    claimId: string,
    dto: StaffExceptionEvidenceDto,
    userId: string,
  ) {
    if (!dto.exceptionReason || dto.exceptionReason.trim().length < 5) {
      throw new BadRequestException(
        'Staff exception uploads require a documented reason of at least 5 characters.',
      );
    }

    const claim = await this.prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundException(`Claim ${claimId} not found.`);

    const evidenceId = crypto.randomUUID();
    const stored = this.parseAndStoreImageBuffer(claimId, evidenceId, dto.imageBase64);
    const serverNow = new Date();

    const record = await this.prisma.claimEvidence.create({
      data: {
        id: evidenceId,
        claimId,
        fileUrl: `/api/v1/claims/${claimId}/evidence/${evidenceId}/file`,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
        storageKey: stored.storageKey,
        checksumSha256: stored.checksumSha256,
        captureStep: dto.captureStep,
        captureSource: 'STAFF_EXCEPTION',
        exceptionReason: dto.exceptionReason.trim(),
        uploadedById: userId,
        serverUploadedAt: serverNow,
        deviceLatitude: dto.deviceLatitude ?? claim.incidentLatitude,
        deviceLongitude: dto.deviceLongitude ?? claim.incidentLongitude,
        deviceTimestamp: serverNow,
      },
    });

    await this.prisma.claimAuditLog.create({
      data: {
        claimId,
        userId,
        action: 'STAFF_EVIDENCE_EXCEPTION_UPLOAD',
        fieldName: `evidence.${dto.captureStep}`,
        newValue: `Reason: ${dto.exceptionReason.trim()} (sha256:${stored.checksumSha256.slice(0, 12)})`,
      },
    });

    return record;
  }

  async getEvidenceFile(claimId: string, evidenceId: string) {
    const evidence = await this.prisma.claimEvidence.findFirst({
      where: { id: evidenceId, claimId },
    });
    if (!evidence || !evidence.storageKey) {
      throw new NotFoundException(`Evidence file ${evidenceId} not found for claim ${claimId}.`);
    }

    const fullPath = path.resolve(this.evidenceRootDir, evidence.storageKey);
    if (!fullPath.startsWith(this.evidenceRootDir) || !fs.existsSync(fullPath)) {
      throw new NotFoundException('Stored evidence binary not found on server.');
    }

    return {
      buffer: fs.readFileSync(fullPath),
      mimeType: evidence.mimeType || 'image/jpeg',
      fileName: evidence.fileName || `${evidenceId}.jpg`,
    };
  }
}
