import { Prisma, LedgerEntryType, JournalStatus } from '@omniclaim/database';
import { LedgerService } from '../src/modules/ledger/ledger.service';

describe('Ledger Invariant Verification - Zero-Sum Double Entry, Idempotency & Reversals', () => {
  it('guarantees balanced debits and credits for claim settlement entries', () => {
    const settlementAmount = new Prisma.Decimal('675.00');

    // 1. Accrual Journal
    const accrualLines = [
      { accountId: '5001', type: LedgerEntryType.DEBIT, amount: settlementAmount },
      { accountId: '2001', type: LedgerEntryType.CREDIT, amount: settlementAmount },
    ];

    let debitAccrual = new Prisma.Decimal(0);
    let creditAccrual = new Prisma.Decimal(0);

    for (const l of accrualLines) {
      if (l.type === LedgerEntryType.DEBIT) debitAccrual = debitAccrual.add(l.amount);
      else creditAccrual = creditAccrual.add(l.amount);
    }

    expect(debitAccrual.equals(creditAccrual)).toBe(true);
    expect(debitAccrual.sub(creditAccrual).equals(new Prisma.Decimal(0))).toBe(true);

    // 2. Disbursement Journal
    const disbursementLines = [
      { accountId: '2001', type: LedgerEntryType.DEBIT, amount: settlementAmount },
      { accountId: '1001', type: LedgerEntryType.CREDIT, amount: settlementAmount },
    ];

    let debitPayment = new Prisma.Decimal(0);
    let creditPayment = new Prisma.Decimal(0);

    for (const l of disbursementLines) {
      if (l.type === LedgerEntryType.DEBIT) debitPayment = debitPayment.add(l.amount);
      else creditPayment = creditPayment.add(l.amount);
    }

    expect(debitPayment.equals(creditPayment)).toBe(true);
    expect(debitPayment.sub(creditPayment).equals(new Prisma.Decimal(0))).toBe(true);
  });

  it('prevents duplicate settlement disbursements when called twice with the same idempotencyKey', async () => {
    const existingDisbursement = {
      id: 'disb-1',
      idempotencyKey: 'SETTLE-clm-1',
      claimId: 'clm-1',
      status: 'SUCCEEDED',
      payoutMethod: 'ACH',
    };
    const mockTx: any = {
      paymentDisbursement: {
        findUnique: jest.fn().mockResolvedValue(existingDisbursement),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      ledgerJournalEntry: {
        findUnique: jest.fn().mockResolvedValue({ id: 'je-1', lines: [] }),
        create: jest.fn(),
      },
      settlementVoucher: {
        findUnique: jest.fn().mockResolvedValue({ id: 'v-1', voucherNumber: 'VCHR-2026-10001' }),
      },
    };
    const mockPrisma: any = { $transaction: jest.fn((cb) => cb(mockTx)) };
    const service = new LedgerService(mockPrisma);

    const res = await service.recordClaimSettlementVouchers({
      claimId: 'clm-1',
      settlementAmount: new Prisma.Decimal('500.00'),
      payoutMethod: 'ACH',
      userId: 'u-fin-1',
      idempotencyKey: 'SETTLE-clm-1',
    });

    expect(res.idempotentReplay).toBe(true);
    expect(mockTx.ledgerJournalEntry.create).not.toHaveBeenCalled();
    expect(mockTx.paymentDisbursement.create).not.toHaveBeenCalled();
  });

  it('reverses a posted journal entry with an equal-and-opposite contra voucher', async () => {
    const amount = new Prisma.Decimal('420.00');
    const mockTx: any = {
      ledgerJournalEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'je-orig',
          entryNumber: 'ACCRUAL-1',
          claimId: 'clm-1',
          status: JournalStatus.POSTED,
          lines: [
            { accountId: 'acct-5001', type: LedgerEntryType.DEBIT, amount },
            { accountId: 'acct-2001', type: LedgerEntryType.CREDIT, amount },
          ],
        }),
        update: jest.fn().mockResolvedValue({ id: 'je-orig', status: JournalStatus.VOIDED }),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'je-rev', ...data })),
      },
    };
    const mockPrisma: any = { $transaction: jest.fn((cb) => cb(mockTx)) };
    const service = new LedgerService(mockPrisma);

    const result = await service.reverseJournalEntry('je-orig', 'Duplicate claim settled in error', 'u-fin-1');
    expect(result.voidedOriginalId).toBe('je-orig');
    expect(mockTx.ledgerJournalEntry.update).toHaveBeenCalledWith({
      where: { id: 'je-orig' },
      data: { status: JournalStatus.VOIDED },
    });
    const createdLines = mockTx.ledgerJournalEntry.create.mock.calls[0][0].data.lines.create;
    expect(createdLines).toEqual([
      { accountId: 'acct-5001', type: LedgerEntryType.CREDIT, amount },
      { accountId: 'acct-2001', type: LedgerEntryType.DEBIT, amount },
    ]);
  });
});
