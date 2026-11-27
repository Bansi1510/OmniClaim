-- Phase 1B Enterprise Hardening: Forward-Only Non-Destructive Migration
-- Preserves all existing tables, constraints, and live records in omniclaim DB.

-- 1. Extend ClaimStatus enum safely
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'REOPENED';

-- 2. RefreshToken table for JWT refresh token rotation and revocation
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByHash" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- 3. ClaimSupplement table for supplementary claims, disputes, and appeals
CREATE TABLE IF NOT EXISTS "ClaimSupplement" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "requestedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "approvedAmount" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimSupplement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClaimSupplement_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClaimSupplement_claimId_idx" ON "ClaimSupplement"("claimId");

-- 4. PaymentDisbursement table for idempotent settlement payout tracking and retries
CREATE TABLE IF NOT EXISTS "PaymentDisbursement" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "gatewayReference" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "initiatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDisbursement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentDisbursement_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentDisbursement_idempotencyKey_key" ON "PaymentDisbursement"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PaymentDisbursement_claimId_idx" ON "PaymentDisbursement"("claimId");

-- 5. Non-destructive column additions on existing models
ALTER TABLE "ClaimEvidence"
    ADD COLUMN IF NOT EXISTS "fileName" TEXT,
    ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
    ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER,
    ADD COLUMN IF NOT EXISTS "storageKey" TEXT,
    ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE "ReconciledLineItem"
    ADD COLUMN IF NOT EXISTS "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "evidenceMetadata" JSONB,
    ADD COLUMN IF NOT EXISTS "overrideById" TEXT,
    ADD COLUMN IF NOT EXISTS "overriddenAt" TIMESTAMP(3);

ALTER TABLE "ActuarialAssessment"
    ADD COLUMN IF NOT EXISTS "ruleVersion" TEXT,
    ADD COLUMN IF NOT EXISTS "ruleSnapshotJson" JSONB;

ALTER TABLE "FraudScorecard"
    ADD COLUMN IF NOT EXISTS "modelVersion" TEXT,
    ADD COLUMN IF NOT EXISTS "ruleVersion" TEXT;

ALTER TABLE "LedgerJournalEntry"
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "reversalOfJournalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerJournalEntry_idempotencyKey_key" ON "LedgerJournalEntry"("idempotencyKey");
