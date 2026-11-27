# OmniClaim User Guide

OmniClaim adapts automatically to your signed-in role and supports both **Light** (default) and **Dark** themes via the Moon/Sun button in the top navigation bar.

---

## 1. Signing In & Switching Themes

1. Open **`http://localhost:3000/login`**.
2. Enter your username or email (for example `superadmin`, `sarah.jenkins`, or `alex.rivera`) and password (`AdminOmniClaim2026!` on seeded environments).
3. Use the **Moon / Sun** toggle in the top bar at any time to switch between Light and Dark mode.
4. Every DataGrid table lets you choose **`5`**, **`10`**, **`25`**, **`50`**, or **`All`** rows per page, filter individual columns, sort, group rows, and export to **CSV** or **Excel**.

---

## 2. Applying for a New Insurance Policy (Customer Flow)

1. Go to **Apply for Policy** (`/policies/apply`).
2. **Step 1 — Category & Plan**: Choose a category (`Auto`, `Health`, `Home`, `Life`, or `Travel`) and select a plan.
3. **Step 2 — Coverage & Risk**: Enter requested coverage, deductible, term length, contact details, and category-specific details (e.g., vehicle VIN/make/model for Auto, age for Health/Life, property address for Home, destination for Travel). Click **Save Draft & Attach Documents**.
4. **Step 3 — Documents**: Attach supporting document metadata (such as `ID_PROOF`, `VEHICLE_RC`, or `PASSPORT_ID`) and click **Submit Application & Calculate Quote**.
5. **Step 4 — Quote Review**:
   - Applications within the product's instant-quote limit generate a live quote immediately.
   - Higher-coverage or underwriting-required applications enter **Underwriting Review** until approved by an underwriter.
6. **Step 5 — Complete Payment & Activate Policy**: Select a payment method (`CARD`, `ACH`, `UPI`, or `STRIPE`) and activate your policy instantly.

---

## 3. Managing Active Policies (`/policies`)

Open **My Policies** (`/policies`) to switch between **Issued Policies** and **Policy Applications**:
- **Endorse (+$10k)**: Increase policy coverage with an immediate endorsement record.
- **Renew (+1 Yr)**: Extend an active or expired policy by 12 months.
- **Cancel Policy**: Cancel an active policy with an audit reason.
- **Pay & Issue Policy**: Complete payment on any approved/quoted application directly from the table.

---

## 4. Reviewing Applications as an Underwriter (`/underwriting`)

Users with `underwriting:review` / `underwriting:approve` (e.g., `sarah.jenkins` or `superadmin`) can open **Underwriting Review** (`/underwriting`):
1. Locate any application in status `SUBMITTED`, `UNDER_REVIEW`, or `DOCS_REQUIRED`.
2. Click **Review & Decide**.
3. Choose **Approve & Quote** (optionally adding a risk score or premium loading), **Request Docs**, or **Decline**, and submit.

---

## 5. Claims Operations (`/claims`)

- **File a Claim**: Submit a claim against any active policy. Policyholders only see and file against their own policies; adjusters see the full queue.
- **Claim Detail (`/claims/[id]`)**: Inspect detected damages, reconcile invoice items, review actuarial payouts, check fraud alerts, submit supplements/disputes, or transition status.

---

## 6. Master Setup Center (`/master-setup`) & RBAC

Administrators (`superadmin` or users with `rbac:users_assign`, `rbac:roles_create`, or `products:manage`) can open **Master Setup** (`/master-setup`) from the sidebar:
- **Users Tab**: View all users by role. Click **Add New User** or **Add User w/ Same Role**, then use **Save & Add Another** to create multiple users under the same role quickly.
- **Roles & Rights Tab**: Create custom roles, see user counts per role, and click **Permissions** to customize module-by-module rights.
- **Policy Categories & Policy Products Tabs**: Create, edit, and remove/deactivate insurance categories and plans offered in the customer wizard.
- **Repair Garages & Parts Catalog Tabs**: Maintain approved network garages and vehicle part reference pricing.
