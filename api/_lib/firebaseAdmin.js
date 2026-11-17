/* global process */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function getFirebaseAdmin() {
  const apps = getApps();
  if (apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && rawPrivateKey) {
      // Restore literal \n line breaks in private key
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    } else if (process.env.NODE_ENV !== 'test') {
      console.warn('Firebase Admin SDK: Service account credentials missing from environment.');
    }
  }

  return apps[0] || null;
}

export function getAdminAuth() {
  const app = getFirebaseAdmin();
  return app ? getAuth(app) : getAuth();
}

export function getAdminDb() {
  const app = getFirebaseAdmin();
  return app ? getFirestore(app) : getFirestore();
}
