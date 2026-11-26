-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AI_PROCESSING', 'AI_ANALYSIS_FAILED', 'TRIAGE_PENDING', 'MANUAL_REVIEW', 'APPROVED', 'SETTLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehiclePartType" AS ENUM ('BUMPER_FRONT', 'BUMPER_REAR', 'HOOD_BONNET', 'FENDER_LEFT', 'FENDER_RIGHT', 'DOOR_FRONT_LEFT', 'DOOR_FRONT_RIGHT', 'DOOR_REAR_LEFT', 'DOOR_REAR_RIGHT', 'WINDSHIELD_FRONT', 'WINDSHIELD_REAR', 'HEADLIGHT_LEFT', 'HEADLIGHT_RIGHT', 'TAILLIGHT_LEFT', 'TAILLIGHT_RIGHT', 'ROOF', 'SIDE_MIRROR', 'QUARTER_PANEL', 'ALLOY_WHEEL', 'CHASSIS_UNDERBODY');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PLASTIC', 'METAL', 'GLASS', 'RUBBER', 'FIBERGLASS');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('SCRATCH', 'DENT', 'TEAR_PUNCTURE', 'SHATTERED', 'STRUCTURAL_TOTAL');

-- CreateEnum
CREATE TYPE "FraudRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudIndicatorType" AS ENUM ('EXIF_GPS_MISMATCH', 'DEVICE_CLOCK_TAMPERING', 'PERCEPTUAL_HASH_DUPLICATE', 'VECTOR_SIMILARITY_DUPLICATE', 'PHANTOM_ITEM_DETECTED', 'EXCESSIVE_LABOR_ESTIMATE', 'POLICY_INCEPTION_PROXIMITY');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET');

-- CreateEnum
CREATE TYPE "AutomationRuleType" AS ENUM ('STP', 'FRAUD', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "AuthAuditEventType" AS ENUM ('LOGIN_PASSWORD', 'LOGIN_SUPER_MASTER_PASSWORD', 'IMPERSONATION_START', 'MASTER_PASSWORD_ROTATED', 'SUPER_ADMIN_OVERRIDE', 'LOGIN_FAILED');

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "policyHolderId" TEXT NOT NULL,
    "vehicleVin" TEXT NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" INTEGER NOT NULL,
    "coverageLimit" DECIMAL(12,2) NOT NULL,
    "baseDeductible" DECIMAL(12,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "incidentLatitude" DOUBLE PRECISION NOT NULL,
    "incidentLongitude" DOUBLE PRECISION NOT NULL,
    "incidentDescription" TEXT,
    "adjusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "pHash" TEXT,
    "imageEmbedding" vector(512),
    "deviceLatitude" DOUBLE PRECISION NOT NULL,
    "deviceLongitude" DOUBLE PRECISION NOT NULL,
    "deviceTimestamp" TIMESTAMP(3) NOT NULL,
    "altitude" DOUBLE PRECISION,
    "gyroscopeX" DOUBLE PRECISION,
    "gyroscopeY" DOUBLE PRECISION,
    "gyroscopeZ" DOUBLE PRECISION,
    "isMockLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedDamage" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "partType" "VehiclePartType" NOT NULL,
    "materialType" "MaterialType" NOT NULL,
    "severity" "DamageSeverity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "boundingBoxJson" JSONB NOT NULL,
    "repairAction" TEXT NOT NULL,
    "isManualAdded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillDocument" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "garageName" TEXT,
    "garageTaxId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLineItem" (
    "id" TEXT NOT NULL,
    "billDocumentId" TEXT NOT NULL,
    "rawDescription" TEXT NOT NULL,
    "partType" "VehiclePartType",
    "materialType" "MaterialType",
    "isLabor" BOOLEAN NOT NULL DEFAULT false,
    "claimedCost" DECIMAL(12,2) NOT NULL,
    "ocrConfidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationSummary" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "totalBilledAmount" DECIMAL(12,2) NOT NULL,
    "totalApprovedAmount" DECIMAL(12,2) NOT NULL,
    "totalPhantomAmount" DECIMAL(12,2) NOT NULL,
    "discrepancyCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciledLineItem" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "billLineItemId" TEXT NOT NULL,
    "isVerifiedByDamage" BOOLEAN NOT NULL,
    "matchedDamagePart" "VehiclePartType",
    "systemDeduction" DECIMAL(12,2) NOT NULL,
    "approvedCost" DECIMAL(12,2) NOT NULL,
    "rejectionReason" TEXT,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciledLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActuarialAssessment" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "grossPartsTotal" DECIMAL(12,2) NOT NULL,
    "metalDepreciation" DECIMAL(12,2) NOT NULL,
    "plasticDepreciation" DECIMAL(12,2) NOT NULL,
    "glassDepreciation" DECIMAL(12,2) NOT NULL,
    "totalDepreciation" DECIMAL(12,2) NOT NULL,
    "totalLaborApproved" DECIMAL(12,2) NOT NULL,
    "applicableDeductible" DECIMAL(12,2) NOT NULL,
    "salvageValue" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netPayout" DECIMAL(12,2) NOT NULL,
    "isStpQualified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActuarialAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudScorecard" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "compositeScore" DOUBLE PRECISION NOT NULL,
    "riskTier" "FraudRiskTier" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudIndicator" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "type" "FraudIndicatorType" NOT NULL,
    "riskContribution" DOUBLE PRECISION NOT NULL,
    "evidenceMetadata" JSONB NOT NULL,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimTransitionLog" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "ClaimStatus" NOT NULL,
    "toStatus" "ClaimStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredById" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimTransitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimAuditLog" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimLock" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerJournalEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "claimId" TEXT,
    "description" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransactionLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "LedgerTransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementVoucher" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "qrHash" TEXT NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "SettingValueType" NOT NULL DEFAULT 'STRING',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "eventType" "AuthAuditEventType" NOT NULL,
    "targetUserId" TEXT,
    "actorIdentifier" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'WEB',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePartCatalog" (
    "id" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partType" "VehiclePartType" NOT NULL,
    "materialType" "MaterialType" NOT NULL,
    "oemBasePrice" DECIMAL(12,2) NOT NULL,
    "aftermarketPrice" DECIMAL(12,2) NOT NULL,
    "defaultLaborHours" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "laborRatePerHour" DECIMAL(10,2) NOT NULL DEFAULT 90.00,
    "depreciationOverridePct" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePartCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialType" "MaterialType" NOT NULL,
    "minVehicleAgeYears" INTEGER NOT NULL DEFAULT 0,
    "maxVehicleAgeYears" INTEGER NOT NULL DEFAULT 100,
    "depreciationPercent" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepreciationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" "AutomationRuleType" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "thresholdValue" TEXT NOT NULL,
    "riskWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairGarage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "taxId" TEXT,
    "hourlyLaborRate" DECIMAL(10,2) NOT NULL DEFAULT 95.00,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "isPreferredNetwork" BOOLEAN NOT NULL DEFAULT true,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairGarage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicMenuItem" (
    "id" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "navLink" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Circle',
    "parentKey" TEXT,
    "requiredPermission" TEXT,
    "badgeName" TEXT,
    "badgeColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_slug_key" ON "Permission"("slug");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_policyNumber_key" ON "Policy"("policyNumber");

-- CreateIndex
CREATE INDEX "Policy_vehicleVin_idx" ON "Policy"("vehicleVin");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_policyId_idx" ON "Claim"("policyId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_claimId_idx" ON "ClaimEvidence"("claimId");

-- CreateIndex
CREATE INDEX "DetectedDamage_claimId_partType_idx" ON "DetectedDamage"("claimId", "partType");

-- CreateIndex
CREATE INDEX "BillDocument_claimId_idx" ON "BillDocument"("claimId");

-- CreateIndex
CREATE INDEX "BillLineItem_billDocumentId_idx" ON "BillLineItem"("billDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationSummary_claimId_key" ON "ReconciliationSummary"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciledLineItem_billLineItemId_key" ON "ReconciledLineItem"("billLineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ActuarialAssessment_claimId_key" ON "ActuarialAssessment"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "FraudScorecard_claimId_key" ON "FraudScorecard"("claimId");

-- CreateIndex
CREATE INDEX "FraudIndicator_scorecardId_idx" ON "FraudIndicator"("scorecardId");

-- CreateIndex
CREATE INDEX "ClaimTransitionLog_claimId_idx" ON "ClaimTransitionLog"("claimId");

-- CreateIndex
CREATE INDEX "ClaimAuditLog_claimId_idx" ON "ClaimAuditLog"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimLock_claimId_key" ON "ClaimLock"("claimId");

-- CreateIndex
CREATE INDEX "ClaimLock_expiresAt_idx" ON "ClaimLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_accountNumber_key" ON "LedgerAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "LedgerAccount_accountNumber_idx" ON "LedgerAccount"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerJournalEntry_entryNumber_key" ON "LedgerJournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "LedgerJournalEntry_claimId_idx" ON "LedgerJournalEntry"("claimId");

-- CreateIndex
CREATE INDEX "LedgerTransactionLine_journalEntryId_idx" ON "LedgerTransactionLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "LedgerTransactionLine_accountId_idx" ON "LedgerTransactionLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementVoucher_claimId_key" ON "SettlementVoucher"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementVoucher_voucherNumber_key" ON "SettlementVoucher"("voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_eventType_idx" ON "SecurityAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_targetUserId_idx" ON "SecurityAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_createdAt_idx" ON "SecurityAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePartCatalog_partCode_key" ON "VehiclePartCatalog"("partCode");

-- CreateIndex
CREATE INDEX "VehiclePartCatalog_partType_idx" ON "VehiclePartCatalog"("partType");

-- CreateIndex
CREATE INDEX "VehiclePartCatalog_materialType_idx" ON "VehiclePartCatalog"("materialType");

-- CreateIndex
CREATE INDEX "DepreciationRule_materialType_isActive_idx" ON "DepreciationRule"("materialType", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_ruleType_isActive_idx" ON "AutomationRule"("ruleType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RepairGarage_code_key" ON "RepairGarage"("code");

-- CreateIndex
CREATE INDEX "RepairGarage_isPreferredNetwork_idx" ON "RepairGarage"("isPreferredNetwork");

-- CreateIndex
CREATE INDEX "RepairGarage_isBlacklisted_idx" ON "RepairGarage"("isBlacklisted");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicMenuItem_menuKey_key" ON "DynamicMenuItem"("menuKey");

-- CreateIndex
CREATE INDEX "DynamicMenuItem_parentKey_sortOrder_idx" ON "DynamicMenuItem"("parentKey", "sortOrder");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_adjusterId_fkey" FOREIGN KEY ("adjusterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedDamage" ADD CONSTRAINT "DetectedDamage_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedDamage" ADD CONSTRAINT "DetectedDamage_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ClaimEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDocument" ADD CONSTRAINT "BillDocument_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLineItem" ADD CONSTRAINT "BillLineItem_billDocumentId_fkey" FOREIGN KEY ("billDocumentId") REFERENCES "BillDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationSummary" ADD CONSTRAINT "ReconciliationSummary_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciledLineItem" ADD CONSTRAINT "ReconciledLineItem_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "ReconciliationSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciledLineItem" ADD CONSTRAINT "ReconciledLineItem_billLineItemId_fkey" FOREIGN KEY ("billLineItemId") REFERENCES "BillLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActuarialAssessment" ADD CONSTRAINT "ActuarialAssessment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudScorecard" ADD CONSTRAINT "FraudScorecard_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudIndicator" ADD CONSTRAINT "FraudIndicator_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "FraudScorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTransitionLog" ADD CONSTRAINT "ClaimTransitionLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTransitionLog" ADD CONSTRAINT "ClaimTransitionLog_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAuditLog" ADD CONSTRAINT "ClaimAuditLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAuditLog" ADD CONSTRAINT "ClaimAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLock" ADD CONSTRAINT "ClaimLock_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLock" ADD CONSTRAINT "ClaimLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerJournalEntry" ADD CONSTRAINT "LedgerJournalEntry_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransactionLine" ADD CONSTRAINT "LedgerTransactionLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "LedgerJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransactionLine" ADD CONSTRAINT "LedgerTransactionLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementVoucher" ADD CONSTRAINT "SettlementVoucher_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

