# OmniClaim Enterprise

**Insurance Policy Management, Automated Claims Processing, Fraud Review & Double-Entry Accounting Platform**

[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444.svg)](https://turbo.build/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15_App_Router-black.svg)](https://nextjs.org/)
[![NestJS 10](https://img.shields.io/badge/NestJS-10_Core_API-e0234e.svg)](https://nestjs.com/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL_16-Prisma_%2B_pgvector-00e599.svg)](https://www.postgresql.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo_Mobile-22c55e.svg)](https://expo.dev/)

---

## Overview

**OmniClaim Enterprise** is a full-stack insurtech monorepo covering the complete insurance lifecycle:

1. **Policy Catalog, Application & Issuance**: Multi-category products (`AUTO`, `HEALTH`, `HOME`, `LIFE`, `TRAVEL`), draft/resume applications, versioned supporting documents, Decimal-safe backend quoting, Underwriting Review Queue, idempotent premium payment, instant binding Policy issuance, endorsements, renewals, and cancellations.
2. **Claims Management & Finite State Machine**: End-to-end claims intake, OCC-locked state transitions, supplemental claims/disputes/appeals, reopening workflows, and collaborative adjuster presence locks.
3. **Bill Reconciliation & Actuarial Math**: Image damage vs. repair invoice diffing with confidence thresholds and human-review flags on unmatched labor, plus database-driven, versioned depreciation schedules (`DepreciationRule` + `STP_MAX_PAYOUT` snapshots).
4. **Fraud Review & Ledger Separation of Duties**: Geospatial distance checks, mock-GPS flags, `pgvector` duplicate photo similarity (`<=>`), advisory Straight-Through Processing (STP) recommendations (AI never directly disburses funds), idempotent settlement disbursements, and equal-and-opposite double-entry journal reversals (`sum(Debits) === sum(Credits)`).
5. **Dynamic RBAC, Master Setup & Global Audit Trail**: Runtime role and permission management, unified `/master-setup` CRUD console (create multiple users per role, manage roles, policy categories, products, garages, and parts), `DataGrid` (`5, 10, 25, 50, All` pagination + CSV/Excel export), and automatic HTTP request + field-diff audit logging (`SystemActivityAuditLog`).

---

## Documentation Index

| Guide | Purpose |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, security boundaries, Claim FSM, Policy Application lifecycle, and ledger invariants |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Complete REST endpoint catalog, request rules, and required RBAC permissions |
| [docs/DATABASE.md](docs/DATABASE.md) | All 44 PostgreSQL tables, 4 forward-only Prisma migrations, and idempotent seeding |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Role-by-role plain-English walkthroughs for customers, adjusters, underwriters, finance, and admins |

---

## Monorepo Structure

```text
OmniClaim/
├── apps/
│   ├── web/              # Next.js 15 + React 19 + Tailwind CSS (Light/Dark theme, DataGrid UI)
│   ├── api/              # NestJS 10 REST API (Auth, Claims, FSM, Policy Apps, Actuarial, Ledger, RBAC, Audit)
│   ├── ai-service/       # Python FastAPI service (YOLOv8 damage segmentation, PaddleOCR, embeddings)
│   └── mobile/           # React Native Expo client
├── packages/
│   ├── database/         # Prisma ORM schema, forward-only SQL migrations, and idempotent seeder
│   ├── shared-types/     # Shared TypeScript DTOs and role presets
│   ├── tsconfig/         # Shared TypeScript configs
│   └── eslint-config/    # Monorepo ESLint config
├── docs/                 # Regenerated enterprise documentation
└── docker-compose.yml    # Local PostgreSQL (pgvector), Redis, and LocalStack S3
```

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v20+
- **pnpm**: `npx --yes pnpm` (or global `pnpm`)
- **PostgreSQL 16** with `pgvector` extension (local Docker or Neon PostgreSQL configured via `.env`)
- **Redis 7** (optional in dev; `RedisService` falls back to an in-memory cache if Redis is not running)
- **Python 3.11+** (optional, for running `apps/ai-service`)

### 2. Install & Configure Environment
Configure `DATABASE_URL` and `JWT_SECRET` in `.env`, `packages/database/.env`, and `apps/api/.env` (see `.env.example` files in those directories; never commit `.env` files).

```powershell
npx --yes pnpm install
npx --yes pnpm --filter @omniclaim/database exec prisma migrate deploy
npx --yes pnpm --filter @omniclaim/database exec prisma generate
npx --yes pnpm --filter @omniclaim/database run db:seed
```

### 3. Build & Run

```powershell
# Build shared packages, API, and Web app
npx --yes pnpm --filter @omniclaim/database build
npx --yes pnpm --filter @omniclaim/shared-types build
npx --yes pnpm --filter @omniclaim/api build
npx --yes pnpm --filter @omniclaim/web build

# Start Backend API (port 4000) and Web App (port 3000)
cd apps/api; $env:PORT="4000"; node dist/src/main.js
npx --yes pnpm --filter @omniclaim/web start -p 3000
```

- **Web Portal**: `http://localhost:3000`
- **Login Page**: `http://localhost:3000/login`
- **API Swagger Docs**: `http://localhost:4000/api/docs`

---

## Testing & Verification

```powershell
# Run API Jest unit & integration test suites (8 suites / 50 tests)
npx --yes pnpm --filter @omniclaim/api test

# Verify Prisma migration sync
npx --yes pnpm --filter @omniclaim/database exec prisma migrate status
```

---

## Default Seed Accounts

| Role | Username | Email | Password (`DEFAULT_SEED_PASSWORD`) |
|---|---|---|---|
| **Super Administrator** | `superadmin` | `admin@omniclaim.internal` | `AdminOmniClaim2026!` |
| **Claims Adjuster / Underwriter** | `sarah.jenkins` | `adjuster.senior@omniclaim.internal` | `AdminOmniClaim2026!` |
| **SIU Fraud Investigator** | `marcus.vance` | `fraud.siu@omniclaim.internal` | `AdminOmniClaim2026!` |
| **Finance & Settlement Officer** | `david.sterling` | `finance.controller@omniclaim.internal` | `AdminOmniClaim2026!` |
| **Policyholder / Customer** | `alex.rivera` | `policyholder.demo@omniclaim.internal` | `AdminOmniClaim2026!` |
