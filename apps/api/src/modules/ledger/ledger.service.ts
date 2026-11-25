import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, LedgerEntryType, JournalStatus } from '@omniclaim/database';
import * as crypto from 'crypto';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates balanced double-entry vouchers for claim settlement in an atomic ACID transaction.
   */
  async recordClaimSettlementVouchers(params: {
    claimId: string;
    settlementAmount: Prisma.Decimal;
    payoutMethod: 'ACH' | 'UPI' | 'STRIPE' | 'DIRECT_GARAGE';
    userId: string;
  }) {
    const { claimId, settlementAmount, payoutMethod, userId } = params;

    if (settlementAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Settlement amount must be positive to record payout ledger entries.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch standard chart of accounts
      const expenseAcct = await tx.ledgerAccount.findUniqueOrThrow({
        where: { accountNumber: '5001' }, // Direct Claims Expense
      });
      const payableAcct = await tx.ledgerAccount.findUniqueOrThrow({
        where: { accountNumber: '2001' }, // Claims Payable Liability
      });
      const cashAcct = await tx.ledgerAccount.findUniqueOrThrow({
        where: { accountNumber: '1001' }, // Operating Cash Main
      });

      const timestamp = Date.now();

      // -------------------------------------------------------------
      // Voucher 1: Accrual / Claim Approval
      // DEBIT:  Claims Expense Account (5001) [Increases Expense]
      // CREDIT: Claims Payable Account (2001) [Increases Liability]
      // -------------------------------------------------------------
      const accrualJournal = await tx.ledgerJournalEntry.create({
        data: {
          entryNumber: `ACCRUAL-${claimId}-${timestamp}`,
          claimId,
          description: `Accrual expense recognition for Claim ${claimId}`,
          status: JournalStatus.POSTED,
          lines: {
            create: [
              {
                accountId: expenseAcct.id,
                type: LedgerEntryType.DEBIT,
                amount: settlementAmount,
              },
              {
                accountId: payableAcct.id,
                type: LedgerEntryType.CREDIT,
                amount: settlementAmount,
              },
            ],
          },
        },
        include: { lines: true },
      });

      // -------------------------------------------------------------
      // Voucher 2: Cash Disbursement / Settlement Payout
      // DEBIT:  Claims Payable Account (2001) [Decreases Liability]
      // CREDIT: Operating Cash Account (1001) [Decreases Asset]
      // -------------------------------------------------------------
      const paymentJournal = await tx.ledgerJournalEntry.create({
        data: {
          entryNumber: `PAYMENT-${claimId}-${timestamp}`,
          claimId,
          description: `Disbursement payout via ${payoutMethod} for Claim ${claimId}`,
          status: JournalStatus.POSTED,
          lines: {
            create: [
              {
                accountId: payableAcct.id,
                type: LedgerEntryType.DEBIT,
                amount: settlementAmount,
              },
              {
                accountId: cashAcct.id,
                type: LedgerEntryType.CREDIT,
                amount: settlementAmount,
              },
            ],
          },
        },
        include: { lines: true },
      });

      // -------------------------------------------------------------
      // Verification Invariant: Enforce sum(Debits) === sum(Credits)
      // -------------------------------------------------------------
      for (const entry of [accrualJournal, paymentJournal]) {
        let debitTotal = new Prisma.Decimal(0);
        let creditTotal = new Prisma.Decimal(0);

        for (const line of entry.lines) {
          if (line.type === LedgerEntryType.DEBIT) {
            debitTotal = debitTotal.add(line.amount);
          } else {
            creditTotal = creditTotal.add(line.amount);
          }
        }

        if (!debitTotal.equals(creditTotal)) {
          throw new Error(
            `FATAL LEDGER INVARIANT VIOLATION: Journal ${entry.entryNumber} is unbalanced! Debits: ${debitTotal}, Credits: ${creditTotal}`,
          );
        }
      }

      // -------------------------------------------------------------
      // Generate Settlement Voucher Record with Cryptographic QR Hash
      // -------------------------------------------------------------
      const voucherNumber = `VCHR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const qrPayload = JSON.stringify({
        voucherNumber,
        claimId,
        amount: settlementAmount.toString(),
        payoutMethod,
        timestamp,
      });
      const qrHash = crypto.createHash('sha256').update(qrPayload).digest('hex');

      const voucher = await tx.settlementVoucher.upsert({
        where: { claimId },
        create: {
          claimId,
          voucherNumber,
          pdfUrl: `/vouchers/${voucherNumber}.pdf`,
          qrHash,
          payoutMethod,
        },
        update: {
          voucherNumber,
          qrHash,
          payoutMethod,
        },
      });

      this.logger.log(
        `Balanced ledger vouchers posted for Claim ${claimId}. Amount: ${settlementAmount}. Voucher: ${voucherNumber}`,
      );

      return {
        accrualJournal,
        paymentJournal,
        voucher,
      };
    });
  }
}
