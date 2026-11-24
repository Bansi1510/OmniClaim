# 🛡️ OmniClaim
### Automated Multi-Modal Insurance Claim & Fraud Detection Engine

[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444.svg)](https://turbo.build/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15_App_Router-black.svg)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-Core_API-e0234e.svg)](https://nestjs.com/)
[![Neon Postgres](https://img.shields.io/badge/Neon-pgvector-00e599.svg)](https://neon.tech/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_AI-009688.svg)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_52-22c55e.svg)](https://expo.dev/)

---

## 📌 Overview

**OmniClaim** is an enterprise-tier insurtech engine that automates auto accident claims processing, eliminates phantom garage repair costs, detects fraud using vector similarity and geospatial anti-spoofing, and settles payouts using double-entry balanced accounting ledger transactions.

---

## 🏗️ Monorepo Architecture

```text
omniclaim/
├── apps/
│   ├── web/             # Next.js 15 (Adjuster Command Center, BBox Annotator, RBAC Matrix)
│   ├── api/             # NestJS (FSM, Actuarial Engine, Reconciliation, Ledger, RBAC)
│   ├── ai-service/      # Python FastAPI (YOLOv8 Damage Detection, PaddleOCR Bill Extraction)
│   └── mobile/          # React Native Expo (AR Ghost Alignment, Hardware Sensor Validation)
├── packages/
│   ├── database/        # Neon PostgreSQL (Prisma ORM, pgvector, GAAP/IFRS Ledger, Dynamic RBAC)
│   ├── shared-types/    # Shared TypeScript contracts and DTOs
│   ├── tsconfig/        # Base TypeScript compiler configurations
│   └── eslint-config/   # Monorepo linting standards
└── docker-compose.yml   # PostgreSQL + pgvector, Redis (BullMQ), LocalStack S3
```

---

## ⚡ Core Business Capabilities

1. **Multi-Angle Camera Capture (Mobile)**: Sequential photo intake with gyroscope stability gate and hardware mock-GPS detection.
2. **AI Damage & Invoice Perception (Python)**: YOLOv8 vehicle part damage segmentation + PaddleOCR bill line-item extraction.
3. **Bill Reconciliation Engine (NestJS)**: Automatic diffing between physical damage and garage billed items to eliminate unverified/phantom charges.
4. **Actuarial Math Engine (NestJS)**: Deterministic arbitrary-precision depreciation schedules (Glass: 0%, Plastic: 50%, Metal: age-graduated 0–50%).
5. **Multi-Factor Fraud Risk Engine (NestJS)**: Haversine GPS delta, hardware integrity checks, and pgvector cosine similarity search (`<=>`) for duplicate vehicle damage images.
6. **Strict Finite State Machine (FSM)**: Race-condition-free claim lifecycle transitions protected by optimistic concurrency version locks (`version Int`).
7. **GAAP/IFRS Double-Entry Ledger**: Balanced debit/credit payout voucher creation with strict atomic zero-sum verification ($\sum \text{Debits} \equiv \sum \text{Credits}$).
8. **Dynamic Runtime RBAC**: Roles and permissions can be added, modified, and revoked at runtime through an interactive visual matrix with instant Redis cache invalidation.
9. **Straight-Through Processing (STP)**: Instant automated settlement for low-risk, verified claims under $750 in under 45 seconds.

---

## 🚀 Quick Start (Development)

### 1. Prerequisites
- **Node.js**: v20+ or v24+
- **pnpm**: `corepack enable` or `npm install -g pnpm`
- **Docker**: For running PostgreSQL (pgvector) and Redis locally
- **Python**: 3.11+ for the AI microservice

### 2. Infrastructure Setup
```bash
# Start PostgreSQL (pgvector), Redis, and LocalStack S3
docker compose up -d

# Install monorepo dependencies
pnpm install

# Run database migrations and seed chart of accounts + RBAC
pnpm run db:push
pnpm run db:seed
```

### 3. Run Development Servers
```bash
# Start all microservices in parallel via Turborepo
pnpm run dev
```

- **Web Dashboard**: `http://localhost:3000`
- **NestJS Core Gateway**: `http://localhost:4000`
- **FastAPI AI Microservice**: `http://localhost:8000/docs`
- **Prisma Studio**: `pnpm run db:studio`

---

## 🔒 Default Seed Credentials

- **Admin User**: `admin@omniclaim.internal`
- **Password**: `AdminOmniClaim2026!`
- **Role**: `SUPER_ADMIN` (Full Dynamic Permissions)

---

## 📄 License
Enterprise InsurTech Blueprint — OmniClaim Platform.
