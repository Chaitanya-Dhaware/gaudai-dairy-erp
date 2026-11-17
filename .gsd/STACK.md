# Technology Stack Inventory

> Generated during security & architecture hardening discovery

## Runtime & Hosting

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Frontend Host | Vercel | Production | Static SPA hosting & CDN distribution |
| Frontend Framework | React | 19.2.6 | Component UI |
| Build Tool | Vite | 8.0.12 | Modern bundler and dev server |
| Primary Backend / DB | Firebase (Firestore + Auth) | 12.13.0 | Real-time NoSQL database and user auth |
| Secondary Backend | Google Apps Script (V8) | Web App | Bridge to Google Sheets and WhatsApp Cloud API |
| AI / LLM Engine | Google Gemini API | v1beta | Generative conversational assistant & OCR |

---

## Dependencies & Vulnerability Analysis

### Critical / High Risk Dependencies

| Package | Installed Version | Known Issues / Advisories | Recommendation |
|---------|-------------------|---------------------------|----------------|
| `xlsx` | `^0.18.5` | Multiple critical CVEs (Prototype Pollution CVE-2023-30533, ReDoS, unmaintained on npm since SheetJS moved distribution off public npm) | Replace with safer modern alternative (e.g. `exceljs` or secure CSV parser) or lock down parsing. |
| `@vitejs/plugin-react` | `^6.0.1` | - | Standard |
| `firebase` | `^12.13.0` | - | Up to date, but client-side usage requires hardened Firestore security rules and backend proxy for admin tasks. |

### Core Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | `^5.0.13` | Global state management (`appStore`, `chatStore`) |
| `i18next`, `react-i18next` | `^26.2.0`, `^17.0.8` | Internationalization (Marathi `mr` & English `en`) |
| `recharts` | `^3.8.1` | Analytics charts in dashboards |
| `lucide-react` | `^1.16.0` | Application icons |
| `react-hot-toast` | `^2.6.0` | User feedback notifications |
| `react-hook-form` | `^7.76.1` | Form state and validation |
| `date-fns` | `^4.3.0` | Date manipulation and formatting |

---

## Configuration & Environment Variables

| Variable | Target Destination | Sensitivity | Exposure Vector |
|----------|--------------------|-------------|-----------------|
| `VITE_FIREBASE_API_KEY` | Firebase Auth & REST | Moderate | Bundled into client bundle |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase SDK | Public | Client bundle |
| `VITE_FIREBASE_PROJECT_ID` | Firebase SDK | Public | Client bundle |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase SDK | Public | Client bundle |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase SDK | Public | Client bundle |
| `VITE_FIREBASE_APP_ID` | Firebase SDK | Public | Client bundle |
| `VITE_GEMINI_API_KEY` | Generative Language API | **CRITICAL** | Bundled into client bundle; exposed via HTTP requests |
| `VITE_APPS_SCRIPT_URL` | Apps Script Web App | **CRITICAL** | Bundled into client bundle; unauthenticated target |
