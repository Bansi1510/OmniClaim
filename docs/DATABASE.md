# OmniClaim Database Schema & Migrations

OmniClaim uses **PostgreSQL 16** with **`pgvector`** and **Prisma ORM** ([schema.prisma](../packages/database/prisma/schema.prisma)). All migrations are **forward-only and non-destructive**.

---

## 1. Applied Migrations (`packages/database/prisma/migrations`)

1. `20261126000000_init_omniclaim_enterprise` — Enables `vector` extension and creates the initial 30 RBAC, Claims, Reconciliation, Actuarial, Fraud, Double-Entry Ledger, and Super Admin master tables.
2. `20261126010000_add_system_activity_audit_log` — Creates `SystemActivityAuditLog` with 6 indexes for global HTTP & field-diff auditing.
3. `20261127000000_phase1_enterprise_hardening` — Extends `ClaimStatus` (`PAYMENT_PENDING`, `PAYMENT_FAILED`, `DISPUTED`, `REOPENED`); adds `RefreshToken`, `ClaimSupplement`, and `PaymentDisbursement`; adds metadata/versioning/review columns to `ClaimEvidence`, `ReconciledLineItem`, `ActuarialAssessment`, `FraudScorecard`, and `LedgerJournalEntry`.
4. `20261127010000_add_policy_application_system` — Creates `PolicyCategory`, `PolicyProduct`, `PolicyApplication`, `PolicyApplicationDocument`, `InsuranceQuote`, `UnderwritingReview`, `PolicyPayment`, `PolicyEndorsement`, and `PolicyRenewal`, and extends `Policy`.
5. `20261127020000_feature1_camera_and_feature2_vehicle_types` — Creates `VehicleType` (`@@unique([categoryId, code])`) linked to `PolicyCategory`, `PolicyProduct` (adding `vehicleTypeId`, `eligibilityJson`, `exclusionsJson`, `addonsJson`), `PolicyApplication`, and `Policy`; extends `ClaimEvidence` with `captureStep`, `captureSource`, `checksumSha256`, `uploadedById`, `serverUploadedAt`, and `exceptionReason`.
6. `20261127030000_user_must_change_password` — Adds `User.mustChangePassword` (`Boolean`, default `false`) for enforcing initial common password change after login.

---

## 2. Database Tables by Domain (45 Total Tables)

| Domain | Models / Tables |
|---|---|
| **RBAC & Auth** | `Permission`, `Role`, `RolePermission`, `User`, `UserRole`, `RefreshToken`, `SecurityAuditLog` |
| **Policy Catalog & Issuance** | `PolicyCategory`, `VehicleType`, `PolicyProduct`, `PolicyApplication`, `PolicyApplicationDocument`, `InsuranceQuote`, `UnderwritingReview`, `PolicyPayment`, `Policy`, `PolicyEndorsement`, `PolicyRenewal` |
| **Claims & Evidence** | `Claim`, `ClaimEvidence`, `DetectedDamage`, `BillDocument`, `BillLineItem`, `ClaimSupplement`, `ClaimTransitionLog`, `ClaimAuditLog`, `ClaimLock` |
| **Reconciliation, Actuarial & Fraud** | `ReconciliationSummary`, `ReconciledLineItem`, `ActuarialAssessment`, `FraudScorecard`, `FraudIndicator` |
| **Double-Entry Ledger** | `LedgerAccount`, `LedgerJournalEntry`, `LedgerTransactionLine`, `PaymentDisbursement`, `SettlementVoucher` |
| **Master Data & Rules** | `VehiclePartCatalog`, `DepreciationRule`, `AutomationRule`, `RepairGarage`, `DynamicMenuItem`, `SystemSetting` |
| **Global Audit & Infra** | `SystemActivityAuditLog`, `_prisma_migrations` |

---

## 3. Common Database Commands

Run all commands from the repository root using `npx --yes pnpm`:

```powershell
# Check migration status (should show 6 migrations applied)
npx --yes pnpm --filter @omniclaim/database exec prisma migrate status

# Apply pending forward-only migrations
npx --yes pnpm --filter @omniclaim/database exec prisma migrate deploy

# Regenerate Prisma Client + rebuild @omniclaim/database dist
npx --yes pnpm --filter @omniclaim/database exec prisma generate
npx --yes pnpm --filter @omniclaim/database build

# Run idempotent database seeder (41 permissions, 6 roles, 5 users, 5 categories, 3 vehicle types, 10 products, 18 menus)
npx --yes pnpm --filter @omniclaim/database run db:seed
```
