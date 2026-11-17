import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof globalThis.process !== 'undefined' && globalThis.process.env ? globalThis.process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "<FIREBASE_API_KEY>",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "<FIREBASE_AUTH_DOMAIN>",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "<FIREBASE_PROJECT_ID>",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "<FIREBASE_STORAGE_BUCKET>",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "<FIREBASE_MESSAGING_SENDER_ID>",
  appId: env.VITE_FIREBASE_APP_ID || "<FIREBASE_APP_ID>"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to local Firebase Emulators when explicitly enabled
if (env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Enable Firestore offline persistence via IndexedDB.
// On subsequent visits, reads are served from local cache instantly
// while Firestore syncs in the background.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence can only be enabled in one tab at a time
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // Current browser doesn't support persistence
    console.warn('Firestore persistence not supported in this browser');
  }
});

export default app;
