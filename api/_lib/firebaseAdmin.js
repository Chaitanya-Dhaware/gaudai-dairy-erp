/* global process */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim()
  );
}

export function getFirebaseAdmin() {
  const apps = getApps();
  if (apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

    if (projectId && clientEmail && rawPrivateKey) {
      try {
        // Strip optional surrounding quotes and restore literal \n line breaks
        const normalizedKey = rawPrivateKey
          .replace(/^["']|["']$/g, '')
          .replace(/\\n/g, '\n');

        return initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: normalizedKey
          })
        });
      } catch (err) {
        console.error('Firebase Admin SDK initialization failed:', err.message);
        return null;
      }
    } else if (process.env.NODE_ENV !== 'test') {
      console.warn('Firebase Admin SDK: Service account credentials missing from environment.');
    }
  }

  return apps[0] || null;
}

export function getAdminAuth() {
  const app = getFirebaseAdmin();
  if (!app) {
    const err = new Error('Missing server configuration: Firebase Admin SDK credentials are not configured.');
    err.code = 'admin/not-configured';
    throw err;
  }
  return getAuth(app);
}

export function getAdminDb() {
  const app = getFirebaseAdmin();
  if (!app) {
    const err = new Error('Missing server configuration: Firebase Admin SDK credentials are not configured.');
    err.code = 'admin/not-configured';
    throw err;
  }
  return getFirestore(app);
}
