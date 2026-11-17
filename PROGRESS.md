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

### Completed Tasks
1. **Purged Demo Backdoor from Login View:**
   - Completely removed `demoUsers` array, quick demo profile selector buttons, and catch fallback in [`src/views/Login.jsx`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/views/Login.jsx).
   - Preserved all user-facing UI designs and error notifications in Marathi and English.
2. **Removed Silent Re-Auth Backdoor in Store:**
   - Removed the silent `signInWithEmailAndPassword(auth, ..., 'password123')` demo fallback from [`src/store/appStore.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/store/appStore.js). Unauthenticated state strictly clears localStorage and sets user state to `null`.
3. **Automated Auth Isolation Tests:**
   - Created [`src/views/Login.test.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/views/Login.test.js) (3 passing tests):
     - Proves failed Firebase sign-in never sets a user in `appStore`.
     - Proves demo credentials with failed sign-in cannot grant a session.
     - Proves unauthenticated state purges forged `localStorage` sessions.
4. **Firebase Auth Emulator Documentation & Setup:**
   - Created [`firebase.json`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/firebase.json) configuring Auth (`9099`), Firestore (`8080`), and Emulator UI (`4000`).
   - Added emulator connectivity logic to [`src/utils/firebase.js`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/src/utils/firebase.js) activated via `VITE_USE_FIREBASE_EMULATOR=true`.
   - Documented step-by-step local testing instructions in [`README.md`](file:///c:/Users/chait/OneDrive/Documents/AI%20assisted%20dairy%20management%20system/README.md).
5. **Secret Sanitization:**
   - Replaced all exposed keys, tokens, spreadsheet IDs, and script URLs across repository files with placeholders.
   - Re-compressed `gaudai-logo.png` at level 9 (lossless); `git grep -nE "AQ\.|AIza|EAA|script\.google\.com/macros"` returns 0 results.
6. **Code Review & Quality Gate:**
   - CodeRabbit review executed with 0 remaining findings.
   - Full Vitest suite passing (4 test files, 25 tests passed). Production Vite build succeeding.

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
  - Delete or reset the passwords for demo accounts (`superadmin@gaudai.com`, `admin@gaudai.com`, `staff@gaudai.com`, `accountant@gaudai.com`).
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

### 4. Firestore Security Rules Deployment Scheduling
- [ ] **Deploy Rules ONLY After Phase 4 Completes:**
  - Do NOT deploy the hardened `firestore.rules` until Phase 4 (Frontend Refactor) is fully merged and deployed. Deploying earlier will break the existing frontend before the serverless proxy is live.
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
