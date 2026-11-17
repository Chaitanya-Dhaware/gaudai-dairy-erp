# Gaudai AI Dairy ERP - Hardening & Production Readiness Progress

> **CRITICAL SECURITY RULE:**
> Never write a real credential, key, token, spreadsheet ID, project ID, or URL into any file. Use placeholders only (`<OLD_GEMINI_KEY>`, `<MASTER_SHEET_ID>`, `<APPS_SCRIPT_URL>`, `<FIREBASE_API_KEY>`, etc.).

---

## Progress Tracker

| Phase | Description | Status |
|:---:|---|:---:|
| **Phase 1** | Authentication & Client Lockdown (Remove Demo Bypass, Add Tests, Auth Emulator Docs) | ✅ Complete |
| **Phase 2** | Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth in `Code.gs` | ⬜ Not Started |
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

### Notes for Next Iteration (Phase 2)
- **Scope for Next Iteration:** Phase 2: Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth in `Code.gs`.
- **Known Pre-existing Issues:** Legacy ESLint warnings in untouched files (`scratch/*`, `src/views/superadmin/*`) are tracked for cleanup in Phase 6.

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
- [ ] **Set Script Properties First:**
  - In Apps Script editor -> **Project Settings > Script Properties**, set:
    - `APPS_SCRIPT_SECRET` = `<GENERATE_32_CHAR_RANDOM_SECRET>`
    - `MASTER_DB_ID` = `<PRODUCTION_MASTER_SHEET_ID>`
    - `COLLECTION_DB_ID` = `<PRODUCTION_COLLECTION_SHEET_ID>`
    - `CUSTOMER_DB_ID` = `<PRODUCTION_CUSTOMER_SHEET_ID>`
    - `EXPENSE_DB_ID` = `<PRODUCTION_EXPENSE_SHEET_ID>`
    - `WHATSAPP_TOKEN` = `<ROTATED_WHATSAPP_TOKEN>`
    - `WHATSAPP_PHONE_ID` = `<WHATSAPP_PHONE_ID>`
- [ ] **Deploy and Archive Old Deployment:**
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
