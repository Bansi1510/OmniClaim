-- Feature 1 (Live Camera Evidence Capture Metadata) & Feature 2 (Configurable Vehicle Types Hierarchy)
-- Forward-Only Non-Destructive Migration

-- 1. Create configurable VehicleType table under PolicyCategory
CREATE TABLE IF NOT EXISTS "VehicleType" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Car',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VehicleType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PolicyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "VehicleType_categoryId_code_key" ON "VehicleType"("categoryId", "code");
CREATE INDEX IF NOT EXISTS "VehicleType_categoryId_isActive_idx" ON "VehicleType"("categoryId", "isActive");

-- 2. Extend PolicyProduct, PolicyApplication, and Policy non-destructively
ALTER TABLE "PolicyProduct"
    ADD COLUMN IF NOT EXISTS "vehicleTypeId" TEXT,
    ADD COLUMN IF NOT EXISTS "eligibilityJson" JSONB,
    ADD COLUMN IF NOT EXISTS "exclusionsJson" JSONB,
    ADD COLUMN IF NOT EXISTS "addonsJson" JSONB;

CREATE INDEX IF NOT EXISTS "PolicyProduct_vehicleTypeId_isActive_idx" ON "PolicyProduct"("vehicleTypeId", "isActive");

DO $$ BEGIN
  ALTER TABLE "PolicyProduct" ADD CONSTRAINT "PolicyProduct_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "PolicyApplication"
    ADD COLUMN IF NOT EXISTS "vehicleTypeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "PolicyApplication" ADD CONSTRAINT "PolicyApplication_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Policy"
    ADD COLUMN IF NOT EXISTS "vehicleTypeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Policy" ADD CONSTRAINT "Policy_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Extend ClaimEvidence non-destructively for guided camera capture & server integrity verification
ALTER TABLE "ClaimEvidence"
    ADD COLUMN IF NOT EXISTS "captureStep" TEXT,
    ADD COLUMN IF NOT EXISTS "captureSource" TEXT NOT NULL DEFAULT 'LIVE_CAMERA',
    ADD COLUMN IF NOT EXISTS "checksumSha256" TEXT,
    ADD COLUMN IF NOT EXISTS "uploadedById" TEXT,
    ADD COLUMN IF NOT EXISTS "serverUploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "exceptionReason" TEXT;
