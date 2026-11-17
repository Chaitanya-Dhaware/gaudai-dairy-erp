# Gaudai AI Dairy ERP

Production-ready dairy management and ERP application built with React 19, Vite, Tailwind CSS, Firebase Authentication, Cloud Firestore, and Google Apps Script.

---

## Security Model & Authentication

All demo login fallbacks, hardcoded user credentials, and client bypasses have been permanently removed from the application. 

Every user session must be authenticated through Firebase Authentication:
- Users must sign in with a registered email and password.
- User authorization and roles (`superadmin`, `admin`, `staff`, `accountant`) are authoritatively stored in Cloud Firestore (`users/{uid}`). Serverless proxy functions enforce role checks and secret containment. Note that direct legacy Google Apps Script endpoints are being protected with shared secrets and role-checked proxies in the hardening roadmap.

---

## Local Development & Testing with Firebase Emulators

For local testing without connecting to live production Firebase services, use the **Firebase Emulator Suite**.

### 1. Prerequisites
Install the Firebase CLI tools globally (requires Node.js):
```bash
npm install -g firebase-tools
```

### 2. Start the Emulators
From the project root directory, run:
```bash
firebase emulators:start --only auth,firestore
```
This starts:
- **Authentication Emulator:** `http://127.0.0.1:9099`
- **Firestore Emulator:** `http://127.0.0.1:8080`
- **Emulator UI:** `http://localhost:4000`

### 3. Configure the Frontend to Use the Emulator
In your local environment file (`.env.local` or `.env`):
```env
VITE_USE_FIREBASE_EMULATOR=true
```

When set to `true`, the application automatically points Firebase Auth and Firestore to the local emulator ports.

### 4. Create Local Test Users
1. Open the Emulator UI at `http://localhost:4000/auth`.
2. Click **Add User** and create test accounts:
   - `admin@test.local` / `test_password_local`
   - `staff@test.local` / `test_password_local`
3. In the Firestore tab (`http://localhost:4000/firestore`), create corresponding documents under `users/{uid}`:
   ```json
   {
     "uid": "<USER_UID_FROM_AUTH>",
     "email": "admin@test.local",
     "name": "Local Admin",
     "role": "admin",
     "active": true
   }
   ```
4. Start the frontend dev server:
   ```bash
   npm run dev
   ```
5. Log in at `http://localhost:5173` using your created emulator credentials.

---

## Environment Variables & Architecture

### Client-Side Configuration (Public)
The browser client requires only public Firebase project identifiers:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_USE_FIREBASE_EMULATOR` (dev only)

**Security Rule:** No secret, private key, or backend API token may ever use the `VITE_` prefix. Any variable with `VITE_` is baked into the browser bundle.

### Server-Side Secrets (Vercel Serverless `/api/*`)
All backend secrets are stored exclusively server-side in Vercel environment variables:
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Firebase Admin SDK)
- `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` (Google Apps Script shared secret proxy)
- `GEMINI_API_KEY`, `GEMINI_MODEL` (Google AI Studio)
- `WHATSAPP_TOKEN` (Meta WhatsApp Cloud API)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (Optional distributed rate limiting)

### Running Full-Stack Locally
Because `npm run dev` serves only Vite frontend assets and does not execute `/api/*` serverless functions:
- To run frontend-only against mock database or Firestore: `npm run dev`
- To run full-stack including `/api/*` serverless functions locally:
  ```bash
  npm install -g vercel
  vercel dev
  ```

---

## Available Scripts

- `npm run dev` — Starts local development server with Vite.
- `npm run build` — Compiles production bundle with code-splitting.
- `npm test` — Runs Vitest test suite.
- `npm run lint` — Runs ESLint across the codebase.
