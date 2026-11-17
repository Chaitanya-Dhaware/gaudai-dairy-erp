# Security Audit & Risk Assessment

> Audit Date: 2026-11-17 | Scope: Gaudai AI Dairy ERP

## Confirmed Vulnerabilities (Ranked by Severity)

### CRITICAL (Immediate Exploitation Risk / Full System Compromise)

1. **Unauthenticated Destructive Google Apps Script Endpoint (`Code.gs`)**
   - **Locations:** `google-apps-script/Code.gs` L272-322 (`doPost`), L281-285 (overriding `CONFIG.*_DB_ID` from body), L316 (`clearTransactions`), L310 (`importBackupData`), L307 (`batchLoadData`), L13 (`MASTER_SHEET_ID_OVERRIDE`).
   - **Vector:** The Web App is deployed with Access: "Anyone" and Execute as "Me". `doPost` has zero authentication or authorization. An attacker can POST `{ action: 'clearTransactions' }` to wipe spreadsheets, `{ action: 'importBackupData' }` to poison data, or supply custom `sheetsIdMaster` to hijack configuration.
   - **Data Egress & Leak:** `getSettings` returns sheet IDs, base rates, and WhatsApp tokens to any anonymous requester.

2. **Privilege Escalation & Backdoor in Firestore Rules (`firestore.rules`)**
   - **Locations:** `firestore.rules` L15-18, L39.
   - **Vectors:**
     - **Email Pattern Backdoor:** `request.auth.token.email.matches('.*superadmin.*')` grants full superadmin access to any user signing up with `superadmin` anywhere in their email (e.g., `attacker.superadmin@gmail.com`).
     - **Self-Promotion:** `match /users/{userId} { allow create, update: if isSuperAdmin() || (isSignedIn() && request.auth.uid == userId); }` allows any authenticated user to send a Firestore update modifying their own document to `{ role: 'superadmin' }`.

3. **Client-Side Authentication Bypass & Demo Credentials (`src/views/Login.jsx`)**
   - **Locations:** `src/views/Login.jsx` L21-26, L43-57, L184-195.
   - **Vector:** If Firebase authentication fails (or is unreachable), the frontend catches the error and checks if the email matches hardcoded demo profiles (`superadmin@gaudai.com`, `admin@gaudai.com`, etc. with password `password123`). If matched, it sets `role: 'superadmin'` directly in the client Zustand store and triggers `loadAllData()`.

4. **Bundled Gemini API Key & Direct Browser Calls (`src/utils/gemini.js`)**
   - **Locations:** `.env` L7, `src/utils/gemini.js` L1, L7.
   - **Vector:** `VITE_GEMINI_API_KEY` is baked into the public client JavaScript assets via Vite. Every request transmits the key in plaintext query string (`?key=${GEMINI_API_KEY}`). Anyone inspecting network traffic or the production bundle can extract the key, incur LLM billing costs, or exhaust API quotas.

5. **Exposed WhatsApp API Credentials in Firestore (`settings/general`)**
   - **Locations:** `firestore.rules` L69-72, `src/views/Settings.jsx` L163-164, `src/views/superadmin/SASettings.jsx` L26-27, `src/store/appStore.js` L37-38.
   - **Vector:** The WhatsApp Cloud API permanent/system access token and phone number ID are stored in the Firestore `settings/general` document. `firestore.rules` specifies `allow read: if isSignedIn();`. Any authenticated user (including low-privileged staff or an attacker with self-registered account) can read the WhatsApp bearer token.

---

### HIGH (Integrity Violation & Data Tampering)

6. **Committed Secrets and Live Script URLs in Repository**
   - **Locations:** `debug_call.js` L2, L9; `scratch/` (13 files including `execute_gaudai_import.js`, `test_gas.js`, `test_clear.js`); `clear_transactions_once.js`; `google-apps-script/Code.gs` L13.
   - **Vector:** Live Apps Script deployment URLs (`...AKfycbzK...` and `...AKfycbwq...`), Google Spreadsheet IDs (`1UJ3bGyH...`, `1pqKxGdef...`), and Firebase configs are committed in Git history and present on the filesystem.

7. **Client-Side User Creation via Firebase Auth REST API**
   - **Locations:** `src/utils/superAdminService.js` L72-123.
   - **Vector:** Users are created directly from the browser using `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}` with auto-generated temporary passwords. Because this logic executes in client-side JavaScript, client-side safeguards (like checking if the actor is superadmin) are completely bypassed if called directly or modified.

8. **Tamperable & Unvalidated Audit Logs (`audit_logs`)**
   - **Locations:** `firestore.rules` L46-55, `src/utils/superAdminService.js` L29-45.
   - **Vector:** `firestore.rules` allows `allow create: if isSignedIn();` with zero field validation. Any signed-in user can forge audit log records, spoof `actorRole: 'superadmin'`, forge `action`, fabricate timestamps, or spam log entries.

9. **Client-Only Role Enforcement**
   - **Locations:** `src/views/HomeDashboard.jsx` L164-170, `src/components/Sidebar.jsx` L73, `src/views/superadmin/SuperAdminWorkspace.jsx` L56.
   - **Vector:** Navigation and view access are controlled purely by checking `user?.role` in React state. Because `Code.gs` has no role checks and `firestore.rules` has the privilege escalation flaws noted above, UI hiding provides zero real security boundaries.

---

### MEDIUM (Vulnerable Dependencies)

10. **Critical Vulnerabilities in `xlsx` 0.18.5**
    - **Locations:** `package.json` L26 (`"xlsx": "^0.18.5"`), `src/utils/bulkImportService.js`.
    - **Vector:** Public CVEs exist for `xlsx <= 0.19.3` including Prototype Pollution (CVE-2023-30533) and ReDoS. When parsing untrusted CSV/Excel uploads from customers or staff, malformed files can compromise the execution context.
