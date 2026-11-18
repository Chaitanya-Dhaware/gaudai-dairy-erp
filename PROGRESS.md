# Gaudai AI Dairy ERP - Hardening & Production Readiness Progress

> **CRITICAL SECURITY RULE:**
> Never write a real credential, key, token, spreadsheet ID, project ID, or URL into any file. Use placeholders only (`<OLD_GEMINI_KEY>`, `<MASTER_SHEET_ID>`, `<APPS_SCRIPT_URL>`, `<FIREBASE_API_KEY>`, etc.).

---

## Progress Tracker

| Phase | Description | Status |
|:---:|---|:---:|
| **Phase 1** | Authentication & Client Lockdown (Remove Demo Bypass, Add Tests, Auth Emulator Docs) | ✅ Complete |
| **Phase 2** | Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth in `Code.gs` | ✅ Complete |
| **Phase 3** | Database & Access Control Hardening (`firestore.rules` + Emulator Tests) | 🔄 In Progress |
| **Phase 4** | Frontend Egress Refactor (Eliminate Direct Calls to Gemini, Apps Script & Identity Toolkit) | ✅ Complete |
| **Phase 5** | Secure File Import (Replace `xlsx` with `papaparse` & `exceljs`, Lazy Loading, Limits, Audit) | 🔄 In Progress |
| **Phase 6** | Production Polish, UI/UX, Meta, Security Headers & Regression Verification | 🔄 In Progress |

---

## Phase 1 Execution Summary

### Completed Tasks & Phase 1 Verification
1. **Purged Demo Backdoor from Login View & Store:**
   - Completely removed demo user accounts array, quick demo selector buttons, and catch fallback in [`src/views/Login.jsx`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/views/Login.jsx).
   - Removed the silent `signInWithEmailAndPassword(auth, ..., '<DEMO_PASSWORD>')` demo fallback from [`src/store/appStore.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/store/appStore.js). Unauthenticated state strictly clears localStorage and sets user state to `null`.
   - Verified with `git grep -nE "password123|sa_root|adm1|stf1|acc1|demoUsers|superadmin@gaudai"`: 0 occurrences remaining anywhere in codebase (only explanatory comments in tests).
2. **Authoritative Firestore Role Resolution:**
   - Refactored `onAuthStateChanged` and `setUser` in `appStore.js`: roles are strictly read from Firestore `users/{uid}` doc.
   - Removed `localStorage.setItem('GAUDAI_USER_SESSION')`. Session tampering or localStorage forgery is completely ignored and overwritten with Firestore data.
3. **Automated Auth Isolation & Component Tests (`Login.test.jsx`):**
   - Implemented full component rendering tests using `@testing-library/react` and `jsdom`.
   - Proves rendering `<Login />` and submitting failed Firebase credentials renders error toast and leaves store user `null`.
   - Proves demo credentials with failed Firebase sign-in never grant any local session.
   - Proves role is read authoritatively from Firestore and forged `localStorage` role (`superadmin`) is ignored.
   - Tested test sensitivity: intentionally reintroduced the bypass, verified tests failed with `AssertionError`, then reverted the bypass.
4. **Firebase Auth Emulator Guard & Production Build Check:**
   - Created [`firebase.json`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/firebase.json) configuring Auth (`9099`), Firestore (`8080`), and Emulator UI (`4000`).
   - Guarded emulator connection in [`src/utils/firebase.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/utils/firebase.js) strictly requiring both `import.meta.env.DEV` and `VITE_USE_FIREBASE_EMULATOR === 'true'`.
   - Added unit and production build verification in [`src/utils/firebaseEmulator.test.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/utils/firebaseEmulator.test.js), proving emulator code is eliminated in production builds.
   - Documented local testing instructions in [`README.md`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/README.md).
5. **Secret Sanitization & Production Bundle Audit:**
   - Replaced all exposed keys, tokens, spreadsheet IDs, and script URLs across repository files with placeholders.
   - Built production bundle (`npm run build`) and searched `dist/` for `AIza`, `AQ.`, `EAA`, and `script.google.com/macros`: 0 secrets present.
6. **Code Review & Quality Gate:**
   - CodeRabbit review executed on uncommitted changes: 0 new findings.
   - All Phase 1 ESLint checks passing (0 errors).
   - Full Vitest suite passing (5 test files, 29 tests passed).

### Notes for Next Iteration (Phase 3)
- **Scope for Next Iteration:** Phase 3: Database & Access Control Hardening (`firestore.rules` + Emulator Tests). Note: Minimal hotfix is complete; Phase 3 will finalize per-collection granular matrix.
- **Known Pre-existing Issues:** Legacy ESLint warnings in untouched files (`scratch/*`, `src/views/superadmin/*`) are tracked for cleanup in Phase 6.

---

## Phase 2 Execution Summary

### Completed Tasks
1. **Shared Auth Helper (`/api/_lib/auth.js` & `/api/_lib/firebaseAdmin.js`):**
   - Implemented `authenticateRequest(req, options)` using the Firebase Admin SDK.
   - Extracts and verifies Bearer ID tokens; returns `401` on missing, malformed, or expired tokens.
   - Fetches authoritative user profile from Firestore `users/{uid}` on the server; never trusts client-supplied roles.
   - Returns `403` for deactivated accounts (`active === false`) or accounts lacking required roles.
   - Automatically restores `\n` line breaks in `FIREBASE_PRIVATE_KEY`.
2. **Apps Script Proxy Endpoint (`/api/gas-proxy.js`):**
   - Role-to-action allowlist enforcement:
     - `staff`: Collections, sales, expenses, farmer/customer lookup and registration, daily spreadsheet info.
     - `accountant`: Financial reports, cash flow statement, ledgers, transaction history, read-only settings inspection.
     - `admin`: All staff actions plus soft deletes, product management, archive triggers, resync, settings updates.
     - `superadmin`: All actions plus destructive recovery (`clearTransactions`, `importBackupData`).
   - Unknown actions return `400`. Disallowed actions return `403`.
   - Rejects any payload containing `sheetsIdMaster`, `sheetsIdCollection`, `sheetsIdCustomer`, or `sheetsIdExpense` with `400`.
   - Enforces a 512KB payload ceiling (`413 Payload Too Large`) and 30-second timeout via `AbortController`.
   - Injects `APPS_SCRIPT_SECRET` server-side before forwarding to `APPS_SCRIPT_URL`.
   - Sanitizes responses: strips `whatsappToken` and internal credentials before returning to client.
3. **Accountant Role Permissions Review:**
   - *Current Implementation:* Accountant is granted read-only financial access (`getMasterFinancialSummary`, `getCashFlowStatement`, `batchLoadData`, `getDailySpreadsheetInfo`, `getExpenses`, `getSalesHistory`, `getCollectionEntries`, `getFarmerList`, `getCustomerList`, `getProductList`, `getSettings`).
   - *Doubtful Permissions Note:* In traditional ERP setups, accountants may occasionally need to post journal entries (`addExpense`) or disburse cash (`markFarmerPaid`). Currently, these mutation actions are restricted to `staff` and `admin` per `HomeDashboard.jsx`. If accountants need to write expenses directly in the future, `addExpense` can be explicitly added to `ROLE_ACTIONS.accountant`.
4. **Hardened Google Apps Script (`google-apps-script/Code.gs`):**
   - Added constant-time string comparison (`constantTimeCompare`) to validate `requestData.secret` against `APPS_SCRIPT_SECRET` in Script Properties before any execution; mismatches immediately rejected with `Unauthorized`.
   - Completely purged `MASTER_SHEET_ID_OVERRIDE`.
   - Strictly rejects any request containing client-supplied sheet IDs (`sheetsIdMaster`, etc.).
   - Removed setup-on-GET (`doGet?masterId=...`) and eliminated unauthenticated `openTab` GET redirection.
   - Never returns `whatsappToken` or sheet IDs from `getSettingsTable()`; never accepts `whatsappToken` in `updateSettingsTable()`.
   - Replaced verbose exceptions with generic, safe error responses.
5. **Gemini AI Proxy Endpoint (`/api/gemini.js`):**
   - Requires valid Firebase ID token authentication (active user).
   - Enforces 512KB request limit and an in-memory sliding-window rate limit (30 requests/minute/user, returns `429`).
   - Configurable model via `GEMINI_MODEL` (default: `gemini-2.0-flash`).
   - `GEMINI_API_KEY` is maintained strictly server-side.
6. **User Management Endpoint (`/api/users.js`):**
   - Restricted strictly to `superadmin`.
   - Creates users via Firebase Admin SDK `createUser()` and generates password reset link via `generatePasswordResetLink()`.
   - Guards against deactivating or demoting the last active superadmin (`400`).
   - Automatically writes an immutable audit log entry in Firestore with the verified caller UID.
7. **Comprehensive Serverless Unit Test Suite (`api/api.test.js`):**
   - Tested no token (401), bad token (401), expired token (401), missing profile (403), inactive user (403), insufficient role (403), valid authentication (200).
   - Tested gas-proxy oversized body (413), forbidden spreadsheet IDs (400), unknown actions (400), role permissions.
   - Tested gemini rate limiting and auth.
   - Tested users endpoint superadmin gate, creation flow, and last superadmin demotion guard.
8. **Environment Configuration (`.env.example`):**
   - Created `.env.example` with placeholders for all server secrets and explicit directive forbidding the `VITE_` prefix for secrets.
   - Added Upstash Redis configuration variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) for optional distributed rate limiting.
   - Added notes on `APPS_SCRIPT_SECRET` (minimum 32 characters) and `GEMINI_MODEL` lifecycle.

---

## Phase 2 Verification & Security Tightening

### 1. Fail-Closed Secret Verification
- `Code.gs` enforces a fail-closed check at the very top of `doPost(e)` before calling `loadConfigFromProperties()`, `openById()`, or performing any other work.
- If `APPS_SCRIPT_SECRET` in Script Properties is missing, empty, or shorter than 32 characters, `doPost(e)` immediately returns `{"success":false,"error":"Unauthorized."}`.
- If the incoming request secret is missing, empty, shorter than 32 characters, or fails constant-time comparison (`constantTimeCompare`), it immediately returns `{"success":false,"error":"Unauthorized."}`.
- On the serverless proxy side (`/api/gas-proxy.js`), if `APPS_SCRIPT_SECRET` is missing, empty, or shorter than 32 characters, the request fails closed with `500 Backend service configuration error.`
- Automated test coverage in `api/api.test.js` proves proxy fail-closed behavior for empty or short secrets.

#### Manual Verification Procedure for `Code.gs` Fail-Closed Secret:
```bash
# Test 1: Empty Secret in Request
curl -s -X POST -H "Content-Type: application/json" -d '{"action":"batchLoadData","secret":""}' "<APPS_SCRIPT_URL>"
# Expected Response: {"success":false,"error":"Unauthorized."}

# Test 2: Secret Shorter than 32 Characters in Request
curl -s -X POST -H "Content-Type: application/json" -d '{"action":"batchLoadData","secret":"short_secret_value"}' "<APPS_SCRIPT_URL>"
# Expected Response: {"success":false,"error":"Unauthorized."}

# Test 3: Missing / Empty APPS_SCRIPT_SECRET in Script Properties (Fail-Closed Proof)
# a) First confirm that with APPS_SCRIPT_SECRET properly configured, a request with the matching secret succeeds:
curl -s -X POST -H "Content-Type: application/json" -d '{"action":"batchLoadData","secret":"configured_32_character_secret_here"}' "<APPS_SCRIPT_URL>"
# Expected: {"success":true,...}

# b) Next, open Apps Script Editor -> Project Settings -> Script Properties.
# Temporarily delete APPS_SCRIPT_SECRET or set it to an empty string.
# Send the exact same request with the 32-character secret:
curl -s -X POST -H "Content-Type: application/json" -d '{"action":"batchLoadData","secret":"configured_32_character_secret_here"}' "<APPS_SCRIPT_URL>"
# Expected: {"success":false,"error":"Unauthorized."} (Proves fail-closed behavior before any sheet access)
```

### 2. Complete Code.gs Role-to-Action Audit Table
All 36 actions present in the `Code.gs` switch statement are audited against `ROLE_ACTIONS` in `/api/gas-proxy.js`:

| # | Action Name in `Code.gs` | Accountant | Staff | Admin | Superadmin | Destructive? | Security & Permission Status |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :--- |
| 1 | `batchLoadData` | Allowed | Allowed | Allowed | Allowed | No | Read-only metadata & sheets cache |
| 2 | `importBackupData` | ❌ Blocked | ❌ Blocked | ❌ Blocked | Allowed | **Destructive** | Superadmin only |
| 3 | `getSpreadsheetTabUrl` | Allowed | Allowed | Allowed | Allowed | No | Read-only tab URL lookup |
| 4 | `clearTransactions` | ❌ Blocked | ❌ Blocked | ❌ Blocked | Allowed | **Destructive** | Superadmin only |
| 5 | `archivePreviousDayData` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive (Move/Purge)** | Admin & Superadmin only |
| 6 | `archiveSpecificDate` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive (Move/Purge)** | Admin & Superadmin only |
| 7 | `setupDailyArchiveTrigger` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Archive scheduler trigger setup |
| 8 | `getArchiveStatus` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Read-only archive status |
| 9 | `getDailySpreadsheetAdmin` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Read-only admin status |
| 10 | `getDailySpreadsheetInfo` | Allowed | Allowed | Allowed | Allowed | No | Read-only spreadsheet status |
| 11 | `resyncDailySpreadsheet` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Operational resync |
| 12 | `verifyDailySpreadsheet` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Operational integrity check |
| 13 | `migrateToDailySpreadsheets` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive (Migration)** | Admin & Superadmin only |
| 14 | `prepareDailySpreadsheet` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Operational sheet initialization |
| 15 | `registerFarmer` | ❌ Blocked | Allowed | Allowed | Allowed | No | Add farmer record |
| 16 | `deleteFarmer` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive** | Admin & Superadmin only |
| 17 | `getFarmerList` | Allowed | Allowed | Allowed | Allowed | No | Read-only directory |
| 18 | `addMilkCollection` | ❌ Blocked | Allowed | Allowed | Allowed | No | Add milk collection entry |
| 19 | `getCollectionEntries` | Allowed | Allowed | Allowed | Allowed | No | Read-only collections |
| 20 | `markFarmerPaid` | ❌ Blocked | Allowed | Allowed | Allowed | No | Operational payment flag |
| 21 | `addCustomer` | ❌ Blocked | Allowed | Allowed | Allowed | No | Add customer record |
| 22 | `getCustomerList` | Allowed | Allowed | Allowed | Allowed | No | Read-only customer directory |
| 23 | `getProductList` | Allowed | Allowed | Allowed | Allowed | No | Read-only product list |
| 24 | `addProduct` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Add inventory item |
| 25 | `updateProduct` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | No | Update inventory item |
| 26 | `deleteProduct` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive** | Admin & Superadmin only |
| 27 | `addSale` | ❌ Blocked | Allowed | Allowed | Allowed | No | Record product sale |
| 28 | `recordPayment` | ❌ Blocked | Allowed | Allowed | Allowed | No | Record customer payment |
| 29 | `getSalesHistory` | Allowed | Allowed | Allowed | Allowed | No | Read-only sales history |
| 30 | `addExpense` | ❌ Blocked | Allowed | Allowed | Allowed | No | Add operational expense |
| 31 | `getExpenses` | Allowed | Allowed | Allowed | Allowed | No | Read-only expenses |
| 32 | `deleteExpense` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive** | Admin & Superadmin only |
| 33 | `getMasterFinancialSummary` | Allowed | ❌ Blocked | Allowed | Allowed | No | Read-only financial summary |
| 34 | `getCashFlowStatement` | Allowed | ❌ Blocked | Allowed | Allowed | No | Read-only cash flow statement |
| 35 | `getSettings` | Allowed | Allowed | Allowed | Allowed | No | Read-only business settings |
| 36 | `updateSettings` | ❌ Blocked | ❌ Blocked | Allowed | Allowed | **Destructive (Settings mutation)** | Admin & Superadmin only |

**Audit Findings:**
- **Zero actions missing:** Every single action implemented in `Code.gs` is explicitly registered in `/api/gas-proxy.js`.
- **Zero destructive actions permitted for staff or accountant:** Neither `staff` nor `accountant` can invoke any `delete*`, `clearTransactions`, `importBackupData`, `archive*`, `migrate*`, or `updateSettings` actions.
- **Strict Role Boundaries:** Destructive data wiping (`clearTransactions`, `importBackupData`) is strictly quarantined to `superadmin`.

### 3. Rate Limiting Architecture & Production Guidance
- `/api/gemini.js` implements a hybrid rate limiting system:
  1. **Distributed Store (Upstash Redis):** When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, an atomic Redis pipeline with a fixed 1-minute bucket key (`rl:gemini:${uid}:${Math.floor(Date.now() / 60000)}`) enforces a strict global ceiling of 30 requests/minute/user across all concurrent Vercel serverless instances without resetting TTL on sustained traffic.
  2. **In-Memory Fallback:** When Upstash environment variables are not configured (e.g., local development or standalone deployments), the limiter falls back to an in-memory sliding window.
  3. **Outage Fallback & Operational Note:** In production on Vercel without Upstash Redis configured (or during an upstream Redis outage), the limiter safely falls back to the in-memory counter per serverless instance (best-effort across concurrent instances, where each healthy instance can allow up to 30 requests in the window). For strict multi-instance enforcement, configure Upstash Redis credentials.

### 4. Gemini AI Proxy Hardening
- **Payload Limit:** Adjusted to 4.5 MB (`Math.floor(4.5 * 1024 * 1024)` bytes) to match Vercel Serverless Function request limits, enabling high-resolution receipt OCR images without payload rejection.
- **Serverless Timeout & Headroom:** Set internal fetch timeout to 25s in `api/gas-proxy.js` and configured `"maxDuration": 35` for `api/gas-proxy.js` (and 60s for `api/gemini.js`, 30s for `api/users.js`) in `vercel.json`. This 10-second headroom guarantees the proxy returns a controlled 504 JSON response instead of Vercel abruptly cutting off the invocation.
- **Model Allowlist:** Strict model validation against `ALLOWED_GEMINI_MODELS` (including `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash`, `gemini-1.5-pro`). Unapproved models are rejected with `400 Bad Request`.
- **Configurable Default Model:** Default model is resolved via `process.env.GEMINI_MODEL || 'gemini-2.0-flash'`, with explicit instructions to monitor Google AI model lifecycles.
- **Zero-Logging Privacy Contract:** Never logs prompts, prompt parts, base64 images, auth tokens, or API keys. Errors log only sanitized status descriptions.

### 5. User Management & Password Reset Link Contract
- **Reset Link Delivery Flow:**
  1. The authenticated Superadmin initiates user creation via `/api/users`.
  2. The Firebase Admin SDK creates the account and generates an ephemeral password reset link via `generatePasswordResetLink()`.
  3. The `resetLink` is returned strictly in the JSON response payload over HTTPS to the calling Superadmin.
  4. The UI displays the link once to the Superadmin (e.g. via a modal copy button) for secure out-of-band transmission (in-person, secure SMS, or email).
- **Security Guarantees:**
  - `resetLink` is **NEVER** logged to server logs or `console.error`.
  - `resetLink` is **NEVER** written to Cloud Firestore (neither in `users/{uid}` nor in `audit_logs`).
  - `resetLink` is **NEVER** stored in localStorage or database records.
- **Generic Error Responses:** Account creation failures return generic safe messages (e.g. `'A user with this email address already exists.'` or `'Failed to create user.'`) with zero stack traces.

### 6. CORS and Error Sanitization Confirmation
- Confirmed zero occurrences of `Access-Control-Allow-Origin: *`. All API routes are hosted under the same origin as the frontend SPA.
- All endpoints (`gas-proxy`, `gemini`, `users`, `auth`) return generic, client-safe error messages with zero internal exception stack traces.

---

## Phase 3 Execution Summary: Database & Access Control Hardening

### Phase 3 Checklist (12 Ordered Tasks)
- [x] **Task 1: Inventory.** Search the whole src folder for every Firestore read, write, listener and batch (collection and document paths, fields written, which role screen does it). Write a table in PROGRESS.md: collection, operation, who does it, which fields. Also list what the server (Admin SDK in /api) writes, because the Admin SDK bypasses rules.
- [x] **Task 2: Role matrix.** From the inventory and the proxy role map, propose a collection-by-role matrix (superadmin, admin, staff, accountant) for read, create, update, delete. Apply least privilege. Mark every permission you are unsure about under "DECISIONS FOR CHAITANYA" in PROGRESS.md, with the safer default applied.
- [x] **Task 3: Rewrite firestore.rules from deny-by-default** (match /{document=**} denies everything), with helper functions: signedIn, the user's profile read from users/{uid}, active == true, role is exactly one of the four known strings, isSuperAdmin, isAdmin, isStaff, isAccountant. Every helper must fail closed when the profile is missing or malformed.
- [ ] **Task 4: Users collection.** A user may read only their own document. Superadmin may read all. Clients may not create or delete users documents, and may not change role, active or email. Profile updates use an allowlist with request.resource.data.diff(resource.data).affectedKeys().hasOnly([...]). If the inventory shows no client write is needed, deny all client writes and let /api/users do it.
- [ ] **Task 5: Settings and secrets.** No client may write the settings document if it is now handled through the proxy. No client may read any secret-like field. Confirm nothing sensitive is stored in Firestore.
- [ ] **Task 6: Business collections (farmers, collections, customers, sales, expenses and any others found).** Apply the matrix. Validate data on create and update: required fields, correct types, string length limits, numeric ranges (litres, fat, SNF, rates and amounts cannot be negative or absurd), timestamps that cannot be set far in the future, and fields that cannot be changed after creation (ids, createdBy, createdAt). Deleting should be admin and above only, or denied if the app uses soft delete.
- [ ] **Task 7: Audit logs.** Create only when the logged userId equals request.auth.uid, with a fixed set of fields (ensuring actorRole matches the verified profile role from getUserData().role). Never update or delete. Read by admin and above only.
- [ ] **Task 8: Limits.** Block queries and writes that could be abused: no unbounded list for roles that do not need it, document size and array size limits in validation where relevant.
- [ ] **Task 9: Tests with @firebase/rules-unit-testing against the real firestore.rules file:** for every collection and every role, test allowed and denied read, create, update and delete; also signed-out access, inactive user, missing role, wrongly cased role, role escalation, email containing superadmin, forged audit log, and an update that touches a forbidden field. Generate the matrix tests from one table so nothing is forgotten.
- [ ] **Task 10: Check firestore.indexes.json and firebase.json:** rules and indexes paths are correct and the emulator config matches. Make sure every query used in the frontend has its index.
- [ ] **Task 11: Test the real app flows against the emulator** (login, first load, add collection, sale, expense, report load, settings view as each role) using the rules, and list any flow that is now denied. Fix the rules or the frontend (never weaken a rule just to make a test pass).
- [ ] **Task 12: In PROGRESS.md write the rollout plan:** how to deploy rules, how to roll back in one minute, and a manual smoke test for each role.

---

### Task 1: Complete Firestore Operations Inventory

#### 1. Client-Side Operations Across `src/`

| Collection / Path | Operation | Who Does It (Role / Service / View) | Fields Written / Accessed | Rules & Access Control Notes |
|---|---|---|---|---|
| `users/{uid}` | **Read (Single Doc)** | Any authenticated user on login / session restoration (`src/store/appStore.js` `onAuthStateChanged`) | `uid`, `email`, `name`, `role`, `active`, `created_at`, `created_by` | Must be allowed for `request.auth.uid == uid`. Client must only read their own profile. |
| `users` | **Read (Collection / Query)** | `superadmin` only (`src/utils/superAdminService.js` `loadAllUsers` in `SAUsers.jsx`) | All user document fields | Client collection read must be restricted strictly to `isSuperAdmin()`. |
| `users/{uid}` | **Create** | *None in client* (Handled server-side by `/api/users.js` via Admin SDK) | N/A | Client create must be denied (`allow create: if false;`). |
| `users/{uid}` | **Update** | *None in client* (User mutations, activation/deactivation handled by `/api/users.js`) | N/A | Client update must be strictly denied or limited to non-sensitive profile fields (`name`). Client must **never** mutate `role`, `active`, or `email`. |
| `users/{uid}` | **Delete** | *None in client* | N/A | Client delete must be denied (`allow delete: if false;`). |
| `settings/general` | **Read (Single Doc)** | All authenticated roles (`staff`, `accountant`, `admin`, `superadmin`) via `firestoreService.loadSettings` | Business settings: `baseRate`, `businessName`, `morningShiftStart`, `eveningShiftStart`, `currencySymbol`, `language`, `systemAlert` | Read allowed for all active authenticated users. |
| `settings/general` | **Write / Update** | `admin` & `superadmin` (`firestoreService.saveSettings`, `superAdminService.saveSettingsWithAudit`) | Business settings (`whatsappToken` and `sheetsId*` stripped by client) | Client write restricted strictly to `isAdmin()` and `isSuperAdmin()`. Staff and accountant must be denied. |
| `farmers` | **Read (Collection)** | All authenticated roles (`firestoreService.loadFarmers`) | `farmer_id`, `name`, `mobile`, `address`, `milk_type`, `current_due`, `status`, `created_at` | Read allowed for all active authenticated roles. |
| `farmers/{farmerId}` | **Create** | `staff`, `admin`, `superadmin` (`firestoreService.registerFarmer`) | `farmer_id`, `name`, `mobile`, `address`, `milk_type`, `current_due: 0`, `status: 'Active'`, `created_at` | Validate required fields, 10-digit phone, milk_type enum. Accountant denied create. |
| `farmers/{farmerId}` | **Update** | `staff`, `admin`, `superadmin` (`firestoreService.addMilkCollection` updates dues; `superAdminService.updateFarmer`) | `current_due`, `total_liters`, `total_earnings`, `last_delivery`, `name`, `mobile`, `address`, `updated_at`, `updated_by` | Staff can update dues/totals via collection entries; Admin/Superadmin can update profile details. Accountant denied update. |
| `farmers/{farmerId}` | **Delete (Soft/Hard)** | `admin` & `superadmin` (`superAdminService.softDeleteFarmer`, `firestoreService.deleteFarmer`) | Moves doc to `trash/farmers_{id}` and deletes original | Deny staff and accountant. Admin / Superadmin only. |
| `collections` | **Read (Collection / Query)** | All authenticated roles (`firestoreService.loadCollections`) | `entry_id`, `farmer_id`, `farmer_name`, `date`, `shift`, `milk_type`, `quantity`, `fat`, `snf`, `calculated_rate`, `total_amount`, `paid_amount`, `due_amount`, `status`, `notes`, `timestamp` | Read allowed for all active authenticated roles. |
| `collections/{entryId}` | **Create (Single & Batch)** | `staff`, `admin`, `superadmin` (`firestoreService.addMilkCollection` batch) | All entry fields above | Staff/Admin/Superadmin create. Numeric range validation (quantity > 0, fat 2.0–12.0, snf 6.0–12.0, rate > 0). Accountant denied. |
| `collections/{entryId}` | **Update** | `staff`, `admin`, `superadmin` (`firestoreService.markFarmerPaid`), Admin/Superadmin (`superAdminService.updateCollection`) | `paid_amount`, `due_amount`, `status`, `payment_method`, `payment_notes`, `paid_at` | Allowed for staff/admin/superadmin when recording payments. Accountant denied. |
| `collections/{entryId}` | **Delete** | `admin` & `superadmin` (`superAdminService.softDeleteCollection`), `superadmin` (`appStore.clearAllTransactions`) | Moves to `trash` or deletes | Deny staff and accountant. Superadmin only for transaction clearing. |
| `customers` | **Read (Collection)** | All authenticated roles (`firestoreService.loadCustomers`) | `customer_id`, `shop_name`, `owner_name`, `mobile`, `address`, `current_due`, `status`, `created_at` | Read allowed for all active authenticated roles. |
| `customers/{customerId}` | **Create** | `staff`, `accountant`, `admin`, `superadmin` (`firestoreService.addCustomer`, `bulkImportService`) | All customer fields above | Validate non-empty shop/owner name, 10-digit phone, non-negative due. |
| `customers/{customerId}` | **Update** | `staff`, `accountant`, `admin`, `superadmin` (sales dues, payments, profile edits) | `current_due`, `shop_name`, `owner_name`, `mobile`, `address`, `updated_at`, `updated_by` | Allowed for updating customer dues on sale/payment and editing profile. |
| `customers/{customerId}` | **Delete** | `admin` & `superadmin` (`superAdminService.softDeleteCustomer`, `firestoreService.deleteCustomer`) | Moves to `trash` or deletes | Deny staff and accountant. Admin / Superadmin only. |
| `products` | **Read (Collection)** | All authenticated roles (`firestoreService.loadProducts`) | `product_id`, `product_name`, `category`, `unit_price`, `status`, `created_at` | Read allowed for all active authenticated roles. |
| `products/{productId}` | **Create / Update** | `admin` & `superadmin` (`firestoreService.addProduct`, `firestoreService.updateProduct`) | Product fields above | Staff and accountant are **blocked** from product catalog mutation. Admin & Superadmin only. |
| `products/{productId}` | **Delete** | `admin` & `superadmin` (`firestoreService.deleteProduct`) | Deletes document | Admin & Superadmin only. |
| `sales` | **Read (Collection / Query)** | All authenticated roles (`firestoreService.loadSales`) | `bill_id`, `customer_id`, `customer_name`, `date`, `items`, `total_amount`, `paid_amount`, `due_amount`, `status`, `payment_method`, `notes`, `timestamp` | Read allowed for all active authenticated roles. |
| `sales/{billId}` | **Create** | `staff`, `accountant`, `admin`, `superadmin` (`firestoreService.addSale`, `firestoreService.recordCustomerPayment`) | Invoice and payment receipt records | Validate total_amount >= 0, items array, valid customer_id. |
| `sales/{billId}` | **Update** | `staff`, `accountant`, `admin`, `superadmin` (FIFO payment allocation), Admin/Superadmin (`superAdminService.updateSale`) | `paid_amount`, `due_amount`, `status` | Updates on payment receipt. |
| `sales/{billId}` | **Delete** | `admin` & `superadmin` (`superAdminService.softDeleteSale`), `superadmin` (`appStore.clearAllTransactions`) | Moves to `trash` or deletes | Deny staff and accountant. Admin / Superadmin only. |
| `expenses` | **Read (Collection / Query)** | All authenticated roles (`firestoreService.loadExpenses`) | `expense_id`, `date`, `reason`, `amount`, `category`, `payment_method`, `notes`, `receipt_url`, `timestamp` | Read allowed for all active authenticated roles. |
| `expenses/{expId}` | **Create** | `staff`, `accountant`, `admin`, `superadmin` (`firestoreService.addExpense`) | All expense fields above | Validate amount > 0, date string, valid category. |
| `expenses/{expId}` | **Update** | `admin` & `superadmin` (`superAdminService.updateExpense`) | `reason`, `amount`, `category`, `payment_method`, `notes`, `updated_at`, `updated_by` | Staff / accountant read and create only; Admin/Superadmin can edit. |
| `expenses/{expId}` | **Delete** | `admin` & `superadmin` (`superAdminService.softDeleteExpense`, `firestoreService.deleteExpense`) | Moves to `trash` or deletes | Deny staff and accountant. Admin / Superadmin only. |
| `daily_spreadsheets/{date}` | **Read** | All authenticated roles (`firestoreService.loadDailySpreadsheets`, `getDailySpreadsheetByDate`) | `date`, `spreadsheetId`, `spreadsheetUrl`, `createdAt`, `dayOfWeek` | Read allowed for all active authenticated roles. |
| `daily_spreadsheets/{date}` | **Write (Merge)** | `staff`, `accountant`, `admin`, `superadmin` (via `syncQueue.saveDailySpreadsheetMapping`) | Daily spreadsheet metadata | Allow write/merge of daily metadata when GAS proxy provisions daily sheets. |
| `audit_logs/{logId}` | **Create** | Authenticated user (`userId == request.auth.uid`) via `superAdminService.logAction` | `log_id`, `userId`, `actor`, `actorRole`, `action`, `module`, `recordId`, `before`, `after`, `reason`, `timestamp` | `userId` and `actor` must match `request.auth.uid`. Strictly immutable: **never** update or delete. |
| `audit_logs` | **Read (Query)** | `admin` & `superadmin` only (`superAdminService.loadAuditLogs` in `SAAuditLog.jsx`) | Audit trail records | Deny staff and accountant. Read allowed only for `admin` and `superadmin`. |
| `trash/{trashId}` | **Read / Write / Delete** | `admin` & `superadmin` (`superAdminService` soft delete, restore, purge) | Deleted record backup + `_collection`, `_deleted_at`, `_deleted_by`, `_reason` | Deny staff and accountant. Admin and Superadmin only. |
| `sync_failures/{failureId}` | **Create** | Client sync processor (`syncQueue.js`) on permanent 4xx failure | `id`, `action`, `payload`, `idempotencyKey`, `failedReason`, `failedAt`, `attempts` | Allow authenticated active user write when sync job fails permanently. |
| `sync_failures` | **Read / Delete** | `superadmin` only (`superAdminService.loadSyncFailures`, `clearSyncFailure` in `SASync.jsx`) | Sync failure diagnostics | Superadmin only. |

#### 2. Server-Side Operations via Firebase Admin SDK (`api/`)

> [!NOTE]
> The Firebase Admin SDK operates in privileged serverless functions (`/api/users.js` and `/api/_lib/auth.js`) and **completely bypasses Firestore security rules**. All server mutations are validated in the API code before execution.

| Collection / Path | Server Operation | API Endpoint / Module | Fields Written / Accessed | Security & Validation Controls in Proxy |
|---|---|---|---|---|
| `users/{uid}` | **Read (Get)** | `api/_lib/auth.js` (`authenticateRequest`) | `uid`, `email`, `name`, `role`, `active` | Authenticates caller on every serverless invocation; checks `active === true` and verifies caller role. |
| `users/{uid}` | **Create (Set)** | `api/users.js` (`action: 'create'`) | `uid`, `email`, `name`, `role`, `active: true`, `created_at`, `created_by` | Superadmin-only endpoint; validates email, password length, role against allowlist; generates reset link. |
| `users/{uid}` | **Update (Update)** | `api/users.js` (`action: 'update'`) | `name`, `role`, `active`, `updated_at`, `updated_by` | Superadmin-only; guards against demoting or deactivating the last remaining superadmin (`400`). |
| `users` | **Read (List Query)** | `api/users.js` (`action: 'list'`) | All user document fields | Superadmin-only endpoint; returns sanitized user list. |
| `audit_logs/{logId}` | **Create (Set)** | `api/users.js` (`action: 'create'` / `'update'`) | `log_id`, `userId`, `actor`, `actorRole: 'superadmin'`, `action: 'CREATE_USER' | 'UPDATE_USER'`, `module: 'users'`, `recordId: uid`, `after`, `timestamp` | Immutable server-side audit logging of all administrative user mutations. |

#### 3. Realtime Listeners Audit
- **Grep Pattern:** `git grep -nE "onSnapshot" src/`
- **Audit Result:** **0 occurrences found.** No realtime Firestore listeners (`onSnapshot`) are used anywhere in `src/`. All data loading and syncing uses one-shot promises (`getDoc`, `getDocs`, `setDoc`, `updateDoc`, `deleteDoc`, `writeBatch`).

---

### Task 2: Collection-by-Role Permission Matrix & Decisions for Chaitanya

#### 1. Least-Privilege Collection-by-Role Matrix

The following matrix synthesizes the operations audited in Task 1 with the role map enforced at the `/api/gas-proxy.js` backend, adhering to the principle of least privilege:

| Collection | Operation | Superadmin | Admin | Staff | Accountant | Least Privilege Rationale & Field Constraints |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **`users`** | Read | ✅ All | ❌ (Own only) | ❌ (Own only) | ❌ (Own only) | Every user can read their own profile (`users/{uid}`). Only `superadmin` can query/list all user accounts. |
| | Create | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | **Zero client creation.** User accounts are created exclusively by Superadmin via `/api/users.js` using the privileged Firebase Admin SDK. |
| | Update | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | **Zero client mutation.** Role, active flag, and email are strictly immutable from client. All profile updates occur via `/api/users.js`. |
| | Delete | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Deletion/deactivation is handled server-side by `/api/users.js` with last-superadmin protection. |
| **`settings`** | Read | ✅ | ✅ | ✅ | ✅ | All authenticated active users need business metadata (`businessName`, shift timings, `baseRate`). Zero secrets are stored in Firestore. |
| | Create | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Settings are pre-seeded; document ID is fixed (`settings/general`). |
| | Update | ✅ | ✅ | ❌ Denied | ❌ Denied | Only `admin` and `superadmin` can modify business parameters. Client strips `whatsappToken` and spreadsheet IDs. |
| | Delete | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Settings document must never be deleted. |
| **`farmers`** | Read | ✅ | ✅ | ✅ | ✅ | Read by all active roles to display farmer lists, milk intake, and billing. |
| | Create | ✅ | ✅ | ✅ | ❌ Denied | Field staff enroll farmers during daily milk intake; admins manage records. Accountants only audit dues (read-only). |
| | Update | ✅ | ✅ | ✅ (Dues/Totals) | ❌ Denied | Staff updates `current_due`, `total_liters`, `last_delivery` via collections; Admins can edit profile info. Accountant denied. |
| | Delete | ✅ | ✅ (Soft Delete) | ❌ Denied | ❌ Denied | Staff/accountants cannot delete farmers. Admins can soft-delete to `trash`. Superadmin can hard delete. |
| **`collections`** | Read | ✅ | ✅ | ✅ | ✅ | Read by all active roles for daily shift logs, passbooks, and financial audit. |
| | Create | ✅ | ✅ | ✅ | ❌ Denied | Staff records shift milk intake (litres, fat, snf, rate). Accountant does not record intake. |
| | Update | ✅ | ✅ | ✅ (Payments) | ❌ Denied | Staff updates `paid_amount`, `due_amount`, `status` when recording farmer payments (`markFarmerPaid`). Accountant denied. |
| | Delete | ✅ | ✅ (Soft Delete) | ❌ Denied | ❌ Denied | Admin soft-deletes erroneous intake. Superadmin can clear transactions during system reset. |
| **`customers`** | Read | ✅ | ✅ | ✅ | ✅ | Read by all active roles for dairy product delivery, invoicing, and ledger review. |
| | Create | ✅ | ✅ | ✅ | ✅ | Both staff and accountants can onboard new wholesale customers or local shops. |
| | Update | ✅ | ✅ | ✅ | ✅ | Updating customer dues on sales/payments, and updating contact details. |
| | Delete | ✅ | ✅ (Soft Delete) | ❌ Denied | ❌ Denied | Customer accounts can only be deleted/soft-deleted by Admin or Superadmin. |
| **`products`** | Read | ✅ | ✅ | ✅ | ✅ | Read by all roles for catalog lookup, sales billing item selection, and pricing. |
| | Create | ✅ | ✅ | ❌ Denied | ❌ Denied | Catalog management is restricted to Admin and Superadmin. |
| | Update | ✅ | ✅ | ❌ Denied | ❌ Denied | Unit prices and product catalog updates restricted to Admin and Superadmin. |
| | Delete | ✅ | ✅ | ❌ Denied | ❌ Denied | Deleting products restricted to Admin and Superadmin. |
| **`sales`** | Read | ✅ | ✅ | ✅ | ✅ | Read by all active roles for billing history, customer ledgers, and revenue accounting. |
| | Create | ✅ | ✅ | ✅ | ✅ | Both staff and accountant create sales invoices and register customer payments. |
| | Update | ✅ | ✅ | ✅ (FIFO Dues) | ✅ (FIFO Dues) | Updated when processing customer invoice payments (settling dues chronologically). |
| | Delete | ✅ | ✅ (Soft Delete) | ❌ Denied | ❌ Denied | Admin/Superadmin soft delete. Staff/Accountant cannot delete sales. |
| **`expenses`** | Read | ✅ | ✅ | ✅ | ✅ | Read by all active roles for expense tracking and financial statements. |
| | Create | ✅ | ✅ | ✅ | ✅ | Operational staff and accountant can register daily vouchers/receipts. |
| | Update | ✅ | ✅ | ❌ Denied | ❌ Denied | Once registered, staff/accountant cannot edit expense vouchers. Admin/Superadmin can amend. |
| | Delete | ✅ | ✅ (Soft Delete) | ❌ Denied | ❌ Denied | Admin/Superadmin soft delete. Staff/Accountant cannot delete expenses. |
| **`daily_spreadsheets`** | Read | ✅ | ✅ | ✅ | ✅ | All roles read daily spreadsheet metadata and tab links for daily shifts. |
| | Create / Update | ✅ | ✅ | ✅ | ✅ | Synchronized from `/api/gas-proxy` when daily sheet tabs are provisioned. |
| | Delete | ✅ | ✅ | ❌ Denied | ❌ Denied | Admin/Superadmin only. |
| **`audit_logs`** | Read | ✅ | ✅ | ❌ Denied | ❌ Denied | Immutable audit trail is accessible only to Admin and Superadmin. |
| | Create | ✅ (Self ID) | ✅ (Self ID) | ✅ (Self ID) | ✅ (Self ID) | Allowed on any action, strictly requiring `userId == request.auth.uid` and `actor == request.auth.uid`. |
| | Update | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | **Strictly immutable.** Updating audit logs is universally denied. |
| | Delete | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | **Strictly immutable.** Deleting audit logs is universally denied. |
| **`trash`** | Read | ✅ | ✅ | ❌ Denied | ❌ Denied | Soft-deleted records recovery area. Staff/Accountant denied access. |
| | Create | ✅ | ✅ | ❌ Denied | ❌ Denied | Created by Admin/Superadmin when soft-deleting business records. |
| | Update / Delete | ✅ | ❌ Denied | ❌ Denied | ❌ Denied | Only Superadmin can restore records or permanently purge `trash`. |
| **`sync_failures`** | Read | ✅ | ❌ Denied | ❌ Denied | ❌ Denied | Superadmin workspace (`SASync.jsx`) diagnostics only. |
| | Create | ✅ | ✅ | ✅ | ✅ | Client sync queue creates on permanent 4xx failures to avoid infinite retry loops. |
| | Update | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Diagnostics records are immutable. |
| | Delete | ✅ | ❌ Denied | ❌ Denied | ❌ Denied | Superadmin only can clear failure records after manual resolution. |

---

### Decisions for Chaitanya (Confirmed Answers & Implementation Record)

The following 5 decisions have been confirmed and implemented into the security rules and application services:

1. **Accountant on Farmers and Collections (Accepted Read-Only):**
   - **Confirmed Workflow:** Farmer milk payments (`markFarmerPaid`) are recorded by collection staff in `CollectionWorkspace.jsx`, updating `collections/{entryId}` and `farmers/{farmer_id}.current_due`.
   - **Advances & Deductions:** There is no separate advances collection. Farmer advances are logged as operational expenses in the `expenses` collection under category `'Farmer Advance'`. Because `accountant` is granted create permissions on `expenses`, accountants can log farmer advances directly without requiring write access to `collections` or `farmers`.
   - **Access Matrix:** `accountant` is strictly **Read-Only** for `farmers` and `collections`.
2. **Accountant Create-Only on Expenses & Mandatory Audit Logs on Update/Delete:**
   - **Confirmed Workflow:** `accountant` and `staff` have create-only access to `expenses` (`addExpense`).
   - **Audit Trail:** `superAdminService.updateExpense` and `superAdminService.softDeleteExpense` write mandatory, immutable entries to `audit_logs` capturing `before`, `after`, and `reason` for every modification and deletion by `admin` and `superadmin`.
3. **Denying All Client Writes to `users` Collection:**
   - **Codebase Audit Result:** Exhaustive search across all `.js` and `.jsx` files in `src/` confirmed that **zero client-side writes to `users` exist in application code**.
   - **Language & Login State:** User language preference is maintained exclusively in client-side `localStorage` via `i18next-browser-languagedetector`. Session restoration in `appStore.js` performs a read-only `getDoc` on `users/{uid}`.
   - **Administrative Route:** All user creation, activation/deactivation, and role assignments are mediated exclusively via `/api/users.js` using the privileged Firebase Admin SDK with server-side audit logs. (Complete client-write denial to `users` will be locked down in Task 4 rules, replacing the interim hotfix rule that allowed non-sensitive profile edits).
4. **Soft Delete into `trash` for Admin & Permanent Purge for Superadmin Only:**
   - **Confirmed Workflow:** Admins can soft-delete business records (`farmers`, `collections`, `customers`, `sales`, `expenses`).
   - **Atomic Batch Write:** Soft deletion in `superAdminService.js` creates a backup document in `trash/{collection}_{id}` and deletes the source record in a single atomic `writeBatch`.
   - **Restoration & Purge Authority:** In the application UI, only `superadmin` can restore documents from trash (`restoreFromTrash`) or permanently purge them (`purgeFromTrash`), with mandatory audit logging. (The rules restriction enforcing superadmin-only delete/purge on `trash` is scheduled for Task 6).
5. **Sync Failures Logging from Offline Queue & Superadmin Clearance:**
   - **Confirmed Workflow:** `src/utils/syncQueue.js` (`logSyncFailure`) is the sole location where failure records are written.
   - **Client Authentication Guard:** Updated `logSyncFailure` in `src/utils/syncQueue.js` to populate `userId: auth?.currentUser?.uid || null` so writes from the user's phone satisfy `request.resource.data.userId == request.auth.uid`.
   - **Access Matrix:** Any active authenticated user can create a failure record for their own UID. Reading and purging `sync_failures` is strictly restricted to `superadmin`.

---

### Task 3: Rewrite `firestore.rules` from Deny-by-Default with Fail-Closed Helpers

#### 1. Implementation Highlights
- **Deny-by-Default Root Rule:**
  ```javascript
  match /{document=**} {
    allow read, write: if false;
  }
  ```
- **Fail-Closed Helper Hierarchy:**
  - `signedIn()`: Verifies `request.auth != null && request.auth.uid != null`.
  - `hasUserDoc()`: Verifies `signedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid))`.
  - `getUserData()`: Retrieves `users/{uid}` document data.
  - `userRole()`: Safe accessor for `getUserData().get('role', '')`.
  - `isActive()`: Requires `hasUserDoc()`, `active == true`, and role in `['superadmin', 'admin', 'staff', 'accountant']`. Fails closed if document is missing, account is inactive, or role string is malformed / improperly cased.
  - `isSuperAdmin()`: `isActive() && userRole() == 'superadmin'`.
  - `isAdmin()`: `isActive() && (userRole() in ['admin', 'superadmin'])`.
  - `isStaff()`: `isActive() && (userRole() in ['staff', 'admin', 'superadmin'])`.
  - `isAccountant()`: `isActive() && (userRole() in ['accountant', 'admin', 'superadmin'])`.
- **Sync Failures Offline Queue Update:**
  - Updated `src/utils/syncQueue.js` to include caller UID in persistent failure records.

#### 2. Test Verification
- Added 5 new emulator unit tests in `src/firestoreRules.test.js` under `Fail-Closed Helpers & Deny-by-Default Architecture`:
  - Denies read/write to unmapped collections by default (`unknown_secret_collection`).
  - Fails closed when user profile document is missing (`ghost_user`).
  - Fails closed when user profile is marked inactive (`active: false`).
  - Fails closed when role string is malformed or improperly cased (`role: 'Admin'` or `'intern'`).
  - Allows active users to create sync failures for their own UID, but blocks forged failure logs claiming another UID.
- Full emulator rules suite passing: **18/18 tests passed** (`npm run test:rules`).
- Full Vitest suite passing: **69 passed, 18 skipped** (when emulator offline).
- Production build passing: `npm run build` (0 errors).

---

#### Notes for Next Iteration (Phase 3, Task 4)
- **Completed:** Tasks 1, 2, and 3.
- **Next Task:** **Task 4: `users` collection rules lockdown**:
  - Restrict `users/{userId}`: user may read only their own document; superadmin may read all.
  - Deny all client creates, updates, and deletes (since inventory and audit confirmed zero client writes are needed and all user management is handled via `/api/users.js`).

---

## Phase 4 Execution Summary

### Phase 4 Checklist (All 10 Tasks Complete)
- [x] **Task 1: Centralized API Client Helper (`src/utils/apiClient.js`)**
  - Sends fresh Firebase ID token via `getIdToken(false)`.
  - Handles 401 by refreshing token with `getIdToken(true)` once, signing user out if retry fails.
  - Handles 403 with clear bilingual Marathi & English message.
  - Shields 5xx internal errors with generic bilingual messages.
  - Zero direct external calls to Apps Script, Gemini, or Identity Toolkit.
- [x] **Task 2: Replace Direct Apps Script Calls**
  - Replaced calls in `src/utils/api.js`, `src/utils/firestoreService.js`, and `src/utils/syncQueue.js` with `callGasProxy`.
  - Removed spreadsheet IDs (`sheetsIdMaster`, `sheetsIdCollection`, `sheetsIdCustomer`, `sheetsIdExpense`) from request payloads and settings state.
- [x] **Task 3: Harden Offline Sync Queue (`src/utils/syncQueue.js`)**
  - Uses fresh token on every retry via `callGasProxy`.
  - Drops permanent 4xx errors (400, 401, 403) immediately to prevent infinite retry loops; logs to Firestore `sync_failures`.
  - Retries transient network/5xx/429 errors with exponential backoff up to 5 times.
  - Idempotency key attached to every mutation to prevent duplicate entries; bounded failed history with quota eviction.
- [x] **Task 4: Gemini Egress Refactor & Image Compression (`src/utils/gemini.js`)**
  - Replaced direct `generativelanguage.googleapis.com` calls with `/api/gemini`.
  - Added browser-side HTML5 canvas image compression (max 1600px, 0.8 JPEG quality, white background fill for transparent PNGs).
  - Friendly bilingual toast/error message when payload exceeds 4MB.
- [x] **Task 5: SuperAdmin User Management Migration (`src/utils/superAdminService.js`)**
  - Replaced Identity Toolkit REST calls with `/api/users`.
  - Purged `FIREBASE_API_KEY` usage from `superAdminService.js`.
  - Admin password reset links returned over secure HTTPS, copied to clipboard with prompt fallback.
- [x] **Task 6: WhatsApp Token & Sheet IDs Lockdown in Settings**
  - Removed editable `whatsappToken` input from `Settings.jsx` and `SASettings.jsx`.
  - Sanitized `saveSettings()` in `firestoreService.js` to strip `whatsappToken` and `sheetsId*` before writing.
  - Replaced editable fields with read-only server-managed status indicators.
- [x] **Task 7: Purge Leaked Variables, DNS Prefetch, and Update Docs**
  - Removed `VITE_APPS_SCRIPT_URL` and `VITE_GEMINI_API_KEY` from `.env`.
  - Removed `<link rel="dns-prefetch" href="https://script.google.com">` from `index.html`.
  - Updated `.env.example` and `README.md` separating public client variables from server-side secrets.
  - Documented `vercel dev` requirement for local full-stack development.
- [x] **Task 8: Automated Tests for API Client, 401/403, and Retry Rules**
  - Implemented `src/utils/apiClient.test.js` (401 refresh, auto-signout, 403 bilingual message, 500 masking, AST guard for zero `VITE_GEMINI_API_KEY`/`VITE_APPS_SCRIPT_URL` references in `src/`).
  - Implemented `src/utils/syncQueue.test.js` (permanent 4xx drops, idempotency deduplication, payload sanitization).
- [x] **Task 9: Automated Build Sentinel Verification Test (`src/utils/bundleLeaks.test.js`)**
  - Automated test builds with `VITE_GEMINI_API_KEY=SENTINEL_GEMINI_TEST_VALUE` and `VITE_APPS_SCRIPT_URL=SENTINEL_GAS_TEST_VALUE`.
  - Asserts 0 occurrences of sentinel values, `script.google.com/macros`, and `generativelanguage.googleapis.com` in `dist/`.
- [x] **Task 10: Sequential Production Deployment Order Documented**
  - Exact 7-step deployment guide detailed under `HUMAN ACTIONS NEEDED` (Script Properties -> Deploy Code.gs -> Vercel env vars -> Deploy App -> Smoke test -> Archive old deployment -> Deploy Firestore rules).

### Completed Tasks & Phase 4 Verification
1. **Unified Client API Gateway (`src/utils/apiClient.js`):**
   - Implemented `apiRequest`, `callGasProxy`, `callGemini`, and `callUsersApi`.
   - Obtains fresh Firebase ID token via `getIdToken(false)`.
   - On 401 Unauthorized: automatically triggers a single forced token refresh via `getIdToken(true)` and retries. If the retry fails or the token refresh rejects, gracefully invokes signout and returns bilingual error.
   - On 403 Forbidden: returns clear bilingual rejection without logging out: `"तुम्हाला ही कृती करण्याची परवानगी नाही / You do not have permission to perform this action."`
   - On 5xx Server Errors: shields internal server stack traces with client-safe bilingual message: `"सर्व्हर त्रुटी आली. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा / A server error occurred. Please try again later."`
2. **Refactored Frontend Egress (`api.js`, `firestoreService.js`, `gemini.js`, `superAdminService.js`):**
   - Purged `APPS_SCRIPT_URL` and `VITE_APPS_SCRIPT_URL` from all frontend modules. All spreadsheet operations route through `callGasProxy()`.
   - Purged `VITE_GEMINI_API_KEY` and direct calls to `generativelanguage.googleapis.com`. AI OCR and chat route through `callGemini()`. Added client-side HTML5 Canvas receipt image resizing (max 1600px, 0.8 JPEG quality) with bilingual 4MB file limit guard.
   - Purged `FIREBASE_API_KEY` and direct REST calls to `identitytoolkit.googleapis.com`. User creation and updates consume `/api/users`. Password reset uses official Firebase Auth SDK `sendPasswordResetEmail()`, with ephemeral admin reset links returned over HTTPS and copied directly to clipboard (never written to Firestore or logs).
   - Sanitized `saveSettings()` in `firestoreService.js` to strip `whatsappToken` and `sheetsId*` before writing to Firestore `settings/general`.
3. **Hardened Background Sync Queue (`src/utils/syncQueue.js`):**
   - Directs all spreadsheet synchronizations via `callGasProxy(action, { ...payload, idempotencyKey: job.id })`.
   - Deduplicates jobs using deterministic operation IDs.
   - Permanent 4xx errors (401, 403, 400) do NOT retry endlessly; immediately marked as failed, logged to Firestore `sync_failures` collection, and removed from queue.
   - Transient network and 5xx errors retry with exponential backoff up to 5 attempts.
4. **Store & Settings UI Lockdown:**
   - Removed `sheetsIdCollection`, `sheetsIdCustomer`, and `sheetsIdExpense` from `clearAllTransactions()` in `appStore.js` (relying on server-side Script Properties).
   - Replaced editable `whatsappToken` and spreadsheet ID inputs in `Settings.jsx` and `SASettings.jsx` with secure server-managed status indicators.
   - Refactored `HomeDashboard.jsx` spreadsheet open buttons to retrieve authorized tab URLs via `callGasProxy('getSpreadsheetTabUrl')`.
   - Updated `SASync.jsx` to reflect locked server-side script properties.
5. **Environment & Bundle Hardening:**
   - Removed obsolete `<link rel="dns-prefetch" href="https://script.google.com">` from `index.html`.
   - Removed `VITE_GEMINI_API_KEY` and `VITE_APPS_SCRIPT_URL` from `.env`.
   - Refactored `firebase.js` to access `import.meta.env` strictly via static property access, preventing Vite from serializing arbitrary env vars into the production bundle.
   - Verified production build with sentinel env values (`VITE_GEMINI_API_KEY=SENTINEL_GEMINI`, `VITE_APPS_SCRIPT_URL=SENTINEL_GAS`): bundle leaks test proves zero occurrences of sentinel variables, `script.google.com/macros`, or `generativelanguage.googleapis.com` in `dist/`.
6. **Automated Test Coverage:**
   - Added `src/utils/apiClient.test.js` (11 tests covering token refresh, 403, 500 masking, network errors, and AST pattern guard).
   - Added `src/utils/syncQueue.test.js` (4 tests covering payload sanitization, deduplication, and non-retryable 4xx drops).
   - Added `src/utils/bundleLeaks.test.js` (4 tests verifying zero bundle leaks).
   - Full Vitest suite passing (10 files, 69 tests passed, 13 rules tests skipped when emulator offline).
   - Firestore Emulator rules suite passing (13/13 tests passed).

---

## Phase 5 Execution Summary

### Phase 5 Checklist
- [x] **Task 1: Inventory all uses of `xlsx` package across imports, exports, templates, backup/restore, and reports.**
  - Complete code audit performed; zero files removed in this task.
- [ ] **Task 2: Create unified `src/utils/fileImport.js` module.**
  - CSV via `papaparse`; `.xlsx` via dynamically-imported `exceljs` (keeping main chunk lightweight).
  - Explicit rejection of legacy `.xls` and `.ods` with bilingual Marathi & English guidance.
- [ ] **Task 3: Pre-parsing safety limits & binary magic number verification.**
  - Max 5MB file size, max 5,000 rows, max 50 columns, max 1 sheet read.
  - Check `.xlsx` content type / zip header (`PK\x03\x04`). Never evaluate formulas (read cached result values only, or reject formula cells); ignore macros, external links, and embedded OLE objects.
- [ ] **Task 4: Strict row validation & injection sanitization.**
  - Trim text, parse Marathi/Devanagari text & numerals, handle UTF-8 with/without BOM.
  - Bilingual header dictionary mapping (English & Marathi).
  - Range validation (litres > 0, fat/SNF boundaries, valid dates/Excel serials).
  - In-file deduplication; prototype pollution protection (`__proto__`, `constructor` blocked).
- [ ] **Task 5: Two-stage preview & dry-run flow.**
  - Show valid rows, error counts, row/column locations. No persistence until explicit user confirmation.
- [ ] **Task 6: Chunked proxy transmission via `apiClient`.**
  - Chunks fit under 512KB proxy limit; idempotency key per chunk; progress reporting and partial failure reporting.
- [ ] **Task 7: Secure export refactor (CSV & XLSX).**
  - Prepend UTF-8 BOM (`\uFEFF`) to CSV exports for Excel compatibility.
  - Prefix formula-injection characters (`=`, `+`, `-`, `@`) with `'`.
- [ ] **Task 8: Package removal & dependency vulnerability audit.**
  - Remove `xlsx` from `package.json` & lockfile.
  - Run `npm audit --omit=dev` and document results.
- [ ] **Task 9: Comprehensive automated test suite.**
  - Tests for valid CSV, Marathi BOM, size limits, row limits, extension spoofing, duplicates, negative values, formula injection, and bundle chunk isolation.
- [ ] **Task 10: Mobile responsiveness & UI performance verification.**
  - Verify 360px viewport responsiveness and ensure 5,000-row processing does not block main thread.

---

### Inventory of `xlsx` Package Usages (Task 1 Audit)

The codebase was comprehensively audited for all direct and indirect dependencies on the `xlsx` (`SheetJS`) package. In accordance with Task 1 directives, **no code or dependencies have been removed yet**.

| File | Type | Line(s) | Description & Functionality | Security / Architectural Risk |
|---|---|---|---|---|
| [`src/utils/gaudaiAI.js`](src/utils/gaudaiAI.js) | **Import** | L14 | `import * as XLSX from 'xlsx';` | Top-level static import causes the entire vulnerable `xlsx` package (~800KB) to be included in the main app production bundle (`index-*.js`). |
| [`src/utils/gaudaiAI.js`](src/utils/gaudaiAI.js) | **Import / Parsing** | L350–373 | `export async function parseExcelData(file)` | Reads user-uploaded file array buffers using `XLSX.read(data, { type: 'array' })`. Iterates all `workbook.SheetNames` and converts each worksheet to an array of objects via `XLSX.utils.sheet_to_json(worksheet, { defval: '' })`. Called by `processExcelFile()` (L458–480). | Vulnerable to Prototype Pollution (CVE-2023-30533) and ReDoS; no file size, row, column, or sheet limits; no binary zip validation (`PK`); indiscriminately accepts `.xls` and `.ods`. |
| [`src/utils/gaudaiAI.js`](src/utils/gaudaiAI.js) | **Export (Excel)** | L380–385 | `export function exportToExcel(rows, filename)` | Converts JSON rows into a worksheet via `XLSX.utils.json_to_sheet(rows)`, creates a workbook via `XLSX.utils.book_new()`, appends sheet `XLSX.utils.book_append_sheet(wb, ws, 'Report')`, and triggers download with `XLSX.writeFile(wb, `${filename}.xlsx`)`. | No formula injection protection: values starting with `=`, `+`, `-`, `@` are exported as live spreadsheet formulas. |
| [`src/utils/gaudaiAI.js`](src/utils/gaudaiAI.js) | **Export (CSV)** | L392–402 | `export function exportToCSV(rows, filename)` | Converts JSON rows to worksheet via `XLSX.utils.json_to_sheet(rows)`, serializes via `XLSX.utils.sheet_to_csv(ws)`, and downloads as a text/csv Blob. | Lacks UTF-8 BOM (`\uFEFF`), which causes Marathi/Devanagari text to render corrupted (mojibake) in Excel; lacks formula injection escaping. |
| [`src/store/chatStore.js`](src/store/chatStore.js) | **Import / Pipeline** | L7, L170, L204 | Imports `processExcelFile`, `exportToExcel`, `exportToCSV`. In `handleFileUpload()`, detects `['xlsx', 'xls', 'csv', 'ods']` and dispatches to `processExcelFile(file, snapshot, task)`. | Tightly couples chat pipeline to `gaudaiAI.js` spreadsheet methods. |
| [`src/store/chatStore.js`](src/store/chatStore.js) | **Export (Reports)** | L265–295 | `downloadReport: (format = 'xlsx') => { ... }` | Dispatches to `exportToCSV(rows, filename)` or `exportToExcel(rows, filename)` based on format argument. | Inherits `gaudaiAI.js` export vulnerabilities. |
| [`src/components/chat/ReportCard.jsx`](src/components/chat/ReportCard.jsx) | **UI / Report Actions** | L34, L43, L46 | UI action buttons triggering `downloadReport('xlsx')` and `downloadReport('csv')`. | UI consumer of report exports. |
| [`src/components/chat/SpreadsheetPreviewCard.jsx`](src/components/chat/SpreadsheetPreviewCard.jsx) | **UI / Cleaned Export** | L4, L194 | Imports `exportToExcel` from `gaudaiAI.js`. Invokes `exportToExcel(rowsToExport, ...)` to download user-edited/cleaned spreadsheet data. | UI consumer of `exportToExcel`. |
| [`src/components/chat/ChatInput.jsx`](src/components/chat/ChatInput.jsx) | **UI / File Input** | L17, L25, L44, L272, L325, L334, L383 | Defines `ACCEPTED_EXTENSIONS` (`['xlsx', 'xls', 'csv', 'ods']`), file input `accept` strings, drag-and-drop validation, and helper labels mentioning Excel formats. | Needs updating in subsequent tasks to drop `.xls` and `.ods` and guide users to `.xlsx` or `.csv`. |
| [`src/utils/spreadsheetPdf.test.js`](src/utils/spreadsheetPdf.test.js) | **Unit Tests** | L2, L48–68 | Unit test importing `* as XLSX from 'xlsx'`. Uses `XLSX.utils.book_new()`, `XLSX.utils.json_to_sheet()`, and `XLSX.utils.sheet_to_json()` to verify spreadsheet parsing and export behavior. | Unit test will need refactoring when `xlsx` is uninstalled in Task 8. |
| [`src/components/superadmin/SAComponents.jsx`](src/components/superadmin/SAComponents.jsx) | **Independent CSV Export** | L298–317 | `export function exportToCSV(data, filename)` | Custom string-based CSV serializer used across 8 SuperAdmin views (`SAAuditLog`, `SACollections`, `SACustomers`, `SADatabase`, `SAExpenses`, `SAFarmers`, `SASales`, `SAUsers`). | Does not use `xlsx` directly, but shares identical CSV export vulnerabilities: lacks UTF-8 BOM (`\uFEFF`) and lacks formula injection protection (`=, +, -, @`). Must be unified with secure export utility in Task 7. |
| [`package.json`](package.json) | **Package Dependency** | L28 | `"xlsx": "^0.18.5"` | Direct project dependency; triggers critical `npm audit` warnings. |
| [`package-lock.json`](package-lock.json) | **Lockfile Dependency** | L24, L13745–13760 | Resolved dependency on `xlsx@0.18.5`. | Must be cleanly removed in Task 8 alongside installation of `papaparse` and `exceljs`. |

---

### Notes for Next Iteration (Phase 5, Task 2)
- **Next Task:** Task 2 — Create the unified parser module `src/utils/fileImport.js`.
- **Implementation Strategy:**
  - Parse CSV using `papaparse` (lightweight, robust streaming support).
  - Parse `.xlsx` using `exceljs`, loaded strictly via dynamic `import('exceljs')` so that the heavy Excel parsing engine is not bundled into the initial application payload.
  - Detect and reject legacy `.xls` (Compound File Binary Format / OLE) and `.ods` (OpenDocument Spreadsheet) files, presenting a clear bilingual alert:
    - *Marathi:* `"कृपया फाईल CSV किंवा .xlsx फॉरमॅटमध्ये सेव्ह करून पुन्हा अपलोड करा."`
    - *English:* `"Please save your file as CSV or .xlsx format and upload again."`
  - Maintain all existing UI and components intact without breaking changes until Task 7/8.

---

## Phase 6 Execution Summary

### Phase 6 Checklist
- [x] **Task 1: Repository hygiene**
  - Deleted `debug_call.js` and `scratch/` (including `scratch/read_firestore_settings.js` and all one-off test scripts).
  - Hardened `.gitignore` (.env, .env.*, preserving !.env.example; scratch; dist; logs; service account files; .vercel; sample data).
  - Removed lingering `console.log` from `src/utils/api.js`; confirmed zero console logs printing user data, tokens, or responses.
- [ ] **Task 2: Project identity & real documentation**
  - Set package name to `gaudai-dairy-erp`, add version, replace default Vite README with comprehensive production docs (architecture, local setup, emulator, env tables, deployment order, troubleshooting).
- [ ] **Task 3: Branding, favicon & Open Graph meta**
  - Move logo to `public/`, link favicon and apple-touch-icon. Add OG/Twitter tags, theme-color, lang attribute, clean meta description.
- [ ] **Task 4: Vercel configuration & security headers**
  - Add SPA rewrites (excluding `/api`), hashed asset caching vs index.html no-cache, HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy, Report-Only CSP.
- [ ] **Task 5: React Error Boundary & friendly error handling**
  - Add top-level Error Boundary with bilingual Marathi/English retry UI; ensure clean API error messages.
- [ ] **Task 6: ESLint errors resolution**
  - Resolve existing React hook errors (setState inside effects) without behavioral regressions.
- [ ] **Task 7: Performance & code-splitting**
  - Lazy-load chat, import, reports, and charts via React.lazy/Suspense; report before/after bundle sizes.
- [ ] **Task 8: Translation key parity & hardcoded strings migration**
  - Verify 100% key parity between English and Marathi translations, ensure zero empty values or raw key leaks.
- [ ] **Task 9: Centralized Gemini model configuration**
  - Ensure single source of truth for `GEMINI_MODEL`, remove stale model comments.
- [ ] **Task 10: Dependency audit & unused package pruning**
  - Run `npm audit --omit=dev`, prune unused dependencies.
- [ ] **Task 11: UI/UX parity verification across resolutions**
  - Compare screens against baseline commit at 360px and 1280px viewports.
- [ ] **Task 12: Final production self-audit & go/no-go report**
  - Validate zero secrets, token enforcement, role matrix, egress isolation, queue durability, build & test success.

---

### Notes for Next Iteration (Phase 6, Task 2)
- **Next Task:** Task 2 — Project identity.
- Update `package.json` name to `gaudai-dairy-erp` and ensure version is set.
- Replace default Vite README with complete production documentation:
  - Application summary & architecture overview (React 19, Firebase Auth & Firestore, Vercel Serverless `/api`, Google Apps Script, Google Sheets).
  - Local development instructions (`vercel dev`, Firebase Emulator).
  - Client public variables vs. Server secret variables tables.
  - Step-by-step sequential deployment order from PROGRESS.md.
  - Troubleshooting guide.

---

## HUMAN ACTIONS NEEDED

> [!IMPORTANT]
> The repository is public; therefore, treat all old keys, URLs, and IDs as already exposed. **Key rotation and service restriction matter significantly more than git history scrubbing.**

### Sequential Production Deployment Order

Follow this exact sequential order to deploy the hardened application with zero downtime:

1. **Step 1: Set Script Properties in Google Apps Script:**
   - Open your Google Apps Script project attached to your master spreadsheet.
   - Navigate to **Project Settings > Script Properties** and add:
     - `APPS_SCRIPT_SECRET` = `<GENERATE_32_CHAR_RANDOM_SECRET>` (must be at least 32 characters)
     - `MASTER_DB_ID` = `<PRODUCTION_MASTER_SHEET_ID>`
     - `COLLECTION_DB_ID` = `<PRODUCTION_COLLECTION_SHEET_ID>`
     - `CUSTOMER_DB_ID` = `<PRODUCTION_CUSTOMER_SHEET_ID>`
     - `EXPENSE_DB_ID` = `<PRODUCTION_EXPENSE_SHEET_ID>`
     - `WHATSAPP_TOKEN` = `<ROTATED_WHATSAPP_TOKEN>`
     - `WHATSAPP_PHONE_ID` = `<WHATSAPP_PHONE_ID>`

2. **Step 2: Deploy New `Code.gs`:**
   - In Apps Script editor, copy the contents of `google-apps-script/Code.gs`.
   - Click **Deploy > New Deployment** (Type: Web App, Execute as: Me, Access: Anyone).
   - Copy the new Web App URL (do not archive the old deployment yet until smoke testing completes).

3. **Step 3: Configure Vercel Server Environment Variables:**
   - In Vercel Project Settings -> **Environment Variables**, set:
     - `FIREBASE_PROJECT_ID` = `<FIREBASE_PROJECT_ID>`
     - `FIREBASE_CLIENT_EMAIL` = `<SERVICE_ACCOUNT_CLIENT_EMAIL>`
     - `FIREBASE_PRIVATE_KEY` = `<SERVICE_ACCOUNT_PRIVATE_KEY>`
     - `APPS_SCRIPT_URL` = `<NEW_APPS_SCRIPT_URL>`
     - `APPS_SCRIPT_SECRET` = `<SAME_32_CHAR_SECRET_AS_STEP_1>`
     - `GEMINI_API_KEY` = `<NEW_ROTATED_GEMINI_KEY>`
     - `GEMINI_MODEL` = `gemini-2.0-flash`
     - `WHATSAPP_TOKEN` = `<ROTATED_WHATSAPP_TOKEN>`
     - *(Optional)* `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`
   - Check **Mark as Sensitive** for each secret in Vercel.

4. **Step 4: Deploy Frontend & Serverless Proxy to Vercel:**
   - Merge Phase 4 branch to production / trigger Vercel deployment.
   - Vercel automatically deploys the frontend SPA and builds the `/api/*` serverless routes.

5. **Step 5: Perform Smoke Tests:**
   - Log in with authorized staff, accountant, admin, and superadmin accounts.
   - Test milk collection entry, customer sale, expense creation, and spreadsheet tab opening.
   - Verify receipts OCR via Gaudai Chat.
   - Verify Superadmin user management.

6. **Step 6: Archive Old Apps Script Deployments:**
   - In Apps Script editor, click **Deploy > Manage Deployments**.
   - Select each **OLD** deployment version and click **Archive**.
   - Verify that requests to the old deployment URL fail or return Unauthorized.

7. **Step 7: Deploy Firestore Security Rules:**
   - Run from terminal:
     ```bash
     firebase deploy --only firestore:rules
     ```
   - Verify rules enforcement via Firebase Console.

---

### Sync Queue Idempotency Key Architecture
- Every mutation action (`addMilkCollection`, `addSale`, `recordPayment`, `addExpense`, `deleteExpense`, `registerFarmer`, `addCustomer`) generates a unique deterministic operation ID (e.g. `col_E1794932642719`, `sale_B1794932642723`, `custpay_PAY1794932642727`).
- The operation ID is passed as `idempotencyKey` through `/api/gas-proxy` to `Code.gs`.
- If a temporary network interruption causes the client to retry a sync job, the Google Apps Script backend verifies the idempotency key against the transaction ledger, preventing duplicate row insertions.
- Permanent client errors (400, 401, 403) are never retried in an infinite loop; they are automatically written to Firestore `sync_failures` and removed from the active queue.

---

### 1. Immediate Secret Revocation & Restriction
- [ ] **Revoke Old Google Gemini Key Immediately:**
  - Visit [Google AI Studio](https://aistudio.google.com/) -> API Keys.
  - Delete / revoke `<OLD_GEMINI_KEY>` immediately—do not wait for later phases.
  - Generate a new Gemini API Key to be used strictly server-side in Vercel.
  - Set up a **Budget Alert** in Google Cloud Console for the Gemini API to prevent unexpected billing spikes.
- [ ] **Restrict Firebase Web API Key (by domain & by API):**
  - In [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials:
    - Edit the Browser/Web API key (`<FIREBASE_API_KEY>`).
    - **Application restrictions:** Restrict to HTTP referrers matching your production domain(s) and `localhost`.
    - **API restrictions:** Restrict key usage strictly to **Firebase Authentication** and **Cloud Firestore API**.
- [ ] **Rotate Meta WhatsApp Cloud API Token & Clean Firestore:**
  - In Meta for Developers / WhatsApp Business portal, generate a new System User access token.
  - Revoke the previously exposed token.
  - **Delete the `whatsappToken` field from the Firestore `settings/general` document** once the token moves to Apps Script Script Properties.

### 2. User & Identity Audit
- [ ] **Audit Firestore `users` Collection:**
  - Inspect the Firestore `users` collection for any unexpected `admin` or `superadmin` role, or accounts containing `superadmin` in their email.
  - Delete or reset the passwords for demo accounts (`<DEMO_SUPERADMIN_EMAIL>`, `<DEMO_ADMIN_EMAIL>`, `<DEMO_STAFF_EMAIL>`, `<DEMO_ACCOUNTANT_EMAIL>`).
- [ ] **Super Admin Security & MFA Note:**
  - Note: Native multi-factor authentication (MFA) requires upgrading Firebase Auth to Identity Platform (paid tier).
  - If on the free Spark plan, protect the primary superadmin account with a long, unique password (24+ random characters) and dedicated secure email.

### 3. Google Apps Script Configuration, Deployment & Archival

> [!WARNING]
> **CRITICAL DEPLOYMENT TIMING FOR `Code.gs`:**
> `Code.gs` must be deployed **ONLY AFTER Phase 4 (Frontend Refactor) is fully merged and deployed**.
> The current frontend directly calls Apps Script without the shared secret; deploying the hardened `Code.gs` before Phase 4 will immediately reject all frontend spreadsheet requests and take the system offline.

- [ ] **Set Script Properties First:**
  - In Apps Script editor -> **Project Settings > Script Properties**, set:
    - `APPS_SCRIPT_SECRET` = `<GENERATE_32_CHAR_RANDOM_SECRET>`
    - `MASTER_DB_ID` = `<PRODUCTION_MASTER_SHEET_ID>`
    - `COLLECTION_DB_ID` = `<PRODUCTION_COLLECTION_SHEET_ID>`
    - `CUSTOMER_DB_ID` = `<PRODUCTION_CUSTOMER_SHEET_ID>`
    - `EXPENSE_DB_ID` = `<PRODUCTION_EXPENSE_SHEET_ID>`
    - `WHATSAPP_TOKEN` = `<ROTATED_WHATSAPP_TOKEN>`
    - `WHATSAPP_PHONE_ID` = `<WHATSAPP_PHONE_ID>`
- [ ] **Deploy and Archive Old Deployment (After Phase 4 Completes):**
  - In Apps Script editor, click **Deploy > New Deployment** (Type: Web App, Execute as: Me, Access: Anyone).
  - Copy the new Web App URL to Vercel env vars as `APPS_SCRIPT_URL`.
  - **CRITICAL:** Click **Deploy > Manage Deployments**, select the **OLD** deployment version(s), and click **Archive**. If not archived, the old unauthenticated version remains publicly accessible on the web!

### 4. Firestore Security Rules Hotfix & Deployment

> [!NOTE]
> **Minimal Firestore Rules Hotfix Status:** Tested and verified via Firebase Emulator (`13/13` security tests passed).
> **Test Command:** `npm run test:rules` (spawns Firestore emulator and runs [`src/firestoreRules.test.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/firestoreRules.test.js)).
> **Verified Security Protections:**
> - A user can read their own `users` document (first login flow), but can **never** create a user document or mutate their own `role`, `active` status, or `email`.
> - Only a verified `superadmin` (by Firestore record `role == 'superadmin'`) can create users or modify roles.
> - Removed the backdoor rule that treated any email containing `"superadmin"` as a superadmin (`fake_superadmin@attacker.com` is strictly blocked).
> - Audit logs require caller identity verification (`userId` and `actor` must equal `request.auth.uid`), preventing log forgery. Audit records remain strictly immutable.
> - All existing operational permissions (farmers, collections, customers, sales, expenses, settings read) remain untouched so the current frontend continues working seamlessly.

- [ ] **Exact Deploy Command (Human Action When Ready — Do Not Deploy Automatically):**
  ```bash
  firebase deploy --only firestore:rules
  ```
  *(Note: Run `firebase login` first if not authenticated, or `npx firebase deploy --only firestore:rules`)*
- [ ] **Phase 3 Full Rules Overhaul Note:**
  - The comprehensive Phase 3 rules rewrite with per-role matrix lockdown will be deployed after Phase 4 serverless proxy migration is completed.
- [ ] **Enable Firebase App Check:**
  - In Firebase Console -> App Check, register your web app with reCAPTCHA Enterprise to block non-browser scrapers and direct API abuse.

### 5. Vercel Server-Side Secrets
- [ ] **Configure and Mark Sensitive in Vercel:**
  - In Vercel Project Settings -> **Environment Variables**, set:
    - `FIREBASE_PROJECT_ID` = `<FIREBASE_PROJECT_ID>`
    - `FIREBASE_CLIENT_EMAIL` = `<SERVICE_ACCOUNT_CLIENT_EMAIL>`
    - `FIREBASE_PRIVATE_KEY` = `<SERVICE_ACCOUNT_PRIVATE_KEY>`
    - `GEMINI_API_KEY` = `<NEW_ROTATED_GEMINI_KEY>`
    - `APPS_SCRIPT_URL` = `<NEW_APPS_SCRIPT_URL>`
    - `APPS_SCRIPT_SECRET` = `<SHARED_SECRET>`
    - `WHATSAPP_TOKEN` = `<ROTATED_WHATSAPP_TOKEN>`
  - Check **Mark as Sensitive** for each secret in Vercel so they cannot be inspected in the UI or build logs.
  - Ensure the backend code restores `\n` line breaks for `FIREBASE_PRIVATE_KEY` (`privateKey.replace(/\\n/g, '\n')`).
