import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimFsmService } from '../fsm/claim-fsm.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { ActuarialService } from '../actuarial/actuarial.service';
import { FraudEngineService } from '../fraud/fraud.service';
import { StpRuleEngineService } from '../stp/stp.service';
import { ClaimStatus, VehiclePartType, MaterialType, DamageSeverity, Prisma } from '@omniclaim/database';
import * as crypto from 'crypto';

@ApiTags('AI Webhooks')
@Controller('api/v1/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly hmacSecret = process.env.HMAC_SECRET || 'omniclaim_production_hmac_secret_key_2026';

  constructor(
    private readonly prisma: PrismaService,
    private readonly fsmService: ClaimFsmService,
    private readonly reconciliationService: ReconciliationService,
    private readonly actuarialService: ActuarialService,
    private readonly fraudService: FraudEngineService,
    private readonly stpService: StpRuleEngineService,
  ) {}

  @Post('ai-completion')
  @ApiOperation({ summary: 'HMAC-Signed Webhook dispatched by FastAPI upon inference completion' })
  async handleAiCompletion(
    @Body() payload: any,
    @Headers('x-omniclaim-signature') signature: string,
  ) {
    // 1. Enforce strict timing-safe HMAC-SHA256 verification across all environments
    const canonicalJson = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(canonicalJson)
      .digest('hex');

    const isValid =
      typeof signature === 'string' &&
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));

    if (!isValid) {
      this.logger.warn(`Rejected AI webhook for claim ${payload?.claimId}: invalid HMAC signature`);
      throw new UnauthorizedException('Invalid HMAC-SHA256 signature.');
    }

    const { claimId, damages, billItems, imageFeatures } = payload;
    this.logger.log(`Processing AI inference results for claim ${claimId}...`);

    // 2. Persist AI evidence/damage/OCR records atomically without wrapping downstream independent transactions
    await this.prisma.$transaction(async (tx) => {
      for (const d of damages || []) {
        await tx.detectedDamage.create({
          data: {
            claimId,
            evidenceId: d.evidenceId,
            partType: d.partType as VehiclePartType,
            materialType: d.materialType as MaterialType,
            severity: d.severity as DamageSeverity,
            confidence: d.confidence,
            boundingBoxJson: d.boundingBox,
            repairAction: d.recommendedAction,
          },
        });
      }

      for (const item of billItems || []) {
        await tx.billLineItem.create({
          data: {
            billDocumentId: item.billDocumentId,
            rawDescription: item.rawDescription,
            partType: item.inferredPartType as VehiclePartType | null,
            materialType: item.inferredMaterialType as MaterialType | null,
            isLabor: item.isLabor,
            claimedCost: new Prisma.Decimal(item.claimedCost),
            ocrConfidence: item.ocrConfidence,
          },
        });
      }

      for (const feat of imageFeatures || []) {
        await tx.claimEvidence.update({
          where: { id: feat.evidenceId },
          data: {
            pHash: feat.pHash,
          },
        });
      }
    });

    // 3. Run downstream verification engines
    await this.reconciliationService.reconcileClaimBills(claimId);
    await this.actuarialService.computeNetPayout(claimId);
    await this.fraudService.evaluateClaimFraud(claimId);

    const systemUser = await this.prisma.user.findFirst({
      where: { isSuperAdmin: true },
      select: { id: true },
    });
    const actorUserId = systemUser?.id || 'ai-orchestrator-system';

    // 4. Evaluate STP eligibility (advisory recommendation only; never directly settles payout)
    const stpResult = await this.stpService.evaluateAndExecuteStp(claimId, actorUserId);

    // 5. Route AI_PROCESSING -> TRIAGE_PENDING via FSM
    const claim = await this.prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    if (claim.status === ClaimStatus.AI_PROCESSING && systemUser) {
      await this.fsmService.executeTransition({
        claimId,
        targetStatus: ClaimStatus.TRIAGE_PENDING,
        expectedVersion: claim.version,
        userId: systemUser.id,
        reason: `AI Analysis complete (${stpResult.recommendation}); routed to Adjuster Triage queue`,
      });
    }

    this.logger.log(`AI completion pipeline successfully finished for claim ${claimId}`);
    return { success: true, claimId, stpResult };
  }
}
