# OmniClaim User Guide

OmniClaim adapts automatically to your signed-in role and supports both **Light** (default) and **Dark** themes via the Moon/Sun toggle in the top navigation bar.

---

## 1. Signing In & Password Management

1. Open **`http://localhost:3000/login`**.
2. Enter your assigned username or email (for example `superadmin`, `sarah.jenkins`, or `alex.rivera`) and password (`AdminOmniClaim2026!` for seeded accounts, or `OmniClaim@123` for newly created role-based team accounts).
3. Direct role switching and one-click impersonation are disabled for security. To change accounts, click the **Sign Out** icon in the top-right bar and log in on `/login`.
4. **First-Login Password Update**: If an account was created with the common initial password (`OmniClaim@123`), the **Change Password** modal opens automatically right after login so you can set your personal password (minimum 8 characters). You can also open **Change Password** from the top bar at any time.
5. Every DataGrid table lets you choose **`5`**, **`10`**, **`25`**, **`50`**, or **`All`** rows per page, filter individual columns, sort, group rows, and export to **CSV** or **Excel**.

---

## 2. Sidebar Navigation Layout

The left navigation bar organizes screens cleanly by permissions:
- **Operations**:
  1. **Apply for Policy** (`/policies/apply`)
  2. **My Policies** (`/policies`)
  3. **Underwriting Review** (`/underwriting`)
  4. **Claims** (`All Claims`, `File a Claim`)
  5. **Fraud Review** (`Fraud Alerts`, `Duplicate Check`)
  6. **Payments & Ledger** (`Transactions`, `Chart of Accounts`)
- **Administration** (visible to authorized roles):
  1. **Master Setup** collapsible dropdown:
     - `Users` (`/master-setup?section=users`)
     - `Roles & Rights` (`/master-setup?section=roles`)
     - `Policy Categories` (`/master-setup?section=categories`)
     - `Vehicle Types` (`/master-setup?section=vehicleTypes`)
     - `Policy Products` (`/master-setup?section=products`)
     - `Repair Garages` (`/master-setup?section=garages`)
     - `Parts Catalog` (`/master-setup?section=parts`)
  2. **Team & Access** (`Roles & Permissions`, `Access Matrix`, `Users`)
  3. **Activity & Audit** (`Activity History`)

---

## 3. Applying for a New Insurance Policy (Customer Flow)

1. Go to **Apply for Policy** (`/policies/apply`).
2. **Step 1 — Category → Vehicle Type → Policy Product**:
   - Select an insurance category (`Auto`, `Health`, `Home`, `Life`, or `Travel`).
   - For vehicle categories such as `Auto`, select your **Vehicle Type** (`Car`, `Bike`, `Bus`, or any custom vehicle type configured in Master Setup).
   - Compare and choose among all eligible Policy Products under that Vehicle Type (with add-ons and exclusions displayed).
3. **Step 2 — Coverage & Risk**: Enter requested coverage, deductible, term length, contact details, and category-specific details (e.g., vehicle VIN/make/model/year for Auto). Click **Save Draft & Attach Documents**.
4. **Step 3 — Documents**: Attach supporting document metadata (such as `ID_PROOF`, `VEHICLE_RC`, or `PASSPORT_ID`) and click **Submit Application & Calculate Quote**.
5. **Step 4 — Quote Review**:
   - Applications within the product's instant-quote limit generate a live quote immediately.
   - Higher-coverage or underwriting-required applications enter **Underwriting Review** until approved by an underwriter.
6. **Step 5 — Complete Payment & Activate Policy**: Select a payment method (`CARD`, `ACH`, `UPI`, or `STRIPE`) and activate your policy instantly.

---

## 4. Managing Active Policies (`/policies`) & Underwriting (`/underwriting`)

- Open **My Policies** (`/policies`) to view **Issued Policies** and **Policy Applications**, perform **Endorse (+$10k)**, **Renew (+1 Yr)**, **Cancel Policy**, or pay pending quoted applications.
- Underwriters (`sarah.jenkins` or `superadmin`) open **Underwriting Review** (`/underwriting`) to **Approve & Quote**, **Request Docs**, or **Decline** submitted applications.

---

## 5. Claims Operations & Live Camera Capture (`/claims` & `/claims/[id]`)

- **File a Claim (`/claims`)**: Submit a claim against any active policy. Policyholders only see and file against their own policies; adjusters see the full queue.
- **Guided 7-Step Live Camera Capture (`/claims/[id]`)**:
  - Customers capture evidence directly using the live camera (browser gallery upload is omitted for standard claim submissions).
  - Follow each guided framing step: **Front View**, **Rear View**, **Left-Side View**, **Right-Side View**, **Damaged Area Close-Up**, **Vehicle Number Plate**, and **Additional Evidence**.
  - Preview every photo with brightness/blur feedback, click **Retake** if needed, or **Confirm & Upload** to save it with a server timestamp and SHA-256 checksum.
  - Authorized adjusters/staff (`claims:update`) can use the separate audited **Staff Exception Upload** panel when an exception reason is required.

---

## 6. Master Setup & Creating Team Members (`/master-setup`)

Open **Master Setup** from the **Administration** sidebar dropdown:
- **Users (`/master-setup?section=users`)**:
  - Click **Add New User** (or **Add User w/ Same Role** from any row).
  - Select the target Role and enter Full Name + Email; OmniClaim automatically suggests a guaranteed unique username (e.g., `claims_adj.john.doe`) and assigns the common initial password `OmniClaim@123`.
  - Click **Save & Add Another** to onboard multiple team members under the same role. Give each user their generated username and `OmniClaim@123`; they will update to a personal password on first sign-in.
- **Roles & Rights**, **Policy Categories**, **Vehicle Types**, **Policy Products**, **Repair Garages**, and **Parts Catalog**: Full DataGrid CRUD directly from each sidebar link under **Master Setup**.
