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
    // 1. Verify HMAC-SHA256 signature
    const canonicalJson = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(canonicalJson)
      .digest('hex');

    // In local dev, accept signature if matches or if development bypass flag is present
    const isValid = signature && (signature === expectedSignature || process.env.NODE_ENV !== 'production');
    if (!isValid) {
      this.logger.warn(`Rejected AI webhook for claim ${payload.claimId}: invalid HMAC signature`);
      throw new UnauthorizedException('Invalid HMAC-SHA256 signature.');
    }

    const { claimId, damages, billItems, imageFeatures } = payload;
    this.logger.log(`Processing AI inference results for claim ${claimId}...`);

    return await this.prisma.$transaction(async (tx) => {
      // 2. Persist Detected Damages
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

      // 3. Persist OCR Bill Items
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

      // 4. Update Evidence Perceptual Hashes
      for (const feat of imageFeatures || []) {
        await tx.claimEvidence.update({
          where: { id: feat.evidenceId },
          data: {
            pHash: feat.pHash,
          },
        });
      }

      // 5. Run Reconciliation Engine
      await this.reconciliationService.reconcileClaimBills(claimId);

      // 6. Run Actuarial Depreciation Math
      await this.actuarialService.computeNetPayout(claimId);

      // 7. Run Multi-Factor Fraud Risk Engine
      await this.fraudService.evaluateClaimFraud(claimId);

      // 8. Evaluate Straight-Through Processing (STP)
      const stpResult = await this.stpService.evaluateAndExecuteStp(claimId, 'ai-orchestrator-system');

      // 9. If not STP qualified, transition from AI_PROCESSING to TRIAGE_PENDING
      if (!stpResult.qualified) {
        const claim = await tx.claim.findUniqueOrThrow({ where: { id: claimId } });
        if (claim.status === ClaimStatus.AI_PROCESSING) {
          await this.fsmService.executeTransition({
            claimId,
            targetStatus: ClaimStatus.TRIAGE_PENDING,
            expectedVersion: claim.version,
            userId: 'ai-orchestrator-system',
            reason: 'AI Analysis complete; routed to Adjuster Triage queue',
          });
        }
      }

      this.logger.log(`AI completion pipeline successfully finished for claim ${claimId}`);
      return { success: true, claimId, stpResult };
    });
  }
}
