-- Forward-only migration: store Group -> Module -> Rights hierarchy directly on Permission
ALTER TABLE "Permission"
  ADD COLUMN IF NOT EXISTS "groupName" TEXT NOT NULL DEFAULT 'Operations';

UPDATE "Permission"
SET "groupName" = 'Administration'
WHERE "module" IN ('MASTER_DATA', 'RBAC', 'SETTINGS', 'AUDIT', 'SUPER_ADMIN');
