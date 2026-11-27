# OmniClaim Enterprise — Complete Zero-to-End System Architecture & Functional Report

---

## 1. Executive Overview & Domain Vision

**OmniClaim Enterprise** is a full-stack, multi-platform InsurTech policy and claims automation platform built as a Turborepo monorepo. It spans policy catalog configuration (`Category → Vehicle Type → Policy Product`), policy underwriting and issuance, live camera-guided claim evidence intake, AI visual damage detection and invoice OCR, automated "phantom repair" bill reconciliation, deterministic actuarial depreciation math, multi-factor fraud scoring (`pgvector` + geospatial telemetry), Straight-Through Processing (STP) advisory recommendations, and strict double-entry GAAP/IFRS accounting with cryptographic settlement vouchers.

### Core Design Pillars
1. **100% Role-Wise Enterprise System (Dynamic Runtime RBAC)**: Every sidebar section (**Operations** and **Administration**), route, grid column, modal field, export button, row action, and backend endpoint is dynamically permission-gated and role-scoped. Roles, permissions, vehicle types, and sidebar menus are configurable at runtime.
2. **Enterprise DataGrid Across All Modules**: Lists across the web portal use a unified `@tanstack/react-table` v8 `DataGrid` with `5, 10, 25, 50, All` pagination, column filters, header distinct-value checklists, drag-to-group, column chooser, CSV/Excel export, and role-gated `GridActionMenu`.
3. **Zero-Trust Claim Capture & Verification**: Browser evidence capture uses a 7-step live camera workflow (no customer gallery upload), validated on the backend via image magic bytes, SHA-256 checksums, server timestamps, and customer ownership enforcement. Garage repair bills are cross-checked against AI-detected physical damage to deduct **Phantom Repairs**.
4. **Strict Authentication & Onboarding Hygiene**: Direct role switching and one-click user impersonation are removed. New team accounts created under any role receive a guaranteed unique username and a common initial password (`OmniClaim@123`), with `mustChangePassword: true` prompting a mandatory self-service password change upon first login (`POST /api/v1/auth/change-password`).
5. **Strict Mathematical & Financial Invariants**: Deterministic `Decimal` actuarial math, Optimistic Concurrency Control (`version` lock) on the Claim FSM, idempotent policy payments (`POLPAY-*`) and claim settlements (`SETTLE-*`), equal-and-opposite double-entry journal reversals, and `SUM(DEBIT) === SUM(CREDIT)` invariants.
6. **Complete Forensic Auditability**: Every HTTP request (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) and entity mutation is logged to `SystemActivityAuditLog` with actor identity, redacted payloads, `oldValues`, `newValues`, and field diffs.

---

## 2. Monorepo Structure & Verified Tech Stack

**Orchestration**: `pnpm@9.15.4` workspaces + `turbo` (`^2.3.3`) + `TypeScript 5.7.2`.

| Workspace / Package | Path | Tech Stack & Responsibilities |
| :--- | :--- | :--- |
| **Web Portal** | `apps/web` | **Next.js 15.1.6** (App Router, `17` routes), **React 19**, Tailwind CSS 3.4 (`postcss.config.js`, Light default + Light/Dark navbar toggle), Radix UI, `lucide-react`, `@tanstack/react-table` v8.11 (`5, 10, 25, 50, All` pagination). |
| **Core Backend API** | `apps/api` | **NestJS 10.4**, Prisma Client, **PostgreSQL 16 + `pgvector`**, **Redis 7** (with memory fallback), `decimal.js`, `@nestjs/swagger` (OpenAPI `/api/docs`), `class-validator`/`class-transformer`, Jest (`9` suites / `54` tests passing). |
| **AI Inference Service** | `apps/ai-service` | **Python FastAPI 0.115+**, Uvicorn, Pydantic v2, **YOLOv8**, **PaddleOCR**, OpenCV, `imagehash` (64-bit pHash), 512-d embeddings, HMAC-SHA256 webhook callbacks *(not executed locally when Python is absent)*. |
| **Mobile App** | `apps/mobile` | **Expo ~52.0.0**, **React Native 0.76.2**, `expo-camera`, `expo-location`, `expo-sensors` (gyroscope), offline evidence queue, sensor telemetry. |
| **Database Layer** | `packages/database` | Prisma schema (`schema.prisma` with `pgvector`, **45 live tables**), **6 forward-only SQL migrations**, idempotent `seed-engine.ts`. |
| **Shared Types** | `packages/shared-types` | Shared TypeScript DTOs, domain enums, and role presets. |

---

## 3. Completed System Modules & Recent Enhancements

### 3.1 Phase 1 Enterprise Hardening
- Mandatory HS256 Bearer JWT authentication across all protected endpoints (`DynamicPermissionsGuard`), removing insecure header fallbacks.
- Refresh token rotation & reuse detection (`RefreshToken` table).
- Strict policyholder ownership scoping on claims, policies, policy applications, evidence downloads, and `/super-admin/bootstrap`.
- Full Claim FSM (`DRAFT` → `SUBMITTED` → ... → `SETTLED` / `PAYMENT_PENDING` / `PAYMENT_FAILED` / `DISPUTED` / `REOPENED`) with OCC `version` checks, supplements/disputes/reopening endpoints, idempotent settlements, equal-and-opposite ledger journal reversals, DB-driven actuarial rules, advisory-only STP output, and strict HMAC-SHA256 webhook verification.

### 3.2 Policy Application, Underwriting & Issuance System
- Hierarchical catalog: `PolicyCategory` (`AUTO`, `HEALTH`, `HOME`, `LIFE`, `TRAVEL`) → `VehicleType` (`CAR`, `BIKE`, `BUS`) → `PolicyProduct` (multiple plans per vehicle type, eligibility/add-ons/exclusions JSON).
- 5-step customer wizard (`/policies/apply`), versioned document metadata, Decimal quotes, Underwriting Review Queue (`/underwriting`), idempotent `PolicyPayment`, instant `Policy` issuance, endorsements, renewals, and cancellations (`/policies`).

### 3.3 Feature 1 — Guided Live Camera Claim Evidence Capture
- Customer-facing 7-step camera capture (`apps/web/components/claims/live-camera-capture.tsx`) on `/claims/[id]` with framing overlay, blur/darkness warnings, retake/confirm preview, and zero customer gallery picker.
- NestJS endpoints `POST /api/v1/claims/:id/evidence/capture`, `POST /api/v1/claims/:id/evidence/staff-upload` (requiring `claims:update` and `exceptionReason`), and `GET /api/v1/claims/:id/evidence/:evidenceId/file` with JPEG/PNG/WEBP magic-byte validation, max 8 MB cap, SHA-256 checksums, server timestamps, disk persistence in `apps/api/uploads/evidence/<claimId>/`, and `ClaimAuditLog` entries.
- *Limitation note*: Browser camera capture prevents casual gallery selection in standard UI flows, though client-side APIs cannot provide absolute proof against virtual camera drivers; server-side magic bytes, checksums, and audit trails harden persistence.

### 3.4 Auth, Password Hygiene & Sidebar Master Setup
- Removed direct role switcher (`RoleSwitcher`), top-bar `Switch Account`, and `/api/v1/auth/impersonate/:userId` (along with UI impersonation triggers).
- Reorganized sidebar navigation (`apps/web/components/layout/sidebar.tsx` + DB `DynamicMenuItem`) into **Operations** and **Administration** sections, moving **Master Setup** into a collapsible sidebar dropdown linking to `/master-setup?section=...` (`users`, `roles`, `categories`, `vehicleTypes`, `products`, `garages`, `parts`).
- Role-based user creation generates unique usernames + common initial password (`OmniClaim@123`) with `mustChangePassword: true` and an automatic/on-demand **Change Password** modal (`POST /api/v1/auth/change-password`).

---

## 4. Database Schema (45 PostgreSQL Tables, 6 Migrations)

1. `20261126000000_init_omniclaim_enterprise` — Initial 30 RBAC, Claims, Fraud, Actuarial, Ledger & Master tables (`pgvector` enabled).
2. `20261126010000_add_system_activity_audit_log` — `SystemActivityAuditLog`.
3. `20261127000000_phase1_enterprise_hardening` — Extended `ClaimStatus`, `RefreshToken`, `ClaimSupplement`, `PaymentDisbursement`, versioning/review columns.
4. `20261127010000_add_policy_application_system` — `PolicyCategory`, `PolicyProduct`, `PolicyApplication`, `PolicyApplicationDocument`, `InsuranceQuote`, `UnderwritingReview`, `PolicyPayment`, `PolicyEndorsement`, `PolicyRenewal`.
5. `20261127020000_feature1_camera_and_feature2_vehicle_types` — `VehicleType`, `ClaimEvidence` capture metadata & checksum columns, `PolicyProduct` vehicle hierarchy/addons/exclusions.
6. `20261127030000_user_must_change_password` — `User.mustChangePassword`.

---

## 5. Verification Status & Roadmap (Features 3–13)

- **Executed Checks**:
  - `npx --yes pnpm --filter @omniclaim/api test`: **9/9 suites, 54/54 tests passing**.
  - Builds: `@omniclaim/database`, `@omniclaim/shared-types`, `@omniclaim/api`, `@omniclaim/web` (17 routes) exit `0`.
  - Live API & Chrome E2E verification completed against NestJS `:4000`, Next.js `:3000`, and Neon PostgreSQL (live camera upload, vehicle type product hierarchy, removed impersonation `404`, unique username + initial common password creation, password change flow, and sidebar routes).
- **Planned Enterprise Phases (Features 3–13)**:
  - **Phase B (Claims & Workflow Depth)**: Feature 4 (Supplement & Reassessment UI/workflow), Feature 5 (Line-by-Line Damage & Repair Validation), Feature 6 (Dispute & Appeal Management UI), Feature 9 (Persistent Notifications).
  - **Phase C (Partner, Specialty & Financial Workflows)**: Feature 8 (Payment Gateway Recovery & Refunds), Feature 10 (Garage Partner Portal), Feature 11 (Configurable Total Loss & Salvage), Feature 12 (Subrogation & Recovery).
  - **Phase D (AI Pipeline, Mobile Offline & BI)**: Feature 3 (Real AI Evidence Processing Pipeline & job tracking), Feature 7 (Persistent Mobile Offline Storage & Sync), Feature 13 (Role-Scoped Enterprise Reporting Dashboard).
