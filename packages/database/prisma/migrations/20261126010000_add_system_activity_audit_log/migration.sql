-- CreateTable
CREATE TABLE "SystemActivityAuditLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "routePattern" TEXT,
    "module" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "username" TEXT,
    "userEmail" TEXT,
    "userFullName" TEXT,
    "userRole" TEXT,
    "isMasterLogin" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "queryParams" JSONB,
    "requestBody" JSONB,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedFields" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemActivityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemActivityAuditLog_method_idx" ON "SystemActivityAuditLog"("method");

-- CreateIndex
CREATE INDEX "SystemActivityAuditLog_module_idx" ON "SystemActivityAuditLog"("module");

-- CreateIndex
CREATE INDEX "SystemActivityAuditLog_entityType_entityId_idx" ON "SystemActivityAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SystemActivityAuditLog_username_idx" ON "SystemActivityAuditLog"("username");

-- CreateIndex
CREATE INDEX "SystemActivityAuditLog_statusCode_idx" ON "SystemActivityAuditLog"("statusCode");

-- CreateIndex
CREATE INDEX "SystemActivityAuditLog_createdAt_idx" ON "SystemActivityAuditLog"("createdAt");
