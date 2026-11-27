# OmniClaim Database Schema & Migrations

OmniClaim uses **PostgreSQL 16** with **`pgvector`** and **Prisma ORM** ([schema.prisma](../packages/database/prisma/schema.prisma)). All migrations are **forward-only and non-destructive**.

---

## 1. Applied Migrations (`packages/database/prisma/migrations`)

1. `20261126000000_init_omniclaim_enterprise` — Enables `vector` extension and creates the initial 30 RBAC, Claims, Reconciliation, Actuarial, Fraud, Double-Entry Ledger, and Super Admin master tables.
2. `20261126010000_add_system_activity_audit_log` — Creates `SystemActivityAuditLog` with 6 indexes for global HTTP & field-diff auditing.
3. `20261127000000_phase1_enterprise_hardening` — Extends `ClaimStatus` (`PAYMENT_PENDING`, `PAYMENT_FAILED`, `DISPUTED`, `REOPENED`); adds `RefreshToken`, `ClaimSupplement`, and `PaymentDisbursement`; adds metadata/versioning/review columns to `ClaimEvidence`, `ReconciledLineItem`, `ActuarialAssessment`, `FraudScorecard`, and `LedgerJournalEntry`.
4. `20261127010000_add_policy_application_system` — Creates `PolicyCategory`, `PolicyProduct`, `PolicyApplication`, `PolicyApplicationDocument`, `InsuranceQuote`, `UnderwritingReview`, `PolicyPayment`, `PolicyEndorsement`, and `PolicyRenewal`, and extends `Policy`.

---

## 2. Database Tables by Domain (44 Total Tables)

| Domain | Models / Tables |
|---|---|
| **RBAC & Auth** | `Permission`, `Role`, `RolePermission`, `User`, `UserRole`, `RefreshToken`, `SecurityAuditLog` |
| **Policy Catalog & Issuance** | `PolicyCategory`, `PolicyProduct`, `PolicyApplication`, `PolicyApplicationDocument`, `InsuranceQuote`, `UnderwritingReview`, `PolicyPayment`, `Policy`, `PolicyEndorsement`, `PolicyRenewal` |
| **Claims & Evidence** | `Claim`, `ClaimEvidence`, `DetectedDamage`, `BillDocument`, `BillLineItem`, `ClaimSupplement`, `ClaimTransitionLog`, `ClaimAuditLog`, `ClaimLock` |
| **Reconciliation, Actuarial & Fraud** | `ReconciliationSummary`, `ReconciledLineItem`, `ActuarialAssessment`, `FraudScorecard`, `FraudIndicator` |
| **Double-Entry Ledger** | `LedgerAccount`, `LedgerJournalEntry`, `LedgerTransactionLine`, `PaymentDisbursement`, `SettlementVoucher` |
| **Master Data & Rules** | `VehiclePartCatalog`, `DepreciationRule`, `AutomationRule`, `RepairGarage`, `DynamicMenuItem`, `SystemSetting` |
| **Global Audit & Infra** | `SystemActivityAuditLog`, `_prisma_migrations` |

---

## 3. Common Database Commands

Run all commands from the repository root using `npx --yes pnpm`:

```powershell
# Check migration status
npx --yes pnpm --filter @omniclaim/database exec prisma migrate status

# Apply pending forward-only migrations
npx --yes pnpm --filter @omniclaim/database exec prisma migrate deploy

# Regenerate Prisma Client + rebuild @omniclaim/database dist
npx --yes pnpm --filter @omniclaim/database exec prisma generate
npx --yes pnpm --filter @omniclaim/database build

# Run idempotent database seeder (41 permissions, 6 roles, 5 users, 5 categories, 5 products, 18 menus)
npx --yes pnpm --filter @omniclaim/database run db:seed
```
