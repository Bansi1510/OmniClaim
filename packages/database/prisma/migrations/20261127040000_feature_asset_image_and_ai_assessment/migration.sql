-- Migration: Add asset image requirements, AI assessment models, and theme preferences
-- Forward-only migration

-- 1. Extend PolicyProduct
ALTER TABLE "PolicyProduct"
  ADD COLUMN IF NOT EXISTS "isAssetImageRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "imageRequirementConfig" JSONB;

-- 2. Extend Policy
ALTER TABLE "Policy"
  ADD COLUMN IF NOT EXISTS "baselineCaptureStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "baselineImagesJson" JSONB;

-- 3. AI Damage Assessment Models
CREATE TABLE "AIDamageAssessment" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT UNIQUE NOT NULL REFERENCES "Claim"("id") ON DELETE CASCADE,
  "assessmentJson" JSONB NOT NULL,
  "manualReviewReq" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ClaimAmountRevision" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "Claim"("id") ON DELETE CASCADE,
  "previousAmount" DECIMAL(12,2) NOT NULL,
  "revisedAmount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "adjustedById" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Theming Persistence
CREATE TABLE "UserThemePreference" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "themeConfig" JSONB NOT NULL
);

-- Indexes for performance
CREATE INDEX "AIDamageAssessment_claimId_idx" ON "AIDamageAssessment"("claimId");
CREATE INDEX "ClaimAmountRevision_claimId_idx" ON "ClaimAmountRevision"("claimId");
