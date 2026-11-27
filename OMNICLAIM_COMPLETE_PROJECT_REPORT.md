# OmniClaim Enterprise — Complete Zero-to-End System Architecture & Functional Report

> **HOW TO USE THIS DOCUMENT WITH GPT / CHATGPT**
> Copy and paste this entire document into ChatGPT / GPT with the prompt below:
>
> ```text
> Below is the complete zero-to-end technical and functional specification of my project "OmniClaim Enterprise" (an AI-powered Auto Insurance Claims, Fraud Intelligence, Bill Reconciliation, Actuarial & Double-Entry Settlement Platform).
> Please review everything that is ALREADY built, and then suggest:
> 1. High-impact extra functionality & missing enterprise auto-insurance workflows (do NOT repeat features already listed below).
> 2. AI/ML, computer vision, OCR, and fraud-detection upgrades.
> 3. Security, compliance, multi-tenancy, and production-hardening improvements.
> 4. UX, mobile, portal, and automation enhancements that would make this a best-in-class commercial InsurTech SaaS product.
> Prioritize recommendations by Business Impact vs. Implementation Effort.
> ```

---

## 1. Executive Overview & Domain Vision

**OmniClaim Enterprise** is a full-stack, multi-platform InsurTech claims automation and financial control system built as a Turborepo monorepo. It automates and audits the entire auto-insurance claim lifecycle—from mobile First Notice of Loss (FNOL) photo/bill capture with hardware anti-spoofing sensors, to AI visual damage detection and invoice OCR, to automated "phantom repair" bill reconciliation, deterministic actuarial depreciation math, multi-factor fraud scoring (`pgvector` + geospatial telemetry), Straight-Through Processing (STP) auto-settlement, and strict double-entry GAAP/IFRS accounting with cryptographic settlement vouchers.

### Core Design Pillars
1. **100% Role-Wise Enterprise System (Dynamic Runtime RBAC)**: Every sidebar navigation menu, page route, grid column, modal field, export button, row action, and backend endpoint is dynamically permission-gated and role-scoped. Roles, permissions, and sidebar menus can be created/edited at runtime without redeploying.
2. **College ERP-Parity Enterprise DataGrid**: Every list and table across the web portal uses a unified `@tanstack/react-table` v8 `DataGrid` modeled after DevExtreme DataGrid (`FilterRow` + lookup selects, `HeaderFilter` distinct-value checklists, drag-to-group `GroupPanel`, column resizing, column chooser, CSV & `.xls` export, summary footers, server pagination, and auto-hiding role-gated `GridActionMenu`).
3. **Zero-Trust Multi-Modal Verification**: Garage repair bills are cross-checked against AI-detected physical damage on the vehicle; unverified or inflated items are automatically flagged and deducted as **Phantom Repairs**.
4. **Strict Mathematical & Financial Invariants**: Deterministic `Decimal` actuarial math, Optimistic Concurrency Control (`version` lock) on an explicit Finite State Machine (FSM), and atomic double-entry ledger postings enforcing `SUM(DEBIT) === SUM(CREDIT)`.
5. **Complete Forensic Auditability**: Every HTTP request (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) and every database mutation is captured with actor identity, IP/User-Agent, latency, redacted payloads, `oldValues`, `newValues`, and field-by-field diffs.

---

## 2. Monorepo Structure & Tech Stack

**Orchestration**: `pnpm@9.15.4` workspaces + `turbo` (`^2.3.3`) + `TypeScript 5.7.2`.

| Workspace / Package | Path | Tech Stack & Responsibilities |
| :--- | :--- | :--- |
| **Web Portal** | `apps/web` | **Next.js 15.1.6** (App Router, `17` routes), **React 19**, Tailwind CSS 3.4 (Light/Dark theme toggle), Radix UI, `lucide-react`, `@tanstack/react-table` v8.11 (`5, 10, 25, 50, All` pagination), `@tanstack/match-sorter-utils`. |
| **Core Backend API** | `apps/api` | **NestJS 10.4**, Prisma Client, **PostgreSQL 16 + `pgvector`**, **Redis 7** (with memory fallback), `decimal.js`, `@nestjs/swagger` (OpenAPI), `class-validator`/`class-transformer`, Jest (`8` suites / `50` tests). |
| **AI Inference Service** | `apps/ai-service` | **Python FastAPI 0.115+**, Uvicorn, Pydantic v2, **YOLOv8** (`ultralytics`), **PaddleOCR** (`paddlepaddle`/`paddleocr`), OpenCV (`opencv-python-headless`), `imagehash` (64-bit pHash), CLIP-style 512-d embeddings, HMAC-SHA256 signed webhook callbacks. |
| **Mobile App** | `apps/mobile` | **Expo ~52.0.0**, **React Native 0.76.2**, `expo-camera`, `expo-location`, `expo-sensors` (gyroscope), offline evidence queue, sensor anti-spoofing, and Mobile Super Admin console. |
| **Database Layer** | `packages/database` | Prisma schema (`schema.prisma` with `pgvector` extension, `44` live tables), `4` forward-only SQL migrations (`init`, `system_activity_audit_log`, `phase1_enterprise_hardening`, `add_policy_application_system`), idempotent `seed-engine.ts`. |
| **Shared Types** | `packages/shared-types` | Shared TypeScript DTOs, domain enums, and constants consumed across `web`, `api`, and `mobile`. |
| **Infrastructure** | `docker-compose.yml` | `pgvector/pgvector:pg16` (port `5432`), `redis:7-alpine` (port `6379`), `localstack/localstack` S3 (port `4566`). |

---

## 3. End-to-End Claim Lifecycle (Zero to End)

1. **Stage 1 — Authentication & Session Establishment**:
   - User signs in via Web (`/login`) or Mobile (`LoginScreen`) using `username` or `email` + password (PBKDF2-SHA512) **or** via the Super Master Password.
   - NestJS returns an HS256 JWT token + resolved permissions/role metadata; frontend hydrates live PostgreSQL state via `GET /api/v1/super-admin/bootstrap`.
2. **Stage 2 — FNOL Claim Initiation & Evidence Capture**:
   - **Web**: Policyholders or Adjusters initiate a claim from `/claims` (modal adapts fields by role: policyholders only pick their own policy, vehicle, and incident description; adjusters can set status, initial payout, fraud score, and assigned adjuster).
   - **Mobile**: Policyholders follow the 5-step **Guided AR Camera** (`FRONT_BUMPER`, `REAR_BUMPER`, `DRIVER_SIDE`, `PASSENGER_SIDE`, `REPAIR_BILL`). The app checks gyroscope stability (`magnitude < 0.25 rad/s`) and detects mock GPS providers (`mocked` / `isFromMockProvider`), queuing evidence offline if connectivity drops (`OfflineQueueService`).
3. **Stage 3 — Asynchronous Multi-Modal AI Inference**:
   - FastAPI `POST /analyze/claim` (`202 Accepted`) enqueues `process_claim_worker`:
     - **YOLOv8 Damage Detection**: Identifies damaged vehicle parts (`VehiclePartType`), material (`MaterialType`), severity (`DamageSeverity`), normalized bounding boxes, confidence scores, and `REPAIR` vs `REPLACE` action.
     - **Perceptual Hashing & Embeddings**: Computes 64-bit pHash and 512-dimensional vector embeddings for duplicate/staged-claim detection.
     - **PaddleOCR Bill Extraction**: Parses garage invoice line items, labor flags, claimed amounts, and OCR confidence.
   - Dispatches an **HMAC-SHA256** signed (`x-omniclaim-signature`) callback to NestJS `POST /api/v1/webhooks/ai-completion`.
4. **Stage 4 — Atomic Webhook Ingestion & Pipeline Execution**:
   - NestJS verifies the HMAC-SHA256 signature and runs inside a Prisma transaction:
     - Persists `DetectedDamage`, `BillLineItem`, and `ClaimEvidence.pHash`.
     - Executes **Bill Reconciliation** (`ReconciliationService`).
     - Executes **Actuarial Depreciation** (`ActuarialService`).
     - Executes **Fraud Evaluation** (`FraudEngineService`).
     - Evaluates **Straight-Through Processing (STP)** (`StpRuleEngineService`).
5. **Stage 5 — Bill Reconciliation & Phantom Item Diff**:
   - Matches each OCR/invoice `BillLineItem` against `DetectedDamage.partType`.
   - Labor items are approved if at least one physical damage is verified; unmatched part line items are marked **Phantom** (`isVerifiedByDamage = false`, `approvedCost = 0`, `systemDeduction = claimedCost`).
   - Adjusters with `claims:override_reconciliation` can manually override any line item with a mandatory audit reason.
6. **Stage 6 — Deterministic Actuarial Math**:
   - Reads active DB `DepreciationRule` rows and `STP_MAX_PAYOUT` settings inside the calculation transaction and stores `ruleVersion` + `ruleSnapshotJson` on `ActuarialAssessment` to preserve historical claim math.
7. **Stage 7 — Multi-Factor Fraud Scoring & SIU Review**:
   - Evaluates GPS distance (Haversine), mock-location flags, phantom repair ratio, policy inception proximity, and `pgvector` cosine distance against historical claims.
   - Assigns composite score (`0–100`) and tier (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
   - SIU Investigators (`fraud:override`) can override individual indicators with documented justification, dynamically recalculating the composite score and tier.
8. **Stage 8 — Advisory Straight-Through Processing (STP) vs. Human Settlement**:
   - Evaluates eligibility (`netPayout <= STP_MAX_PAYOUT`, `LOW` risk with score `< 15`, `0` discrepancies, active policy) and returns `STP_RECOMMENDED` or `MANUAL_REVIEW` with `requiresHumanPaymentAuthorization: true` — AI never directly authorizes payments or settles ledger vouchers.
9. **Stage 9 — Policy Application, Underwriting & Issuance**:
   - Customers apply via `/policies/apply` (`AUTO`, `HEALTH`, `HOME`, `LIFE`, `TRAVEL`), attach versioned documents, receive instant quotes (or go through `/underwriting`), complete idempotent `PolicyPayment` (`POLPAY-*`), and receive an active `Policy` with endorsement, renewal, and cancellation workflows.
9. **Stage 9 — FSM Transition & OCC Locking + Collaborative Presence**:
   - Adjusters acquire a 60-second `ClaimLock` presence lease while inspecting `/claims/[id]`.
   - State transitions enforce the legal FSM transition matrix and Optimistic Concurrency Control (`where: { id, version: expectedVersion }` + `version: { increment: 1 }`), returning `409 Conflict` if another adjuster modified the claim concurrently.
10. **Stage 10 — Double-Entry Ledger Settlement & Global Audit**:
    - Settling a claim creates **two balanced journals** (`ACCRUAL` + `PAYMENT`) across `5001` (Claims Expense), `2001` (Claims Payable), and `1001` (Operating Cash), verifies `Debits === Credits`, and generates a `SettlementVoucher` with a SHA-256 `qrHash`.
    - All HTTP calls and entity changes are logged to `SystemActivityAuditLog`, `ClaimTransitionLog`, `ClaimAuditLog`, and `SecurityAuditLog`.

---

## 4. Role-Wise System & Dynamic RBAC Architecture

### 4.1 Seeded Roles & Permissions
| Role Name | Slug | Scope & Capabilities |
| :--- | :--- | :--- |
| **Super Administrator** | `SUPER_ADMIN` | Wildcard (`*`) & `isSuperAdmin: true` — bypasses all permission checks across UI, API, and maintenance mode; manages masters, menus, settings, impersonation, and Super Master Password. |
| **Senior Claims Adjuster** | `CLAIMS_ADJUSTER` | `claims:read`, `claims:create`, `claims:update`, `claims:triage`, `claims:approve`, `claims:reject`, `claims:override_reconciliation`, `parts:read`, `parts:update`, `reports:read`. |
| **Junior Claims Adjuster** | `JUNIOR_ADJUSTER` | `claims:read`, `claims:update`, `claims:triage`, `fraud:read`, `audit:read` (can inspect fraud & audit, cannot approve/reject or override). |
| **SIU Fraud Investigator** | `SIU_INVESTIGATOR` | `claims:read`, `fraud:read`, `fraud:override`, `fraud:flag`, `fraud:investigate`, `reports:read`, `audit:read`. |
| **Finance & Settlement Officer** | `FINANCE_OFFICER` | `claims:read`, `claims:settle`, `ledger:read`, `ledger:post`, `ledger:reconcile`, `ledger:override`, `ledger:export`, `reports:read`, `reports:export`. |
| **Policyholder / Claimant** | `POLICYHOLDER` | `claims:read`, `claims:create` — strictly scoped to **their own policies and claims only**; cannot view Fraud tabs/columns, payout override fields, other users' claims, Ledger, Audit, or Setup. |

*(Plus runtime ability to create multiple users per role, create custom roles, and assign/revoke any of the 41 granular permissions via `/master-setup`, `/admin/roles`, `/admin/roles/[id]/rights`, or `/admin/rbac`.)*

### 4.2 Granular Permissions Catalog (41 Seeded Slugs across 11 Modules)
- **SUPER_ADMIN**: `superadmin:access`
- **CLAIMS**: `claims:read`, `claims:create`, `claims:update`, `claims:delete`, `claims:triage`, `claims:approve`, `claims:reject`, `claims:settle`
- **POLICIES**: `policies:apply`, `policies:read`
- **UNDERWRITING**: `underwriting:review`, `underwriting:approve`, `products:manage`
- **RECONCILIATION**: `claims:override_reconciliation`
- **LEDGER**: `ledger:read`, `ledger:post`, `ledger:reconcile`, `ledger:override`, `ledger:export`
- **FRAUD**: `fraud:read`, `fraud:override`, `fraud:flag`, `fraud:investigate`
- **MASTER_DATA**: `parts:read`, `parts:update`, `parts:manage`, `policies:manage`, `rules:manage`, `garages:manage`
- **SETTINGS**: `settings:manage`, `menus:manage`
- **REPORTS**: `reports:read`, `reports:export`
- **RBAC**: `rbac:roles_create`, `rbac:roles_update`, `rbac:roles_delete`, `rbac:roles_assign`, `rbac:users_assign`
- **AUDIT**: `audit:read`, `presence:unlock`

### 4.3 Authentication & Super Master Mode
- **Standard Login**: `username` OR `email` + password verified with `crypto.pbkdf2Sync(..., 100000, 64, 'sha512')`, issuing an HMAC-SHA256 signed JWT.
- **Super Master Password**: Stored as salted PBKDF2 hash in `SystemSetting` (`SUPER_MASTER_PASSWORD_HASH`) with live enable/disable toggle (`SUPER_MASTER_PASSWORD_ENABLED`). Allows Super Admins to enter **any** user's account from Web or Mobile, logged as `LOGIN_SUPER_MASTER_PASSWORD` in `SecurityAuditLog`.
- **Impersonation & Target View vs. God Mode**:
  - **God Mode** (`bypassAllPermissions: true`): Enters target account with unrestricted permission bypass.
  - **Target View** (`bypassAllPermissions: false`): Previews the exact menus, columns, grids, and buttons visible to that user's role.

### 4.4 Frontend & Backend Enforcement Layers
- **Frontend**:
  - `Sidebar`: Dynamically built from `DynamicMenuItem` tree (`sortOrder`, `isVisible`, `requiredPermission`). Parent sections auto-hide when no child menu is permitted.
  - `<RequirePageAccess>`: Wraps every protected Next.js page to block direct URL access if the role lacks permissions.
  - `<Can>` & `useRoleScope`: Controls button visibility, grid column visibility (e.g., Fraud Risk Score & Net Authorized Payout columns on `/claims`), modal editability, export permissions, and own-policy data filtering.
- **Backend**:
  - `DynamicPermissionsGuard`: Enforces verified Bearer JWT authentication (no `x-user-id` fallback), checks Redis cache (`user_permissions:{userId}`, 3600s TTL) with Prisma DB fallback, enforces `@RequirePermissions(...)`, and attaches `request.user.permissions`.
  - `ClaimsController` / `SuperAdminController` / `PolicyApplicationsController`: Enforce customer ownership scoping on claims, applications, policies, and `/super-admin/bootstrap` for non-operational policyholder roles.

---

## 5. Complete Database Schema (PostgreSQL + `pgvector`, 24 Models)

| Domain | Models | Key Capabilities & Fields |
| :--- | :--- | :--- |
| **1. Dynamic RBAC** | `Permission`, `Role`, `RolePermission`, `User`, `UserRole` | Granular `slug`/`module` permissions, `isSystem` role protection, `username` + `email` login, `isSuperAdmin` flag. |
| **2. Policy & Claim Core** | `Policy`, `Claim`, `ClaimEvidence`, `DetectedDamage`, `BillDocument`, `BillLineItem` | Vehicle VIN/year/make/model, `coverageLimit`, `baseDeductible`, `ClaimStatus` (9 states), OCC `version`, `vector(512)` CLIP embedding, `pHash`, GPS/altitude/gyroscope/mock-GPS telemetry, bounding boxes, OCR bill lines. |
| **3. Reconciliation & Actuarial** | `ReconciliationSummary`, `ReconciledLineItem`, `ActuarialAssessment` | `totalBilledAmount`, `totalApprovedAmount`, `totalPhantomAmount`, `discrepancyCount`, override reasons, material-wise depreciation breakdown, `netPayout`, `isStpQualified`. |
| **4. Fraud & Claim Audit** | `FraudScorecard`, `FraudIndicator`, `ClaimTransitionLog`, `ClaimAuditLog`, `ClaimLock` | Composite score (`0–100`), `FraudRiskTier`, 7 `FraudIndicatorType`s with JSON metadata & overrides, FSM transition audit, field-level change log, 60s presence locks. |
| **5. Double-Entry Ledger** | `LedgerAccount`, `LedgerJournalEntry`, `LedgerTransactionLine`, `SettlementVoucher` | Chart of accounts (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`), posted/voided journals, `DEBIT`/`CREDIT` lines (`Decimal(14,2)`), `VCHR-YYYY-XXXXX`, `qrHash`, `payoutMethod`. |
| **6. Super Admin Masters** | `SystemSetting`, `SecurityAuditLog`, `VehiclePartCatalog`, `DepreciationRule`, `AutomationRule`, `RepairGarage`, `DynamicMenuItem` | Runtime settings (`BRANDING`, `STP`, `FRAUD`, `SECURITY`, `GENERAL`), auth/master-password audit events, OEM vs aftermarket part prices & labor hours, age-band depreciation rules, dynamic STP/Fraud/Workflow rules, garage network & blacklist, live sidebar menu tree. |
| **7. Global HTTP Audit** | `SystemActivityAuditLog` | Tracks every HTTP method, path, `routePattern`, `module`, `entityType`/`entityId`, `statusCode`, `durationMs`, actor (`username`, `userRole`, `isMasterLogin`), IP/UA, redacted `requestBody`, `oldValues`, `newValues`, `changedFields[]`, and `errorMessage`. |

**12 Prisma Enums**: `ClaimStatus`, `VehiclePartType` (20 vehicle parts), `MaterialType` (5 materials), `DamageSeverity` (5 severities), `FraudRiskTier`, `FraudIndicatorType` (7 types), `LedgerAccountType`, `LedgerEntryType`, `JournalStatus`, `SettingValueType`, `AutomationRuleType`, `AuthAuditEventType`.

---

## 6. Complete Backend & AI API Surface

### 6.1 NestJS Core API (`apps/api`, prefix `/api/v1`)
- **Auth (`/api/v1/auth`)**:
  - `POST /login` — Username/email + password or Super Master Password.
  - `GET /me` — Current authenticated user session.
  - `POST /rotate-master-password` (`superadmin:access`) — Rotate Super Master Password & toggle enablement.
  - `POST /impersonate/:userId` (`superadmin:access`) — Issue impersonation JWT (God Mode or Target View).
  - `GET /security-audit-logs` (`audit:read`) — Query auth/master-password audit trail.
- **Claims (`/api/v1/claims`)**:
  - `POST /` (`claims:create`), `GET /` (`claims:read`, role-scoped), `GET /:id` (`claims:read`, role-scoped), `PATCH /:id` (`claims:update`), `DELETE /:id` (`claims:delete`).
  - `POST /:id/transition` (`claims:approve`) — FSM + OCC status transition.
  - `POST /:id/reconcile` (`claims:update`) & `POST /:id/reconcile/override` (`claims:override_reconciliation`).
  - `POST /:id/actuarial` (`claims:update`).
  - `POST /:id/fraud-evaluate` (`fraud:read`) & `POST /:id/fraud/override` (`fraud:override`).
  - `POST /:id/settle` (`claims:settle`) & `POST /:id/stp` (`claims:approve`).
  - `POST /:id/assign` (`claims:update`), `POST /:id/lock` (`claims:read`), `DELETE /:id/lock` (`claims:read`).
- **RBAC (`/api/v1/rbac`)**:
  - `GET /navigation-menu`, `GET /permissions`, `GET /user-permissions`.
  - `GET /roles`, `GET /roles/:id`, `POST /roles` (`rbac:roles_create`), `PATCH /roles/:id` (`rbac:roles_update`), `DELETE /roles/:id` (`rbac:roles_delete`).
  - `GET /roles/:id/permissions`, `POST /roles/:id/permissions` (`rbac:roles_update`).
  - `GET /users`, `POST /users/:id/roles` (`rbac:users_assign`).
- **Super Admin & Dynamic Masters (`/api/v1/super-admin`)**:
  - `GET /bootstrap`, `GET /overview` (`superadmin:access`), `POST /database/reseed` (`superadmin:access`).
  - Full CRUD for `settings` (`settings:manage`), `policies` (`policies:manage`), `parts` (`parts:manage`), `depreciation-rules` (`rules:manage`), `automation-rules` (`rules:manage`), `garages` (`garages:manage`), `menus` (`menus:manage`), `permissions` (`rbac:roles_*`), `users` (`rbac:users_assign`), `ledger-accounts` (`ledger:read`/`override`), `journals` (`ledger:override`).
  - `DELETE /locks/:claimId` (`presence:unlock`), `POST /claims/:id/force-status` (`superadmin:access`).
- **Audit (`/api/v1/audit`)**:
  - `GET /logs` (`audit:read` — paginated & filtered by method, module, username, entityType, statusGroup, date range, search), `GET /stats` (`audit:read`), `GET /logs/:id` (`audit:read`), `DELETE /logs/:id` (`superadmin:access`).
- **Webhooks (`/api/v1/webhooks`)**:
  - `POST /ai-completion` — HMAC-SHA256 verified FastAPI inference callback.

### 6.2 Python FastAPI AI Service (`apps/ai-service`)
- `POST /analyze/claim` (`202 Accepted`) — Background worker invoking `YoloDamageService`, `OcrInvoiceService`, and `FeatureExtractorService`, then posting signed results to NestJS.

---

## 7. Web Application Screens & Enterprise DataGrid (`apps/web`)

| Route | Purpose & Key Capabilities |
| :--- | :--- |
| `/login` | Unified username/email + password or Super Master Password login with live one-click fill panel for seeded accounts. |
| `/claims` | Role-scoped Adjuster Triage Queue (`DataGrid`). Columns (`Fraud Risk Score`, `Net Authorized Payout`), row actions (`Edit`, `Delete`), export, and Submit/Edit modal fields dynamically adapt to the active role. |
| `/claims/[id]` | Adjuster Dossier Workspace with 4 tabs: **Visual Damage Canvas** (interactive `DamageCanvas` bounding-box overlay + `CarWireframe` SVG + manual damage annotation + `DataGrid` damage inventory), **Bill Reconciliation** (`ReconciliationTable` `DataGrid` + manual item entry/override), **Fraud Scorecard** (`FraudScorecardView` `DataGrid` + SIU flags, hidden from roles without `fraud:read`), and **Actuarial Waterfall** (`ActuarialWaterfall` math breakdown). Includes Super Admin Force-FSM selector, Approve, and Settle/Post Ledger actions. |
| `/ledger` | Double-Entry Financial Ledger (`ledger:read`) with Total Debits, Total Credits, and `$0.00 Diff` invariant KPI cards; **Journal Vouchers** `DataGrid` (with Debit/Credit summaries & manual voucher modal) and **Chart of Accounts** `DataGrid`. |
| `/audit` | Enterprise Audit & Compliance (`audit:read`): 7 live HTTP telemetry KPI cards, Active Adjuster Presence Leases `DataGrid` (`Force Unlock`), server-paginated **All HTTP Requests & Diffs** `DataGrid` (with Field-by-Field Diff Inspector Modal + Old/New JSON snapshots), **Claim Field Audit** `DataGrid`, and **Master Password & Security** `DataGrid`. |
| `/admin/roles` | Role Management `DataGrid` (create/edit/delete custom roles, System role lock protection, `Rights` shortcut). |
| `/admin/roles/[id]/rights` | Module-grouped Accordion Role Rights Assignment page with Select-All indeterminate checkboxes and sticky dirty-state Save bar. |
| `/admin/rbac` | Live Role × Permission Matrix `DataGrid` with grouped modules and instant checkbox toggling. |
| `/admin/users` | System Users `DataGrid` with active/inactive toggling, user CRUD, Super Admin flag, and one-click `Login As` impersonation. |
| `/super-admin` | All-Access Command Center (7 tabs): Overview & Impersonation (`God Mode` / `Target View` `DataGrid` + Security Stream `DataGrid`), Master Password Rotation & Live Settings `DataGrid`, Policies Master `DataGrid`, Parts & Depreciation `DataGrid`s, STP & Fraud Rules `DataGrid`, Repair Garages Network/Blacklist `DataGrid`, and Dynamic Sidebar Menu Builder + Permissions Catalog `DataGrid`s. |
| `/master-setup` | Unified Master Setup Center (6 tabs with `5, 10, 25, 50, All` DataGrids): Multi-user creation per role, Roles & Rights, Policy Categories CRUD, Policy Products CRUD, Repair Garages CRUD, and Parts Catalog CRUD. |
| `/policies/apply` | 5-step Customer Policy Application Wizard (Category/Plan -> Coverage & Risk -> Versioned Documents -> Quote Review -> Idempotent Payment & Instant Issuance). |
| `/policies` | Customer/Admin Issued Policies & Applications `DataGrid` with Endorse (`+$10k`), Renew (`+1 Yr`), Cancel, and Pay Quoted Application actions. |
| `/underwriting` | Underwriting Review Queue `DataGrid` for approving (`QUOTED` + loading), requesting documents (`DOCS_REQUIRED`), or declining (`REJECTED`) pending applications. |

---

## 8. Mobile Application (`apps/mobile`)

- **`LoginScreen`**: Authenticates against NestJS via username/email + password or Super Master Password.
- **`GuidedCameraScreen`**: 5-angle AR Ghost Silhouette camera flow (`FRONT_BUMPER`, `REAR_BUMPER`, `DRIVER_SIDE`, `PASSENGER_SIDE`, `REPAIR_BILL`), `SensorValidatorService` (gyroscope stability `< 0.25 rad/s` + Android/iOS mock-GPS detection), and `OfflineQueueService` for store-and-forward upload.
- **`ClaimTrackerScreen`**: Live step-by-step disbursement timeline & authorized payout summary.
- **`SuperAdminDashboardScreen`**: Mobile command center with 4 tabs (`Claims`, `Users`, `Security / Master Password`, `Masters` for Policies/Garages/Rules) synced via `mobile-store.tsx`.

---

## 9. Core Business Logic, Formulas & Invariants

### 9.1 Claim FSM Transitions (`ClaimFsmService`)
- `DRAFT` → `SUBMITTED`
- `SUBMITTED` → `AI_PROCESSING`
- `AI_PROCESSING` → `TRIAGE_PENDING` | `AI_ANALYSIS_FAILED`
- `AI_ANALYSIS_FAILED` → `MANUAL_REVIEW`
- `TRIAGE_PENDING` → `MANUAL_REVIEW` | `APPROVED` | `REJECTED`
- `MANUAL_REVIEW` → `APPROVED` | `REJECTED`
- `APPROVED` → `SETTLED`
- Terminal states: `SETTLED`, `REJECTED`
- Protected by Optimistic Concurrency Control (`version` column check + atomic increment).

### 9.2 Actuarial Depreciation & Payout (`ActuarialService`)
- **Metal parts**: Age-graduated (`<= 1 yr: 0%`, `<= 2 yrs: 10%`, `<= 3 yrs: 20%`, `<= 4 yrs: 30%`, `>= 5 yrs: 50%`).
- **Plastic / Rubber parts**: Fixed `50%`.
- **Glass parts**: Fixed `0%`.
- **Labor**: `0%` depreciation on verified damages.
- **Formula**: `netPayout = clamp(grossParts - totalDepreciation + laborApproved - baseDeductible - salvageValue, 0, coverageLimit)`.
- **STP Eligibility Flag**: `netPayout <= $750.00` (and in `StpRuleEngineService`: `riskTier === LOW`, `compositeScore < 15`, `discrepancyCount === 0`, `policy.isActive === true`).

### 9.3 Multi-Factor Fraud Rules (`FraudEngineService`)
- `DEVICE_CLOCK_TAMPERING` (mock GPS provider): `+40` pts
- `EXIF_GPS_MISMATCH` (Haversine distance `> 1500m` from incident GPS): `+25` pts
- `PHANTOM_ITEM_DETECTED` (`totalPhantom / totalBilled > 0.30`): `+30` pts
- `POLICY_INCEPTION_PROXIMITY` (incident within `0–14 days` of policy start date): `+20` pts
- `VECTOR_SIMILARITY_DUPLICATE` (`pgvector` cosine distance `< 0.08` against other claims): `+50` pts
- **Tiers** (score capped at `100`): `LOW (< 20)`, `MEDIUM (20–44)`, `HIGH (45–69)`, `CRITICAL (>= 70)`.

### 9.4 Double-Entry Accounting (`LedgerService`)
- **Accrual Voucher**: `DEBIT` `5001` (Claims Expense) / `CREDIT` `2001` (Claims Payable).
- **Payment Voucher**: `DEBIT` `2001` (Claims Payable) / `CREDIT` `1001` (Operating Cash).
- Enforces `sum(DEBIT) === sum(CREDIT)` inside Prisma `$transaction` and generates `SettlementVoucher` with SHA-256 `qrHash`.

---

## 10. Current Stubs, Gaps & Expansion Opportunities (For GPT Analysis)

The core architecture, 44-table PostgreSQL schema (`4` forward-only migrations), RBAC, Light/Dark DataGrid UI (`5, 10, 25, 50, All` pagination), Policy Application/Underwriting/Issuance system, Master Setup Center, FSM/OCC, Ledger idempotency & reversals, Audit, and Demo Seeder are fully wired and verified (`next build` 17/17 routes + Jest 8/8 suites, 50/50 tests passing). The following infrastructure/integration enhancements remain optional future work:

1. **Real Object Storage & Presigned Uploads**: `docker-compose.yml` provisions LocalStack S3 (`4566`), and `apps/ai-service/app/routers/inference.py` notes S3/R2 download, but currently passes synthetic byte buffers (`dummy_bytes`) into YOLO/OCR/Feature services and uses placeholder photo URIs on mobile/web. Full multipart upload + presigned S3/R2 URLs + EXIF extraction from real JPEG/PDF binaries are not yet wired.
2. **Real Payment Rail & PDF Generation**: `SettlementVoucher` stores `pdfUrl` (`/vouchers/VCHR-....pdf`) and `payoutMethod` (`ACH`, `UPI`, `STRIPE`, `DIRECT_GARAGE`), but actual payment gateway adapters (Stripe Connect/Payouts, Razorpay/UPI, ACH Nacha/Plaid) and real PDF rendering (Puppeteer/PDFKit with scannable QR code) are not yet implemented.
3. **Real-Time Transport (WebSockets / SSE)**: Collaborative `ClaimLock` presence leases and live claim status updates currently use REST polling/manual refresh rather than WebSocket/SSE push channels.
4. **External Portals & Omnichannel Notifications**: No dedicated external Repair Garage Portal (estimate submission, bidding, repair milestone tracking), Third-Party/Subrogation workflow, Total Loss / Salvage auction integration, or automated Email/SMS/WhatsApp/Push notifications.
5. **Dynamic Rule Execution Alignment**: `AutomationRule` and `DepreciationRule` tables have full Super Admin CRUD UI/API, while `ActuarialService` and `StpRuleEngineService` still contain hardcoded baseline schedules alongside DB rules—these can be unified into a 100% DB-driven rule interpreter with versioning and simulation/backtesting.
6. **Persistent Mobile Offline Storage & Sync**: `OfflineQueueService` currently holds queued evidence items in memory rather than SQLite/AsyncStorage with background retry (`expo-task-manager`).
7. **Executive BI & Analytics Dashboards**: Dedicated visual analytics (loss ratios, STP rate trends, phantom savings ROI, adjuster SLA/turnaround time, fraud heatmaps, reserve adequacy / IBNR) are not yet built.
8. **Multi-Tenancy & Carrier White-Labeling**: Currently single-tenant; adding Tenant/Carrier isolation, tenant-scoped billing/quotas, and custom branding themes would enable SaaS commercialization.
9. **Testing & CI Coverage**: API has 44 Jest unit tests; Web/Mobile lack automated Playwright/Detox E2E pipelines and AI service `pytest` coverage can be expanded with benchmark image/OCR fixtures.

---

## 11. DevOps, Commands & Seeded Test Accounts

- **Database Setup**: `pnpm db:setup` (runs Prisma migrate deploy + idempotent seed; NestJS `DatabaseBootstrapService` also auto-seeds on boot if empty).
- **Development**: `pnpm dev` (Turborepo starts Web on `:3000`, API on `:4000`, etc.).
- **Build & Test**: `pnpm --filter @omniclaim/web build`, `pnpm --filter @omniclaim/api test`, `pnpm --filter @omniclaim/api build`.
- **Seeded Users** (default password `AdminOmniClaim2026!`, Super Master Password configurable dynamically in Super Admin):
  - `superadmin` (`admin@omniclaim.internal`) — `SUPER_ADMIN`
  - `sarah.jenkins` (`adjuster.senior@omniclaim.internal`) — `CLAIMS_ADJUSTER`
  - `marcus.vance` (`fraud.siu@omniclaim.internal`) — `SIU_INVESTIGATOR`
  - `david.sterling` (`finance.controller@omniclaim.internal`) — `FINANCE_OFFICER`
  - `alex.rivera` (`policyholder.demo@omniclaim.internal`) — `POLICYHOLDER`
