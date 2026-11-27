# OmniClaim Enterprise Architecture

## 1. High-Level System Architecture

```mermaid
flowchart LR
    Web["Web Portal (Next.js 15)"] -->|"Bearer JWT + JSON"| API["Core API (NestJS 10)"]
    Mobile["Mobile App (Expo)"] -->|"Bearer JWT + Sensor Telemetry"| API
    API -->|"Prisma ORM + Decimal"| DB[("PostgreSQL 16 + pgvector")]
    API -->|"Permission Cache"| Redis[("Redis 7 / Memory Fallback")]
    AI["AI Service (FastAPI Python)"] -->|"HMAC-SHA256 Webhook"| API
```

---

## 2. Security & Access Control Controls

- **Strict Bearer JWT Authentication** (`DynamicPermissionsGuard` + `CurrentUser`): Requests to protected routes require a valid HS256-signed Bearer JWT (`JWT_SECRET`). Unauthenticated or spoofed header requests (`x-user-id` without JWT) are rejected with `401 Unauthorized`.
- **Refresh Token Rotation & Reuse Detection** (`RefreshToken` table): `POST /api/v1/auth/login` issues a 24h JWT `accessToken` and a 7-day opaque `refreshToken` stored as a SHA-256 hash. Rotating via `POST /api/v1/auth/refresh` invalidates the previous token; re-presenting a revoked token revokes all active tokens for that user.
- **Row-Level Policyholder Scoping**:
  - `GET /api/v1/super-admin/bootstrap`, `GET /api/v1/claims`, `GET /api/v1/claims/:id`, `GET /api/v1/policy-applications`, `GET /api/v1/policy-applications/:id`, and `GET /api/v1/policies` restrict `POLICYHOLDER` accounts strictly to their own policies, claims, and applications.
- **Separation of Duties**:
  - Claim approval requires `claims:approve`; financial settlement disbursement requires both `claims:settle` and `ledger:post`.
  - AI / Straight-Through Processing (`StpRuleEngineService`) produces advisory recommendations (`STP_RECOMMENDED` / `MANUAL_REVIEW`) and never directly authorizes or posts payments.
- **Webhook Security**: `/api/v1/webhooks/ai-completion` enforces timing-safe HMAC-SHA256 signature verification (`x-omniclaim-signature`) in all environments.

---

## 3. Claim Finite State Machine (FSM)

Every status change in `ClaimFsmService` executes inside a database transaction with Optimistic Concurrency Control (`version` increment check) and writes an immutable `ClaimTransitionLog` entry.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED
    SUBMITTED --> AI_PROCESSING
    AI_PROCESSING --> TRIAGE_PENDING
    AI_PROCESSING --> AI_ANALYSIS_FAILED
    AI_ANALYSIS_FAILED --> MANUAL_REVIEW
    TRIAGE_PENDING --> MANUAL_REVIEW
    TRIAGE_PENDING --> APPROVED
    TRIAGE_PENDING --> REJECTED
    MANUAL_REVIEW --> APPROVED
    MANUAL_REVIEW --> REJECTED
    APPROVED --> PAYMENT_PENDING
    APPROVED --> SETTLED
    APPROVED --> DISPUTED
    PAYMENT_PENDING --> SETTLED
    PAYMENT_PENDING --> PAYMENT_FAILED
    PAYMENT_FAILED --> PAYMENT_PENDING
    PAYMENT_FAILED --> MANUAL_REVIEW
    SETTLED --> REOPENED
    SETTLED --> DISPUTED
    REJECTED --> REOPENED
    REJECTED --> DISPUTED
    DISPUTED --> MANUAL_REVIEW
    DISPUTED --> APPROVED
    DISPUTED --> REJECTED
    REOPENED --> MANUAL_REVIEW
    REOPENED --> TRIAGE_PENDING
```

---

## 4. Policy Application & Issuance Flow

```mermaid
flowchart TD
    A["Draft Created (APP-YYYYMM-XXXXX)"] --> B["Attach Supporting Documents (Versioned)"]
    B --> C{"Instant Quote Eligible?"}
    C -->|"Yes (within autoApproveMaxCoverage)"| D["Auto-Quoted (QUOTED)"]
    C -->|"No (High Coverage / Underwriting)"| E["Underwriting Queue (SUBMITTED)"]
    E -->|"APPROVED (+ optional loading)"| D
    E -->|"NEEDS_INFO"| F["DOCS_REQUIRED -> Customer Updates"]
    E -->|"DECLINED"| G["REJECTED"]
    D --> H["Quote Accepted (QUOTE_ACCEPTED)"]
    H --> I["Idempotent Payment (POLPAY-appId)"]
    I --> J["Binding Policy Issued (POL-CAT-YYYYMM-XXXXX)"]
    J --> K["Endorsements / Renewals (+12m) / Cancellation"]
```

---

## 5. Financial, Actuarial & Audit Invariants

- **Double-Entry Zero-Sum Ledger**: Every `LedgerJournalEntry` validates `sum(Debits) === sum(Credits)` using arbitrary-precision `Prisma.Decimal`.
- **Idempotent Disbursements & Payments**: Both claim settlements (`PaymentDisbursement`, default key `SETTLE-${claimId}`) and policy premium payments (`PolicyPayment`, default key `POLPAY-${applicationId}`) enforce unique `idempotencyKey` constraints so duplicate requests replay safely without double-posting.
- **Audit-Safe Journal Reversals**: `LedgerService.reverseJournalEntry` creates an equal-and-opposite contra journal entry (`reversalOfJournalId`) and marks the original entry `VOIDED`.
- **Global HTTP Request & Field-Diff Logging**: `AuditLoggingInterceptor` and `AuditFallbackMiddleware` record `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests into `SystemActivityAuditLog`, tracking old values, new values, per-field diffs, redacting secrets/passwords, and recording actor username/IP/duration.
