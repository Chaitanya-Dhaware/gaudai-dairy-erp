---
updated: 2026-11-17T18:51:10+05:30
---

# Project State

## Current Position

**Milestone:** Production Hardening & Security Remediation  
**Phase:** Phase 2 - Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth  
**Status:** Phase 1 Complete, Ready for Phase 2  
**Plan:** Plan 2.1 (Serverless Middleware & Firebase Admin Auth Helper)

## Last Action

- **Executed Phase 1: Authentication & Client Lockdown**:
  - Removed `demo user profiles` array, quick-click demo buttons, and demo fallback catch block in `src/views/Login.jsx`.
  - Removed silent `signInWithEmailAndPassword(auth, ..., '<DEMO_PASSWORD>')` demo fallback from `src/store/appStore.js`.
  - Added automated tests in `src/views/Login.test.js` validating auth failure isolation and forged localStorage clearing.
  - Added `firebase.json` and documented Firebase Auth/Firestore Emulator setup in `README.md`.
  - Cleaned all hardcoded keys and URLs across repository; verified `git grep` secret scanner produces 0 results.
  - Successfully ran `coderabbit review --uncommitted` with 0 unresolved findings.
  - All 25 vitest tests passing; production Vite build passing.

## Next Steps

1. Begin **Phase 2: Secure Serverless Backend Proxy (`/api/*`) & Defense-in-Depth in `Code.gs`**:
   - Create `/api/_lib/firebaseAdmin.js` and `/api/_lib/authMiddleware.js`.
   - Implement `/api/gas-proxy.js` with role-based action allowlist.
   - Implement `/api/gemini.js` for secure server-side chat and OCR.
   - Implement `/api/users.js` for superadmin user creation via Admin SDK.
   - Harden `Code.gs` with shared secret verification and locked sheet IDs.

## Active Decisions

| Decision | Choice | Made | Affects |
|----------|--------|------|---------|
| Backend API Layer | Vercel Serverless Functions (`/api/*`) with Firebase Admin SDK | 2026-11-17 | Phase 2, Phase 4 |
| Apps Script Security | Shared secret in request payload (`requestData.secret`), lock sheet IDs in Script Properties | 2026-11-17 | Phase 2 |
| Demo Credentials | Completely remove demo users & fallback; document Auth Emulator in README | 2026-11-17 | Phase 1 (Done) |
| Excel / CSV Parsing | Replace `xlsx` with `papaparse` (CSV) and `exceljs` (XLSX), lazy-load on import view | 2026-11-17 | Phase 5 |
| Spreadsheet IDs | Reject `sheetsIdMaster`, etc. from client; remove `MASTER_SHEET_ID_OVERRIDE` | 2026-11-17 | Phase 2 |
| Secrets Location | Server-side env vars only (no `VITE_` prefix for secrets) | 2026-11-17 | Phase 2, Phase 4 |
| Firestore Rules Order | Deploy rules only AFTER Phase 4 completes | 2026-11-17 | Phase 3, Phase 4 |
