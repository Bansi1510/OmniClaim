import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, VehiclePartType } from '@omniclaim/database';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reconciles OCR-parsed invoice items against AI-detected visual damage parts.
   */
  async reconcileClaimBills(claimId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch all detected physical damages
      const damages = await tx.detectedDamage.findMany({
        where: { claimId },
      });

      // 2. Fetch all raw bill documents and items
      const billDocuments = await tx.billDocument.findMany({
        where: { claimId },
        include: { lineItems: true },
      });

      const detectedPartSet = new Set<VehiclePartType>(
        damages.map((d) => d.partType),
      );

      let totalBilled = new Prisma.Decimal(0);
      let totalApproved = new Prisma.Decimal(0);
      let totalPhantom = new Prisma.Decimal(0);
      let discrepancyCount = 0;

      const lineItemDecisions = [];

      for (const doc of billDocuments) {
        for (const item of doc.lineItems) {
          totalBilled = totalBilled.add(item.claimedCost);

          if (item.isLabor) {
            const matchedLaborPart = item.partType && detectedPartSet.has(item.partType);
            const lowConfidence = item.ocrConfidence < 0.75;

            if (matchedLaborPart) {
              totalApproved = totalApproved.add(item.claimedCost);
              lineItemDecisions.push({
                billLineItemId: item.id,
                isVerifiedByDamage: true,
                matchedDamagePart: item.partType,
                systemDeduction: new Prisma.Decimal(0),
                approvedCost: item.claimedCost,
                rejectionReason: null,
                requiresHumanReview: lowConfidence,
                confidence: item.ocrConfidence,
                evidenceMetadata: { matchType: 'PART_SPECIFIC_LABOR', partType: item.partType },
              });
            } else if (detectedPartSet.size > 0) {
              // Do NOT automatically approve general/unmatched labor simply because any damage exists
              totalPhantom = totalPhantom.add(item.claimedCost);
              discrepancyCount++;
              lineItemDecisions.push({
                billLineItemId: item.id,
                isVerifiedByDamage: false,
                matchedDamagePart: null,
                systemDeduction: item.claimedCost,
                approvedCost: new Prisma.Decimal(0),
                rejectionReason: 'Unmatched general labor requires human adjuster review',
                requiresHumanReview: true,
                confidence: item.ocrConfidence,
                evidenceMetadata: {
                  matchType: 'GENERAL_LABOR_REQUIRES_REVIEW',
                  detectedParts: Array.from(detectedPartSet),
                },
              });
            } else {
              totalPhantom = totalPhantom.add(item.claimedCost);
              discrepancyCount++;
              lineItemDecisions.push({
                billLineItemId: item.id,
                isVerifiedByDamage: false,
                matchedDamagePart: null,
                systemDeduction: item.claimedCost,
                approvedCost: new Prisma.Decimal(0),
                rejectionReason: 'Labor claimed without any physically verified damage',
                requiresHumanReview: true,
                confidence: item.ocrConfidence,
                evidenceMetadata: { matchType: 'NO_PHYSICAL_DAMAGE' },
              });
            }
            continue;
          }

          // Part Verification: Does the billed part match any detected damage?
          const isVerified = Boolean(item.partType && detectedPartSet.has(item.partType));
          const lowConfidence = item.ocrConfidence < 0.75;

          if (isVerified) {
            totalApproved = totalApproved.add(item.claimedCost);
            lineItemDecisions.push({
              billLineItemId: item.id,
              isVerifiedByDamage: true,
              matchedDamagePart: item.partType,
              systemDeduction: new Prisma.Decimal(0),
              approvedCost: item.claimedCost,
              rejectionReason: null,
              requiresHumanReview: lowConfidence,
              confidence: item.ocrConfidence,
              evidenceMetadata: { matchType: 'PART_VERIFIED', partType: item.partType },
            });
          } else {
            // Phantom repair detected!
            totalPhantom = totalPhantom.add(item.claimedCost);
            discrepancyCount++;
            lineItemDecisions.push({
              billLineItemId: item.id,
              isVerifiedByDamage: false,
              matchedDamagePart: null,
              systemDeduction: item.claimedCost,
              approvedCost: new Prisma.Decimal(0),
              rejectionReason: `Phantom repair: Part ${item.partType || 'UNKNOWN'} has no matching image damage`,
              requiresHumanReview: true,
              confidence: item.ocrConfidence,
              evidenceMetadata: {
                matchType: 'PHANTOM_ITEM',
                claimedPart: item.partType || 'UNKNOWN',
              },
            });
          }
        }
      }

      // Clean stale line items on re-reconciliation so previous runs never leak into current totals
      const existingSummary = await tx.reconciliationSummary.findUnique({ where: { claimId } });
      if (existingSummary) {
        await tx.reconciledLineItem.deleteMany({ where: { summaryId: existingSummary.id } });
      }

      // Upsert summary and create reconciled items cleanly
      const summary = await tx.reconciliationSummary.upsert({
        where: { claimId },
        create: {
          claimId,
          totalBilledAmount: totalBilled,
          totalApprovedAmount: totalApproved,
          totalPhantomAmount: totalPhantom,
          discrepancyCount,
          items: {
            create: lineItemDecisions,
          },
        },
        update: {
          totalBilledAmount: totalBilled,
          totalApprovedAmount: totalApproved,
          totalPhantomAmount: totalPhantom,
          discrepancyCount,
          items: {
            create: lineItemDecisions,
          },
        },
        include: {
          items: true,
        },
      });

      this.logger.log(
        `Reconciliation completed for claim ${claimId}: Billed=${totalBilled}, Approved=${totalApproved}, Phantom=${totalPhantom}, Discrepancies=${discrepancyCount}`,
      );

      return summary;
    });
  }

  /**
   * Allows an adjuster to manually override an unverified/phantom line item with an audit reason.
   */
  async overrideLineItem(params: {
    claimId: string;
    reconciledItemId: string;
    isApproved: boolean;
    approvedCost: number;
    reason: string;
    userId: string;
  }) {
    const { claimId, reconciledItemId, isApproved, approvedCost, reason, userId } = params;

    return await this.prisma.$transaction(async (tx) => {
      const item = await tx.reconciledLineItem.findUnique({
        where: { id: reconciledItemId },
        include: { billLineItem: true },
      });

      if (!item) {
        throw new Error(`Reconciled line item ${reconciledItemId} not found`);
      }

      const decimalApproved = new Prisma.Decimal(approvedCost);
      const systemDeduction = item.billLineItem.claimedCost.sub(decimalApproved);

      const updated = await tx.reconciledLineItem.update({
        where: { id: reconciledItemId },
        data: {
          isVerifiedByDamage: isApproved,
          approvedCost: decimalApproved,
          systemDeduction: systemDeduction.lessThan(0) ? new Prisma.Decimal(0) : systemDeduction,
          isManualOverride: true,
          requiresHumanReview: false,
          overrideReason: reason,
          overrideById: userId,
          overriddenAt: new Date(),
        },
      });

      // Recalculate summary totals
      const allItems = await tx.reconciledLineItem.findMany({
        where: { summary: { claimId } },
        include: { billLineItem: true },
      });

      let totalBilled = new Prisma.Decimal(0);
      let totalApproved = new Prisma.Decimal(0);
      let totalPhantom = new Prisma.Decimal(0);
      let discrepancyCount = 0;

      for (const i of allItems) {
        totalBilled = totalBilled.add(i.billLineItem.claimedCost);
        totalApproved = totalApproved.add(i.approvedCost);
        if (!i.isVerifiedByDamage) {
          totalPhantom = totalPhantom.add(i.systemDeduction);
          discrepancyCount++;
        }
      }

      await tx.reconciliationSummary.update({
        where: { claimId },
        data: {
          totalBilledAmount: totalBilled,
          totalApprovedAmount: totalApproved,
          totalPhantomAmount: totalPhantom,
          discrepancyCount,
        },
      });

      // Audit Log entry
      await tx.claimAuditLog.create({
        data: {
          claimId,
          userId,
          action: 'OVERRIDE_RECONCILIATION_ITEM',
          fieldName: `reconciledLineItem.${item.id}`,
          oldValue: item.approvedCost.toString(),
          newValue: decimalApproved.toString(),
        },
      });

      return updated;
    });
  }
}
