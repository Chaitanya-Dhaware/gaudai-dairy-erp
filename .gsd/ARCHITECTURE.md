# Gaudai AI Dairy ERP - System Architecture

> Generated during security & architecture hardening discovery

## Overview

Gaudai AI Dairy ERP is a dairy operations management system designed for milk collection centers and dairy cooperatives. It is deployed as a single-page application (SPA) on Vercel with a hybrid backend architecture consisting of:
1. **Frontend:** React 19 + Vite + Tailwind CSS + Zustand + react-i18next (Marathi & English).
2. **Primary Cloud Database & Auth:** Firebase Authentication & Cloud Firestore.
3. **Secondary Storage & Spreadsheet Engine:** Google Apps Script (`Code.gs`) deployed as an unauthenticated Web App interfacing with 4 Google Sheets (Master, Collection, Customer, Expense).
4. **AI Intelligence Engine:** Google Gemini Generative Language API (calling `gemini-2.0-flash` / `gemini-1.5-flash` directly from the browser) for conversational query processing and milk slip camera OCR.
5. **Messaging:** Meta WhatsApp Cloud API (invoked via Google Apps Script) for transaction receipts and customer billing reminders.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Client Browser (React 19 SPA)                     │
│  - Zustand Store (appStore, chatStore)                                 │
│  - Views (Login, Dashboard, Collection, Customer, Expenses, SA)       │
│  - Offline Sync Queue (syncQueue.js) & IndexedDB/LocalCache (cache.js) │
└───────┬───────────────────┬───────────────────┬────────────────┬───────┘
        │                   │                   │                │
        │ Firebase SDK      │ Direct REST       │ Direct REST    │ Direct POST
        ▼                   ▼                   ▼                ▼
┌──────────────┐    ┌───────────────┐    ┌─────────────┐   ┌─────────────┐
│   Firebase   │    │ Google Gemini │    │  Firebase   │   │ Google Apps │
│  Auth & Fire-│    │  v1beta API   │    │  Auth REST  │   │   Script    │
│    store     │    │ (Conversations│    │  (Identity  │   │  (Code.gs)  │
│ (Users, Data)│    │   & OCR)      │    │   Toolkit)  │   │ (4 Sheets)  │
└──────────────┘    └───────────────┘    └─────────────┘   └──────┬──────┘
                                                                  │ UrlFetch
                                                                  ▼
                                                           ┌─────────────┐
                                                           │  WhatsApp   │
                                                           │  Cloud API  │
                                                           └─────────────┘
```

---

## Component Architecture

| Component | Location | Purpose & Pattern |
|-----------|----------|-------------------|
| **Auth & Routing** | `src/App.jsx`, `src/views/Login.jsx` | Firebase auth state listener + fallback bypass mode |
| **State Management** | `src/store/appStore.js`, `src/store/chatStore.js` | Zustand reactive stores with local offline caching |
| **Operational Views** | `src/views/CollectionWorkspace.jsx`, `CustomerWorkspace.jsx`, `ExpenseWorkspace.jsx`, `AccountsWorkspace.jsx` | Dairy workflow forms, tables, bill generators, analytics |
| **Super Admin Module** | `src/views/superadmin/*` (10 files), `src/utils/superAdminService.js` | Direct record editing, soft-delete trash recovery, audit log review, user management |
| **AI Assistant & OCR** | `src/components/chat/*`, `src/utils/gemini.js`, `src/utils/gaudaiAI.js` | Multi-turn dairy query parsing, spreadsheet schema inspection, slip OCR extraction |
| **Persistence Layer** | `src/utils/firestoreService.js`, `src/utils/api.js`, `src/utils/syncQueue.js` | Dual-write coordinator (Firestore + Google Apps Script) |
| **Google Apps Script Backend** | `google-apps-script/Code.gs` | Web App endpoint bridging HTTP requests to Google Sheets & WhatsApp |

---

## Secret & Key Inventory

| Secret / Key Name | Current Location(s) | How It Is Exposed | Risk Level |
|-------------------|---------------------|-------------------|------------|
| `VITE_GEMINI_API_KEY` | `.env`, `src/utils/gemini.js` (L1) | Bundled into client JS bundle via `import.meta.env`; sent in client fetch URL `?key=...` | **CRITICAL** |
| `VITE_FIREBASE_API_KEY` | `.env`, `src/utils/firebase.js`, `src/utils/superAdminService.js` (L18), `debug_call.js`, `scratch/*` | Bundled in client JS; used for user creation REST endpoints; committed in scratch scripts | **HIGH** |
| `VITE_APPS_SCRIPT_URL` | `.env`, `src/utils/api.js` (L7, L265, L579), `src/utils/firestoreService.js` (L15), `src/utils/syncQueue.js` (L150), `debug_call.js` (L2), `scratch/*` | Publicly exposed URL of unauthenticated Apps Script Web App | **CRITICAL** |
| `MASTER_SHEET_ID_OVERRIDE` | `google-apps-script/Code.gs` (L13), `debug_call.js` (L9), `scratch/*` | Committed directly in source repository | **HIGH** |
| `WHATSAPP_TOKEN` & `PHONE_ID` | `src/views/Settings.jsx` (L163), `src/views/superadmin/SASettings.jsx` (L26), `google-apps-script/Code.gs` (L2114) | Saved into Firestore `settings/general` doc; `firestore.rules` allows any signed-in user to read `settings/*` | **CRITICAL** |
| Demo Credentials | `src/views/Login.jsx` (L21-26) | Plaintext emails and passwords (`<DEMO_PASSWORD>`) bundled into client code | **CRITICAL** |

---

## Role Enforcement Matrix

### 1. Cloud Firestore Rules (`firestore.rules`)
- **`isSuperAdmin()`** (L15-18): Checks `getUserData().role == 'superadmin' || request.auth.token.email.matches('.*superadmin.*')`. *(Any user with "superadmin" anywhere in email gains root privilege)*.
- **`isAdmin()`** (L22-25): Checks `role in ['admin', 'superadmin']`.
- **`isStaff()`** (L28-31): Checks `role in ['staff', 'accountant', 'admin', 'superadmin']`.
- **`users/{userId}`** (L34-43): Read allowed if `request.auth.uid == userId || isSuperAdmin() || isAdmin()`. Create/Update allowed if `isSuperAdmin() || (isSignedIn() && request.auth.uid == userId)` *(A user can write `role: 'superadmin'` to their own record)*.
- **`audit_logs/{logId}`** (L46-55): Read by `isAdmin()`. Create allowed by **any** signed-in user (`isSignedIn()`).
- **`settings/{settingId}`** (L69-72): Read by **any** signed-in user (`isSignedIn()`); write by `isAdmin()`.
- **`farmers`, `collections`, `customers`, `sales`, `expenses`** (L75-109): Create by `isStaff()`; update/delete by `isAdmin()`.
- **`products`, `daily_spreadsheets`, `trash`, `sync_failures`**: Restricted to `isAdmin()`.

### 2. Google Apps Script Backend (`google-apps-script/Code.gs`)
- **Server Role Checks:** **NONE**.
- Zero authentication, zero session tokens, zero role checks.
- Any caller knowing or finding the Web App URL can execute every action, including `clearTransactions`, `deleteFarmer`, `importBackupData`, `updateSettings`, and `getSettings`.

### 3. Client Frontend UI
- `src/views/Login.jsx` (L43-57): Hardcoded fallback assigning `superadmin`, `admin`, `staff`, or `accountant` in client state if Firebase auth fails.
- `src/components/Sidebar.jsx` (L73, L95): UI visibility toggle for "Super Admin" and "Settings".
- `src/components/Layout.jsx` (L77): Settings dropdown toggle.
- `src/views/HomeDashboard.jsx` (L164-170): Feature card visibility based on `user?.role`.
- `src/views/superadmin/SuperAdminWorkspace.jsx` (L56): Access check for `superadmin` or `admin`.
- `src/utils/superAdminService.js`: `actorRole` is accepted as an argument and passed into `writeAuditLog`, but never validated against server claims.

---

## Data Egress Inventory (Every Way Data Leaves the Browser)

| Destination | Channel / Method | Data Transmitted | Trigger / Source File |
|-------------|------------------|------------------|-----------------------|
| **Google Apps Script Web App** (`APPS_SCRIPT_URL`) | HTTP POST (`fetch`) with JSON body | Milk entries, farmer records, customer balances, expenses, sales, system settings, spreadsheet IDs | `src/utils/api.js` (L18, L269, L579), `src/utils/syncQueue.js` (L160) |
| **Google Gemini API** (`generativelanguage.googleapis.com`) | HTTP POST (`fetch`) with API key in URL | Natural language queries, farmer/dairy business prompts, daily milk totals, base64 dairy receipt images for OCR | `src/utils/gemini.js` (L8) |
| **Firebase Auth REST API** (`identitytoolkit.googleapis.com`) | HTTP POST (`fetch`) with API key in URL | User emails, generated temporary passwords, password reset tokens | `src/utils/superAdminService.js` (L76, L103, L168) |
| **Cloud Firestore** (`firestore.googleapis.com`) | Firebase Web SDK (WebSocket / gRPC-Web / HTTPS) | User profiles, milk collections, customers, sales, expenses, audit logs, trash items, system settings | `src/utils/firestoreService.js`, `src/utils/superAdminService.js`, `src/store/appStore.js` |
| **Firebase Auth** | Firebase Web SDK | Login credentials (email, password), auth session tokens | `src/views/Login.jsx` (L38), `src/utils/firebase.js` |
| **Meta WhatsApp Cloud API** *(indirect via Apps Script)* | HTTP POST (`UrlFetchApp.fetch`) | Farmer phone numbers, milk collection receipts, quantities, payment dues | Triggered from Apps Script `sendWhatsAppReceipt` (L2110) upon collection save |
