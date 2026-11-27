-- Forward-only migration: track initial common password requirement per user
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
