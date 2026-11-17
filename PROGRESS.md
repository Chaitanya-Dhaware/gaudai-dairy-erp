# Gaudai AI Dairy ERP - Hardening & Production Readiness Progress

> **CRITICAL SECURITY RULE:**
> Never write a real credential, key, token, spreadsheet ID, project ID, or URL into any file. Use placeholders only (`<OLD_GEMINI_KEY>`, `<MASTER_SHEET_ID>`, `<APPS_SCRIPT_URL>`, `<FIREBASE_API_KEY>`, etc.).

---

## Progress Tracker

| Phase | Description | Status |
|:---:|---|:---:|
| **Phase 1** | Authentication & Client Lockdown (Remove Demo Bypass, Add Tests, Auth Emulator Docs) | ✅ Complete |
| **Phase 2** | Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth in `Code.gs` | ✅ Complete |
| **Phase 3** | Database & Access Control Hardening (`firestore.rules` + Emulator Tests) | ⬜ Not Started |
| **Phase 4** | Frontend Egress Refactor (Eliminate Direct Calls to Gemini, Apps Script & Identity Toolkit) | ⬜ Not Started |
| **Phase 5** | Secure File Import (Replace `xlsx` with `papaparse` & `exceljs`, Lazy Loading, Limits, Audit) | ⬜ Not Started |
| **Phase 6** | Production Polish, UI/UX, Meta, Security Headers & Regression Verification | ⬜ Not Started |

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

## HUMAN ACTIONS NEEDED

> [!IMPORTANT]
> The repository is public; therefore, treat all old keys, URLs, and IDs as already exposed. **Key rotation and service restriction matter significantly more than git history scrubbing.**

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
