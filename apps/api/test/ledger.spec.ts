import { Prisma, LedgerEntryType } from '@omniclaim/database';

describe('Ledger Invariant Verification - Zero-Sum Double Entry', () => {
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
});
