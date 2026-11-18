---
milestone: Production Hardening & Security Remediation
version: 1.0.0
updated: 2026-11-17T18:24:00+05:30
---

# Gaudai AI Dairy ERP - Hardening Roadmap

> **CRITICAL SECURITY RULE:**
> Never write a real credential, key, token, spreadsheet ID, project ID, or URL into any file. Use placeholders only (`<OLD_GEMINI_KEY>`, `<MASTER_SHEET_ID>`, `<APPS_SCRIPT_URL>`, `<FIREBASE_API_KEY>`, etc.).

> **Current Phase:** Phase 2 - Secure Serverless Backend Proxy (`/api/*`)
> **Status:** Phase 1 Complete, Phase 2 Ready to Start

---

## Must-Haves (from Architecture & Security Spec)

- [x] Zero client-side auth bypass: Demo credentials completely removed; failed Firebase sign-in never populates user state.
- [x] Automated regression tests proving failed sign-in never grants session.
- [ ] Vercel Serverless Functions (`/api/*`) proxying all external requests (Apps Script, Gemini, User Admin).
- [ ] Firebase Admin SDK token verification on every serverless endpoint; role checks enforced in the proxy via Firestore.
- [ ] Allowlist of allowed actions per role in the backend proxy; rejection of unknown actions.
- [ ] Defense-in-depth on `google-apps-script/Code.gs`: shared secret verification in payload (`APPS_SCRIPT_SECRET`), rejection of client-supplied sheet IDs, removal of `MASTER_SHEET_ID_OVERRIDE`.
- [ ] Zero browser secrets: No `VITE_` prefix on sensitive keys; zero direct browser calls to Apps Script, Gemini, or Identity Toolkit.
- [ ] Hardened `firestore.rules`: Removal of email regex backdoor (`.*superadmin.*`), immutable user roles by normal users, audit log integrity, protection of sensitive settings.
- [ ] Automated Firestore rules tests using the Firebase Emulator covering role escalation, audit_logs forgery, and per-role access across all collections.
- [ ] Scheduled rules deployment: Rules deployed only AFTER Phase 4 completes so the old frontend does not break during development.
- [ ] Replace `xlsx 0.18.5` with `papaparse` (CSV) and `exceljs` (XLSX), lazy-loaded on import screen, dropping legacy `.xls`/`.ods` with bilingual warnings, formula evaluation disabled, strict size/row limits, clean `npm audit`.
- [ ] Production Polish: Favicon in `public/` linked from `index.html`, Open Graph tags, single-language meta description, HTTP security headers in `vercel.json`, `.env.example`, real `README.md`, package name `gaudai-dairy-erp`, zero ESLint errors, lazy-loaded chat panel, single configurable Gemini model name, and en/mr translation key parity test.
- [ ] 100% visual and functional parity for legitimate users across English and Marathi.

---

## Phases

### Phase 1: Authentication & Client Lockdown
**Status:** ✅ Complete  
**Objective:** Eliminate the demo login backdoor, purge hardcoded demo credentials, verify that failed logins cannot set user state, and document test procedures with the Firebase Auth Emulator.  
**Requirements:** SEC-01 (No demo bypass), SEC-02 (Auth failure test), SEC-03 (Emulator documentation)

**Plans:**
- [x] **Plan 1.1: Purge Demo Backdoor from Login View**
  - Remove `demo user profiles` array, demo profile quick-click buttons, and bypass fallback catch block from `src/views/Login.jsx`.
  - Ensure failed logins show clear error notifications without altering store state.
- [x] **Plan 1.2: Add Auth Failure & State Isolation Tests**
  - Add comprehensive Vitest test suite (`src/views/Login.test.jsx` / `src/store/appStore.test.js`) verifying failed Firebase sign-in never sets user in `appStore` or unlocks routes.
- [x] **Plan 1.3: Document Firebase Auth Emulator Setup**
  - Update `README.md` with instructions on running the Firebase Auth Emulator for local offline testing.

---

### Phase 2: Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth
**Status:** ✅ Complete  
**Objective:** Build authenticated Vercel Serverless Functions to mediate all communication between the frontend and third-party APIs (Apps Script, Gemini, Firebase Admin). Harden `Code.gs` with shared secret verification and locked sheet IDs.  
**Requirements:** SEC-04 (Vercel serverless proxy), SEC-05 (Admin SDK token & role check), SEC-06 (Action allowlist), SEC-07 (Apps Script shared secret), SEC-08 (Locked sheet IDs), SEC-09 (Admin SDK user creation)

**Plans:**
- [x] **Plan 2.1: Serverless Middleware & Firebase Admin Auth Helper**
  - Create `/api/_lib/firebaseAdmin.js` to initialize the Firebase Admin SDK using server-side credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` with `\n` restoration).
  - Create `/api/_lib/auth.js` to extract Bearer token, verify ID token with Admin SDK, and retrieve user's authoritative role from Firestore.
- [x] **Plan 2.2: Implement `/api/gas-proxy` with Role Allowlist**
  - Implement `/api/gas-proxy.js`:
    - Enforce role-based action allowlist:
      - `staff` / `accountant`: collection, sales, expenses, batchLoadData, getSpreadsheetTabUrl.
      - `admin`: soft deletes, updateSettings (business metadata only), restore, etc.
      - `superadmin`: all actions including clearTransactions, importBackupData.
    - Reject any request containing `sheetsIdMaster`, `sheetsIdCollection`, `sheetsIdCustomer`, or `sheetsIdExpense`.
    - Inject `APPS_SCRIPT_SECRET` into the payload and forward to `APPS_SCRIPT_URL`.
    - Filter response: ensure `getSettings` never leaks `WHATSAPP_TOKEN` or internal sheet IDs.
- [x] **Plan 2.3: Implement `/api/gemini` Proxy with Configurable Model**
  - Implement `/api/gemini.js`:
    - Authenticate caller via Firebase ID token (any active authenticated user).
    - Hold `GEMINI_API_KEY` securely in server environment.
    - Support a single configurable model name (e.g. `GEMINI_MODEL=gemini-2.0-flash`).
    - Forward chat generation and OCR multimodal prompts to Google Generative Language API.
- [x] **Plan 2.4: Implement `/api/users` Endpoint (Firebase Admin SDK)**
  - Implement `/api/users.js`:
    - Require `superadmin` role.
    - Use `admin.auth().createUser()` and `admin.auth().generatePasswordResetLink()`.
    - Create Firestore user profile under atomic transaction and write audit log.
- [x] **Plan 2.5: Harden Google Apps Script (`Code.gs`)**
  - Add secret verification at the entry of `doPost`: reject requests if `requestData.secret !== PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_SECRET")`.
  - Reject requests containing any sheet ID overrides (`sheetsIdMaster`, etc.).
  - Remove `MASTER_SHEET_ID_OVERRIDE` line.
  - In `getSettings` and `updateSettings`, strip `whatsappToken` handling completely (configured only via Script Properties).

---

### Phase 3: Database & Access Control Hardening (`firestore.rules` + Emulator Tests)
**Status:** 🔄 In Progress  
**Objective:** Lock down Cloud Firestore security rules with a deny-by-default architecture, fail-closed helpers, per-collection role authorization, data validation, audit log integrity, query/size limits, and comprehensive emulator test coverage.  
**Requirements:** SEC-10 (Fix email regex backdoor), SEC-11 (Prevent role self-mutation), SEC-12 (Protect settings), SEC-13 (Audit log integrity), SEC-14 (Emulator rules tests)

**Plans:**
- [x] **Task 3.1: Inventory.** Search the whole src folder for every Firestore read, write, listener and batch (collection and document paths, fields written, which role screen does it). Write a table in PROGRESS.md: collection, operation, who does it, which fields. Also list what the server (Admin SDK in /api) writes, because the Admin SDK bypasses rules.
- [x] **Task 3.2: Role matrix.** From the inventory and the proxy role map, propose a collection-by-role matrix (superadmin, admin, staff, accountant) for read, create, update, delete. Apply least privilege. Mark every permission you are unsure about under "DECISIONS FOR CHAITANYA" in PROGRESS.md, with the safer default applied.
- [ ] **Task 3.3: Rewrite firestore.rules from deny-by-default.** (match /{document=**} denies everything), with helper functions: signedIn, the user's profile read from users/{uid}, active == true, role is exactly one of the four known strings, isSuperAdmin, isAdmin, isStaff, isAccountant. Every helper must fail closed when the profile is missing or malformed.
- [ ] **Task 3.4: Users collection.** A user may read only their own document. Superadmin may read all. Clients may not create or delete users documents, and may not change role, active or email. Profile updates use an allowlist with request.resource.data.diff(resource.data).affectedKeys().hasOnly([...]). If the inventory shows no client write is needed, deny all client writes and let /api/users do it.
- [ ] **Task 3.5: Settings and secrets.** No client may write the settings document if it is now handled through the proxy. No client may read any secret-like field. Confirm nothing sensitive is stored in Firestore.
- [ ] **Task 3.6: Business collections (farmers, collections, customers, sales, expenses and any others found).** Apply the matrix. Validate data on create and update: required fields, correct types, string length limits, numeric ranges (litres, fat, SNF, rates and amounts cannot be negative or absurd), timestamps that cannot be set far in the future, and fields that cannot be changed after creation (ids, createdBy, createdAt). Deleting should be admin and above only, or denied if the app uses soft delete.
- [ ] **Task 3.7: Audit logs.** Create only when the logged userId equals request.auth.uid, with a fixed set of fields (ensuring actorRole matches the verified profile role from getUserData().role). Never update or delete. Read by admin and above only.
- [ ] **Task 3.8: Limits.** Block queries and writes that could be abused: no unbounded list for roles that do not need it, document size and array size limits in validation where relevant.
- [ ] **Task 3.9: Tests with @firebase/rules-unit-testing against the real firestore.rules file:** for every collection and every role, test allowed and denied read, create, update and delete; also signed-out access, inactive user, missing role, wrongly cased role, role escalation, email containing superadmin, forged audit log, and an update that touches a forbidden field. Generate the matrix tests from one table so nothing is forgotten.
- [ ] **Task 3.10: Check firestore.indexes.json and firebase.json:** rules and indexes paths are correct and the emulator config matches. Make sure every query used in the frontend has its index.
- [ ] **Task 3.11: Test the real app flows against the emulator** (login, first load, add collection, sale, expense, report load, settings view as each role) using the rules, and list any flow that is now denied. Fix the rules or the frontend (never weaken a rule just to make a test pass).
- [ ] **Task 3.12: In PROGRESS.md write the rollout plan:** how to deploy rules, how to roll back in one minute, and a manual smoke test for each role.

---

### Phase 4: Frontend Egress Refactor & Secret Decoupling
**Status:** ✅ Complete  
**Objective:** Refactor all frontend services to consume the new `/api/*` serverless routes. Strip all direct calls to external APIs and purge `VITE_` secrets. Deploy Firestore rules once complete.  
**Requirements:** SEC-15 (Refactor API client), SEC-16 (Refactor Gemini client), SEC-17 (Refactor User management), SEC-18 (Purge VITE_ secrets), SEC-19 (Deploy Firestore rules)

**Plans:**
- [x] **Plan 4.1: Refactor `src/utils/api.js` and `syncQueue.js`**
  - Direct all calls to `/api/gas-proxy` passing `Authorization: Bearer <idToken>`.
  - Remove client sheet ID passing and direct Apps Script URLs.
- [x] **Plan 4.2: Refactor `src/utils/gemini.js`**
  - Remove `import.meta.env.VITE_GEMINI_API_KEY`.
  - Point `callGeminiWithFallback` to `/api/gemini` with current user's Firebase auth token.
- [x] **Plan 4.3: Refactor `src/utils/superAdminService.js` and `SAUsers.jsx`**
  - Remove direct `identitytoolkit.googleapis.com` calls.
  - Call `/api/users` with current user's auth token for user creation and password resets.
- [x] **Plan 4.4: Clean Environment Variables & Verify Zero Bundle Leaks**
  - Remove `VITE_GEMINI_API_KEY`, `VITE_APPS_SCRIPT_URL` from `.env`.
  - Keep only non-sensitive public Firebase client configs (`VITE_FIREBASE_*`).
  - *Milestone Checkpoint:* Deploy updated `firestore.rules` now that frontend calls go through proxy.

---

### Phase 5: Secure File Import (`xlsx` Replacement)
**Status:** 🔄 In Progress  
**Objective:** Replace vulnerable `xlsx 0.18.5` with `papaparse` and `exceljs`. Enforce strict validation, row/size limits, lazy-loading, and formula rejection.  
**Requirements:** SEC-20 (Remove xlsx, install papaparse & exceljs), SEC-21 (Lazy-load parser), SEC-22 (Bilingual drop warnings for .xls/.ods), SEC-23 (File safety constraints & audit)

**Plans:**
- [x] **Task 5.1: Inventory all uses of `xlsx` across imports, exports, templates, backup/restore, and reports**
- [ ] **Task 5.2: Create unified `fileImport.js` with `papaparse` and lazy-loaded `exceljs`**
- [ ] **Task 5.3: Add pre-parsing safety limits (size, rows, cols, zip validation)**
- [ ] **Task 5.4: Strict row validation, Marathi text/numerals, and prototype pollution protection**
- [ ] **Task 5.5: Two-stage preview & dry run confirmation**
- [ ] **Task 5.6: Chunked proxy transmission via `apiClient`**
- [ ] **Task 5.7: Secure CSV/XLSX export refactor (UTF-8 BOM & formula injection prefixing)**
- [ ] **Task 5.8: Remove `xlsx` package and verify `npm audit`**
- [ ] **Task 5.9: Automated tests for file import, validation, security, and bundle chunk isolation**
- [ ] **Task 5.10: Mobile responsiveness (360px) and UI performance verification**

---

### Phase 6: Production Polish, UI/UX Parity & Verification
**Status:** 🔄 In Progress  
**Objective:** Finalize production metadata, security headers, clean documentation, package naming, lazy-loading, linting, and translation parity.  
**Requirements:** SEC-24 (Production assets & headers), SEC-25 (Package name & clean docs), SEC-26 (ESLint & chat lazy-load), SEC-27 (Translation parity test), SEC-28 (Final regression)

**Plans:**
- [x] **Task 6.1: Repository hygiene (Delete debug_call.js, scratch/, fix .gitignore, clean console.logs)**
- [ ] **Task 6.2: Project identity (Package naming, version, production README with architecture & env tables)**
- [ ] **Task 6.3: index.html and branding (Favicon in public/, OG tags, theme-color, lang attribute)**
- [ ] **Task 6.4: Vercel config & security headers (Rewrites, asset caching, HSTS, CSP report-only)**
- [ ] **Task 6.5: React Error Boundary & user-facing error handling**
- [ ] **Task 6.6: ESLint errors resolution (React hooks set-state-in-effect)**
- [ ] **Task 6.7: Performance & code-splitting (Lazy load chat, import, reports, charts)**
- [ ] **Task 6.8: Translation parity test & hardcoded string migration**
- [ ] **Task 6.9: Config cleanup (Centralize GEMINI_MODEL)**
- [ ] **Task 6.10: Dependency audit & unused package pruning**
- [ ] **Task 6.11: UI/UX parity check across resolutions (360px & 1280px)**
- [ ] **Task 6.12: Final self-audit & production go/no-go report**
