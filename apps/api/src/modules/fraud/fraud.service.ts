import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FraudIndicatorType, FraudRiskTier } from '@omniclaim/database';

@Injectable()
export class FraudEngineService {
  private readonly logger = new Logger(FraudEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes great-circle distance between two GPS coordinates using the Haversine formula in meters.
   */
  calculateHaversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth's mean radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Evaluates multi-factor fraud risk score including pgvector cosine similarity across previous claims.
   */
  async evaluateClaimFraud(claimId: string) {
    const claim = await this.prisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: {
        evidences: true,
        reconciliation: true,
        policy: true,
      },
    });

    const indicators: Array<{
      type: FraudIndicatorType;
      riskContribution: number;
      evidenceMetadata: any;
    }> = [];

    // Factor 1: Device Hardware & EXIF GPS Discrepancy
    for (const evidence of claim.evidences) {
      if (evidence.isMockLocation) {
        indicators.push({
          type: FraudIndicatorType.DEVICE_CLOCK_TAMPERING,
          riskContribution: 40,
          evidenceMetadata: {
            reason: 'Hardware GPS Provider flagged mock/spoofed location on device.',
            evidenceId: evidence.id,
          },
        });
      }

      const distance = this.calculateHaversineDistanceMeters(
        claim.incidentLatitude,
        claim.incidentLongitude,
        evidence.deviceLatitude,
        evidence.deviceLongitude,
      );

      // Flag if image was captured > 1.5 km away from claimed accident site
      if (distance > 1500) {
        indicators.push({
          type: FraudIndicatorType.EXIF_GPS_MISMATCH,
          riskContribution: 25,
          evidenceMetadata: {
            distanceMeters: Math.round(distance),
            evidenceId: evidence.id,
            incidentGps: { lat: claim.incidentLatitude, lon: claim.incidentLongitude },
            deviceGps: { lat: evidence.deviceLatitude, lon: evidence.deviceLongitude },
          },
        });
      }
    }

    // Factor 2: Discrepancy & Phantom Repairs Ratio
    if (claim.reconciliation && claim.reconciliation.discrepancyCount > 0) {
      const billed = claim.reconciliation.totalBilledAmount.toNumber();
      const phantom = claim.reconciliation.totalPhantomAmount.toNumber();

      if (billed > 0) {
        const phantomRatio = phantom / billed;
        if (phantomRatio > 0.3) {
          indicators.push({
            type: FraudIndicatorType.PHANTOM_ITEM_DETECTED,
            riskContribution: 30,
            evidenceMetadata: {
              phantomAmount: phantom,
              billedAmount: billed,
              phantomRatio: Number(phantomRatio.toFixed(3)),
              discrepancyCount: claim.reconciliation.discrepancyCount,
            },
          });
        }
      }
    }

    // Factor 3: Policy Inception Proximity (Incident within 14 days of policy start)
    const policyStart = new Date(claim.policy.startDate).getTime();
    const incidentTime = new Date(claim.incidentDate).getTime();
    const daysSinceInception = (incidentTime - policyStart) / (1000 * 60 * 60 * 24);

    if (daysSinceInception >= 0 && daysSinceInception <= 14) {
      indicators.push({
        type: FraudIndicatorType.POLICY_INCEPTION_PROXIMITY,
        riskContribution: 20,
        evidenceMetadata: {
          daysSinceInception: Math.round(daysSinceInception),
          policyStartDate: claim.policy.startDate,
        },
      });
    }

    // Factor 4: pgvector Vector Cosine Distance Duplicate Search
    for (const evidence of claim.evidences) {
      try {
        const matches: Array<{ id: string; claim_id: string; distance: number }> =
          await this.prisma.$queryRaw`
            SELECT id, "claimId" as claim_id, ("imageEmbedding" <=> (SELECT "imageEmbedding" FROM "ClaimEvidence" WHERE id = ${evidence.id}::uuid)) as distance
            FROM "ClaimEvidence"
            WHERE id != ${evidence.id}::uuid AND "imageEmbedding" IS NOT NULL
            ORDER BY distance ASC
            LIMIT 1;
          `;

        if (matches && matches.length > 0) {
          const topMatch = matches[0];
          // Cosine distance < 0.08 indicates near-identical perceptual damage vector
          if (topMatch.distance < 0.08) {
            indicators.push({
              type: FraudIndicatorType.VECTOR_SIMILARITY_DUPLICATE,
              riskContribution: 50,
              evidenceMetadata: {
                matchedEvidenceId: topMatch.id,
                duplicateClaimId: topMatch.claim_id,
                cosineDistance: topMatch.distance,
                warning: 'Identical damaged vehicle image previously submitted in prior claim.',
              },
            });
          }
        }
      } catch (e) {
        // In local environments without populated vectors, fail gracefully
      }
    }

    // Calculate Composite Risk Score (Capped at 100)
    const compositeScore = Math.min(
      100,
      indicators.reduce((acc, curr) => acc + curr.riskContribution, 0),
    );

    let riskTier = FraudRiskTier.LOW;
    if (compositeScore >= 70) riskTier = FraudRiskTier.CRITICAL;
    else if (compositeScore >= 45) riskTier = FraudRiskTier.HIGH;
    else if (compositeScore >= 20) riskTier = FraudRiskTier.MEDIUM;

    const scorecard = await this.prisma.fraudScorecard.upsert({
      where: { claimId },
      create: {
        claimId,
        compositeScore,
        riskTier,
        indicators: {
          create: indicators,
        },
      },
      update: {
        compositeScore,
        riskTier,
      },
      include: {
        indicators: true,
      },
    });

    this.logger.log(
      `Fraud evaluation completed for claim ${claimId}: Score=${compositeScore}, Tier=${riskTier}, Flags=${indicators.length}`,
    );

    return scorecard;
  }

  /**
   * Overrides a triggered fraud flag with adjuster justification.
   */
  async overrideFraudFlag(params: {
    indicatorId: string;
    overrideReason: string;
    userId: string;
  }) {
    const { indicatorId, overrideReason, userId } = params;

    const indicator = await this.prisma.fraudIndicator.update({
      where: { id: indicatorId },
      data: {
        isOverridden: true,
        overrideReason,
      },
      include: {
        scorecard: true,
      },
    });

    // Recalculate scorecard composite score
    const allIndicators = await this.prisma.fraudIndicator.findMany({
      where: { scorecardId: indicator.scorecardId },
    });

    const activeScore = Math.min(
      100,
      allIndicators
        .filter((i) => !i.isOverridden)
        .reduce((acc, curr) => acc + curr.riskContribution, 0),
    );

    let newTier = FraudRiskTier.LOW;
    if (activeScore >= 70) newTier = FraudRiskTier.CRITICAL;
    else if (activeScore >= 45) newTier = FraudRiskTier.HIGH;
    else if (activeScore >= 20) newTier = FraudRiskTier.MEDIUM;

    await this.prisma.fraudScorecard.update({
      where: { id: indicator.scorecardId },
      data: {
        compositeScore: activeScore,
        riskTier: newTier,
      },
    });

    await this.prisma.claimAuditLog.create({
      data: {
        claimId: indicator.scorecard.claimId,
        userId,
        action: 'OVERRIDE_FRAUD_INDICATOR',
        fieldName: `fraudIndicator.${indicator.type}`,
        oldValue: 'ACTIVE',
        newValue: `OVERRIDDEN: ${overrideReason}`,
      },
    });

    return { success: true, newScore: activeScore, newTier };
  }
}
