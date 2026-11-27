-- Phase 2: Policy Category, Product Master, Application, Underwriting, Quote, Payment & Issuance System
-- Forward-Only Non-Destructive Migration

-- 1. Create Enums safely
DO $$ BEGIN
  CREATE TYPE "PolicyApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCS_REQUIRED', 'QUOTED', 'QUOTE_ACCEPTED', 'PAYMENT_PENDING', 'PAID', 'ISSUED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('GENERATED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UnderwritingDecision" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'NEEDS_INFO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PolicyPaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PolicyLifecycleStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'RENEWED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create PolicyCategory & PolicyProduct
CREATE TABLE IF NOT EXISTS "PolicyCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Shield',
    "requiresUnderwriting" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyCategory_code_key" ON "PolicyCategory"("code");

CREATE TABLE IF NOT EXISTS "PolicyProduct" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "baseRateAnnual" DECIMAL(12,2) NOT NULL,
    "minCoverageAmount" DECIMAL(12,2) NOT NULL,
    "maxCoverageAmount" DECIMAL(12,2) NOT NULL,
    "defaultDeductible" DECIMAL(12,2) NOT NULL,
    "termMonthsOptions" JSONB NOT NULL,
    "requiredDocumentsJson" JSONB NOT NULL,
    "underwritingRulesJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PolicyProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PolicyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyProduct_productCode_key" ON "PolicyProduct"("productCode");
CREATE INDEX IF NOT EXISTS "PolicyProduct_categoryId_isActive_idx" ON "PolicyProduct"("categoryId", "isActive");

-- 3. Non-destructive extensions to Policy
ALTER TABLE "Policy"
    ADD COLUMN IF NOT EXISTS "productId" TEXT,
    ADD COLUMN IF NOT EXISTS "applicationId" TEXT,
    ADD COLUMN IF NOT EXISTS "categoryCode" TEXT NOT NULL DEFAULT 'AUTO',
    ADD COLUMN IF NOT EXISTS "annualPremium" DECIMAL(12,2) NOT NULL DEFAULT 1200.00,
    ADD COLUMN IF NOT EXISTS "lifecycleStatus" "PolicyLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "Policy_applicationId_key" ON "Policy"("applicationId");
CREATE INDEX IF NOT EXISTS "Policy_policyHolderId_idx" ON "Policy"("policyHolderId");
CREATE INDEX IF NOT EXISTS "Policy_productId_idx" ON "Policy"("productId");

DO $$ BEGIN
  ALTER TABLE "Policy" ADD CONSTRAINT "Policy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PolicyProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Create PolicyApplication & Child Domain Tables
CREATE TABLE IF NOT EXISTS "PolicyApplication" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVersionSnapshot" INTEGER NOT NULL DEFAULT 1,
    "status" "PolicyApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedCoverage" DECIMAL(12,2) NOT NULL,
    "requestedDeductible" DECIMAL(12,2) NOT NULL,
    "termMonths" INTEGER NOT NULL DEFAULT 12,
    "desiredStartDate" TIMESTAMP(3),
    "applicantDetailsJson" JSONB NOT NULL,
    "riskDetailsJson" JSONB NOT NULL,
    "nomineeDetailsJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "issuedPolicyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyApplication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PolicyApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PolicyApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PolicyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyApplication_applicationNumber_key" ON "PolicyApplication"("applicationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyApplication_issuedPolicyId_key" ON "PolicyApplication"("issuedPolicyId");
CREATE INDEX IF NOT EXISTS "PolicyApplication_applicantUserId_status_idx" ON "PolicyApplication"("applicantUserId", "status");
CREATE INDEX IF NOT EXISTS "PolicyApplication_productId_idx" ON "PolicyApplication"("productId");

CREATE TABLE IF NOT EXISTS "PolicyApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyApplicationDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PolicyApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PolicyApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PolicyApplicationDocument_applicationId_idx" ON "PolicyApplicationDocument"("applicationId");

CREATE TABLE IF NOT EXISTS "InsuranceQuote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'GENERATED',
    "basePremium" DECIMAL(12,2) NOT NULL,
    "riskLoading" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalPremium" DECIMAL(12,2) NOT NULL,
    "coverageAmount" DECIMAL(12,2) NOT NULL,
    "deductible" DECIMAL(12,2) NOT NULL,
    "termMonths" INTEGER NOT NULL DEFAULT 12,
    "calculationBreakdownJson" JSONB NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsuranceQuote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InsuranceQuote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PolicyApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceQuote_quoteNumber_key" ON "InsuranceQuote"("quoteNumber");
CREATE INDEX IF NOT EXISTS "InsuranceQuote_applicationId_idx" ON "InsuranceQuote"("applicationId");

CREATE TABLE IF NOT EXISTS "UnderwritingReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "UnderwritingDecision" NOT NULL DEFAULT 'PENDING',
    "riskScore" DOUBLE PRECISION,
    "premiumLoading" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "conditionsJson" JSONB,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnderwritingReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnderwritingReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PolicyApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnderwritingReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "UnderwritingReview_applicationId_idx" ON "UnderwritingReview"("applicationId");
CREATE INDEX IF NOT EXISTS "UnderwritingReview_reviewerId_idx" ON "UnderwritingReview"("reviewerId");

CREATE TABLE IF NOT EXISTS "PolicyPayment" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "quoteId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" "PolicyPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayReference" TEXT,
    "failureReason" TEXT,
    "paidById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PolicyPayment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PolicyApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyPayment_idempotencyKey_key" ON "PolicyPayment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PolicyPayment_applicationId_idx" ON "PolicyPayment"("applicationId");

CREATE TABLE IF NOT EXISTS "PolicyEndorsement" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "endorsementType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "premiumDelta" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "changesJson" JSONB NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyEndorsement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PolicyEndorsement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PolicyEndorsement_policyId_idx" ON "PolicyEndorsement"("policyId");

CREATE TABLE IF NOT EXISTS "PolicyRenewal" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "renewalNumber" TEXT NOT NULL,
    "previousEndDate" TIMESTAMP(3) NOT NULL,
    "newStartDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "renewalPremium" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "renewedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyRenewal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PolicyRenewal_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyRenewal_renewalNumber_key" ON "PolicyRenewal"("renewalNumber");
CREATE INDEX IF NOT EXISTS "PolicyRenewal_policyId_idx" ON "PolicyRenewal"("policyId");
