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
   - `admin@test.local` / `testpassword123`
   - `staff@test.local` / `testpassword123`
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

## Available Scripts

- `npm run dev` — Starts local development server with Vite.
- `npm run build` — Compiles production bundle with code-splitting.
- `npm test` — Runs Vitest test suite.
- `npm run lint` — Runs ESLint across the codebase.
