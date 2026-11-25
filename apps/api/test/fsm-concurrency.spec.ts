import { ClaimFsmService } from '../src/modules/fsm/claim-fsm.service';
import { ClaimStatus } from '@omniclaim/database';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('ClaimFsmService - Finite State Machine & Optimistic Locking', () => {
  let fsmService: ClaimFsmService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      claim: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      claimTransitionLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    fsmService = new ClaimFsmService(mockPrisma);
  });

  describe('Transition Matrix Integrity', () => {
    it('allows legal transition DRAFT -> SUBMITTED', () => {
      expect(fsmService.isTransitionAllowed(ClaimStatus.DRAFT, ClaimStatus.SUBMITTED)).toBe(true);
    });

    it('allows legal transition SUBMITTED -> AI_PROCESSING', () => {
      expect(fsmService.isTransitionAllowed(ClaimStatus.SUBMITTED, ClaimStatus.AI_PROCESSING)).toBe(true);
    });

    it('allows legal transition APPROVED -> SETTLED', () => {
      expect(fsmService.isTransitionAllowed(ClaimStatus.APPROVED, ClaimStatus.SETTLED)).toBe(true);
    });

    it('rejects illegal transition DRAFT directly to SETTLED', () => {
      expect(fsmService.isTransitionAllowed(ClaimStatus.DRAFT, ClaimStatus.SETTLED)).toBe(false);
    });

    it('rejects any transition out of terminal state SETTLED', () => {
      expect(fsmService.isTransitionAllowed(ClaimStatus.SETTLED, ClaimStatus.APPROVED)).toBe(false);
      expect(fsmService.isTransitionAllowed(ClaimStatus.SETTLED, ClaimStatus.MANUAL_REVIEW)).toBe(false);
    });
  });

  describe('Optimistic Concurrency Control Fuzzing', () => {
    it('throws ConflictException when version in DB differs from expectedVersion', async () => {
      mockPrisma.claim.findUnique.mockResolvedValue({
        id: 'clm-1',
        status: ClaimStatus.TRIAGE_PENDING,
        version: 2, // Concurrent adjuster bumped to 2
        claimNumber: 'CLM-001',
      });

      // Update fails because where clause { id, version: 1 } finds 0 rows
      mockPrisma.claim.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        fsmService.executeTransition({
          claimId: 'clm-1',
          targetStatus: ClaimStatus.APPROVED,
          expectedVersion: 1, // Stale version
          userId: 'adj-1',
          reason: 'Approval attempt with stale OCC version',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
