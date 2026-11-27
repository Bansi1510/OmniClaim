# OmniClaim REST API Reference

Base URL: `http://localhost:4000` (Swagger OpenAPI docs at `http://localhost:4000/api/docs`).
All protected endpoints require header: `Authorization: Bearer <accessToken>`.

---

## 1. Authentication (`/api/v1/auth`)

| Method | Path | Auth / Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticate by username or email; returns `accessToken`, `refreshToken`, and resolved user permissions |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate `refreshToken` and issue a fresh token pair (with reuse detection) |
| `POST` | `/api/v1/auth/logout` | Public | Revoke an active refresh token session |
| `GET` | `/api/v1/auth/me` | Valid JWT | Inspect current authenticated session |
| `POST` | `/api/v1/auth/rotate-master-password` | `superadmin:access` | Rotate Super Admin master password |
| `POST` | `/api/v1/auth/impersonate/:userId` | `superadmin:access` | Impersonate a user account for administrative support |
| `GET` | `/api/v1/auth/security-audit-logs` | `audit:read` | List authentication & security audit events |

---

## 2. Policy Catalog, Applications & Lifecycle (`/api/v1`)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/policy-catalog/categories` | `policies:read` | List active policy categories with nested active products |
| `POST` | `/api/v1/policy-catalog/categories` | `products:manage` | Create or update a policy category |
| `DELETE` | `/api/v1/policy-catalog/categories/:id` | `products:manage` | Delete unused category or deactivate if products reference it |
| `GET` | `/api/v1/policy-catalog/products` | `policies:read` | List active products (optional `?categoryCode=`) |
| `POST` | `/api/v1/policy-catalog/products` | `products:manage` | Create or version-bump a policy product |
| `DELETE` | `/api/v1/policy-catalog/products/:id` | `products:manage` | Delete unused product or deactivate if referenced |
| `GET` | `/api/v1/policy-applications` | `policies:read` | List applications (scoped to own for policyholders; all for underwriters/admins) |
| `GET` | `/api/v1/policy-applications/:id` | `policies:read` | Get full application dossier (documents, quotes, underwriting reviews, payments) |
| `POST` | `/api/v1/policy-applications` | `policies:apply` | Create a new draft policy application validated against product limits |
| `PATCH` | `/api/v1/policy-applications/:id` | `policies:apply` | Update draft or `DOCS_REQUIRED` application |
| `POST` | `/api/v1/policy-applications/:id/documents` | `policies:apply` | Attach versioned supporting document metadata |
| `POST` | `/api/v1/policy-applications/:id/submit` | `policies:apply` | Submit application (auto-quotes if eligible or queues for underwriting) |
| `POST` | `/api/v1/policy-applications/:id/quote` | `underwriting:review` | Generate a Decimal-safe binding quote |
| `POST` | `/api/v1/policy-applications/:id/quotes/:quoteId/accept` | `policies:apply` | Accept a valid quote |
| `POST` | `/api/v1/policy-applications/:id/quotes/:quoteId/reject` | `policies:apply` | Reject a quote |
| `POST` | `/api/v1/policy-applications/:id/underwriting` | `underwriting:approve` | Submit underwriting decision (`APPROVED`, `DECLINED`, `NEEDS_INFO`) |
| `POST` | `/api/v1/policy-applications/:id/pay-and-issue` | `policies:apply` | Idempotent premium payment and instant `Policy` issuance |
| `GET` | `/api/v1/policies` | `policies:read` | List issued policies (customer-scoped for policyholders) |
| `POST` | `/api/v1/policies/:id/endorsements` | `policies:apply` | Create a policy endorsement updating coverage, deductible, or premium |
| `POST` | `/api/v1/policies/:id/renew` | `policies:apply` | Renew an active/expired policy by 12 months |
| `POST` | `/api/v1/policies/:id/cancel` | `policies:apply` | Cancel a policy with an audit reason |

---

## 3. Claims, Reconciliation, Actuarial, Fraud & Settlement (`/api/v1/claims`)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/claims` | `claims:read` | List/search claims (customer-scoped for policyholders; filters: `status`, `search`, `skip`, `take`) |
| `GET` | `/api/v1/claims/:id` | `claims:read` | Full claim dossier (policy, evidences, damages, bills, reconciliation, actuarial, fraud, logs) |
| `POST` | `/api/v1/claims` | `claims:create` | Create a new claim against an active policy |
| `PATCH` | `/api/v1/claims/:id` | `claims:update` | Update claim fields with OCC version increment |
| `DELETE` | `/api/v1/claims/:id` | `claims:delete` | FK-safe transactional deletion (detaches ledger journals cleanly) |
| `POST` | `/api/v1/claims/:id/transition` | `claims:approve` | Execute FSM status transition with optimistic concurrency version check |
| `POST` | `/api/v1/claims/:id/reconcile` | `claims:update` | Reconcile OCR bill line items against detected damages |
| `POST` | `/api/v1/claims/:id/reconcile/override` | `claims:override_reconciliation` | Adjuster override on a reconciled item with reason & audit trail |
| `POST` | `/api/v1/claims/:id/actuarial` | `claims:update` | Calculate net payout using active DB `DepreciationRule` & `STP_MAX_PAYOUT` |
| `POST` | `/api/v1/claims/:id/fraud-evaluate` | `fraud:read` | Evaluate Haversine GPS, mock location, phantom ratio, inception proximity, & pgvector similarity |
| `POST` | `/api/v1/claims/:id/fraud/override` | `fraud:override` | Override a fraud indicator with justification |
| `POST` | `/api/v1/claims/:id/settle` | `claims:settle` + `ledger:post` | Idempotent double-entry settlement posting & voucher creation |
| `POST` | `/api/v1/claims/:id/stp` | `claims:approve` | Advisory STP eligibility check (`requiresHumanPaymentAuthorization: true`) |
| `POST` | `/api/v1/claims/:id/supplements` | `claims:create` | Submit a `SUPPLEMENT`, `DISPUTE`, or `APPEAL` on an existing claim |
| `POST` | `/api/v1/claims/:id/reopen` | `claims:approve` | Reopen a `SETTLED` or `REJECTED` claim to `REOPENED` via FSM |
| `POST` | `/api/v1/claims/:id/assign` | `claims:update` | Assign claims adjuster |
| `POST` / `DELETE` | `/api/v1/claims/:id/lock` | `claims:read` | Acquire/refresh or release 60s adjuster presence lock |

---

## 4. RBAC, Super Admin, Audit & Webhooks

- **RBAC (`/api/v1/rbac`)**: `GET navigation-menu`, `GET/POST/PATCH/DELETE roles`, `GET permissions`, `GET/POST roles/:id/permissions`, `GET user-permissions`, `GET users`, `POST users/:id/roles`.
- **Super Admin (`/api/v1/super-admin`)**:
  - `GET bootstrap` (requires valid JWT; filtered for policyholders)
  - `GET overview` (`superadmin:access`), `POST database/reseed` (`superadmin:access`), `POST claims/:id/force-status` (`superadmin:access`)
  - CRUD for `settings` (`settings:manage`), `policies` (`policies:manage`), `parts` (`parts:manage`), `depreciation-rules` & `automation-rules` (`rules:manage`), `garages` (`garages:manage`), `menus` (`menus:manage`), `users` (`rbac:users_assign`), `ledger-accounts` (`ledger:read`/`ledger:override`), `journals` (`ledger:override`), `locks/:claimId` (`presence:unlock`).
- **Audit (`/api/v1/audit`)**: `GET logs`, `GET stats`, `GET logs/:id` (`audit:read`), `DELETE logs/:id` (`superadmin:access`).
- **Webhooks (`/api/v1/webhooks`)**: `POST ai-completion` (verified via `x-omniclaim-signature` HMAC-SHA256).
