import { authenticateRequest } from './_lib/auth.js';
import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';

const VALID_ROLES = ['staff', 'accountant', 'admin', 'superadmin'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genLogId() {
  return 'AL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

function mapAuthError(err, fallbackMessage) {
  const code = err?.code || '';
  if (code === 'auth/email-already-exists') {
    return { status: 409, message: 'Email already registered.' };
  }
  if (code === 'auth/invalid-email') {
    return { status: 400, message: 'Invalid email address.' };
  }
  if (code === 'auth/user-not-found') {
    return { status: 404, message: 'Target user not found in authentication service.' };
  }
  if (code === 'admin/not-configured') {
    return { status: 503, message: 'Missing server configuration: Firebase Admin SDK credentials are not configured.' };
  }
  if (code === 'app/invalid-credential' || code === 'auth/internal-error' || code === 'auth/network-request-failed') {
    return { status: 503, message: 'Authentication service unavailable.' };
  }
  return { status: 400, message: fallbackMessage };
}

/**
 * Serverless User Management Endpoint (Superadmin Only)
 */
export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // 1. Strict Superadmin Authentication
    const authResult = await authenticateRequest(req, { requiredRoles: ['superadmin'] }, deps);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ success: false, error: authResult.error.message });
    }

    const caller = authResult.user;

    let adminAuth;
    let adminDb;
    try {
      adminAuth = deps.auth || getAdminAuth();
      adminDb = deps.db || getAdminDb();
    } catch (err) {
      console.error('Firebase Admin unavailable in users handler:', err.code || err.message);
      return res.status(503).json({
        success: false,
        error: 'Missing server configuration: Firebase Admin SDK credentials are not configured.'
      });
    }

    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid request payload.' });
    }

    const { action } = body;

    // ─── ACTION: CREATE USER ──────────────────────────────────────────
    if (action === 'create') {
      const { email, name, role } = body;

      if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ success: false, error: 'Invalid email address.' });
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'User name is required.' });
      }
      if (!role || !VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      // 1. Create user in Firebase Authentication
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: normalizedEmail,
          displayName: trimmedName
        });
      } catch (err) {
        console.error('Create user Auth error:', err.code || 'unknown', err.message);
        const mapped = mapAuthError(err, 'Failed to create user in authentication service.');
        return res.status(mapped.status).json({ success: false, error: mapped.message });
      }

      const uid = userRecord.uid;

      // 2. Generate password reset link for initial credential setup.
      // SECURITY CONTRACT:
      // - resetLink is returned ONLY in the HTTPS response body to the authenticated Superadmin caller.
      // - It is NEVER logged in console/server logs.
      // - It is NEVER stored in Firestore (neither in users/{uid} nor audit_logs).
      let resetLink = null;
      try {
        resetLink = await adminAuth.generatePasswordResetLink(normalizedEmail);
      } catch (err) {
        console.warn('Password reset link generation warning:', err.code || err.message);
      }

      // 3. Save profile to Cloud Firestore (rollback Auth user if DB fails)
      const now = new Date().toISOString();
      const profile = {
        uid,
        email: normalizedEmail,
        name: trimmedName,
        role,
        active: true,
        created_at: now,
        created_by: caller.uid
      };

      try {
        await adminDb.collection('users').doc(uid).set(profile);

        // 4. Record immutable audit log entry on server with verified caller UID
        const logId = genLogId();
        await adminDb.collection('audit_logs').doc(logId).set({
          log_id: logId,
          userId: caller.uid,
          actor: caller.uid,
          actorRole: caller.role,
          action: 'CREATE_USER',
          module: 'users',
          recordId: uid,
          before: null,
          after: profile,
          reason: 'Super Admin created user',
          timestamp: now
        });
      } catch (dbErr) {
        console.error('Create user Firestore error:', dbErr.code || 'unknown', dbErr.message);
        if (typeof adminAuth.deleteUser === 'function') {
          await adminAuth.deleteUser(uid).catch((rollbackErr) => {
            console.error('Failed to rollback Auth user after DB error:', rollbackErr.message);
          });
        }
        return res.status(503).json({
          success: false,
          error: 'Database update failed. User creation was rolled back.'
        });
      }

      return res.status(200).json({
        success: true,
        data: profile,
        resetLink
      });
    }

    // ─── ACTION: UPDATE USER ──────────────────────────────────────────
    if (action === 'update') {
      const { uid, updates } = body;

      if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ success: false, error: 'Target user UID is required.' });
      }
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, error: 'Updates payload is required.' });
      }

      const userRef = adminDb.collection('users').doc(uid);
      let userDoc;
      try {
        userDoc = await userRef.get();
      } catch (dbErr) {
        console.error('Update user Firestore read error:', dbErr.code || 'unknown', dbErr.message);
        return res.status(503).json({ success: false, error: 'Database read failed.' });
      }

      if (!userDoc.exists) {
        return res.status(404).json({ success: false, error: 'Target user not found.' });
      }

      const before = userDoc.data();

      // Validate incoming update fields
      if (updates.email !== undefined) {
        if (typeof updates.email !== 'string' || !EMAIL_REGEX.test(updates.email.trim())) {
          return res.status(400).json({ success: false, error: 'Invalid email address.' });
        }
      }
      if (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim())) {
        return res.status(400).json({ success: false, error: 'User name cannot be empty.' });
      }
      if (updates.role !== undefined && !VALID_ROLES.includes(updates.role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
        });
      }

      // Guard: Prevent demoting or deactivating the last active superadmin
      const isDemotingRole = updates.role && updates.role !== 'superadmin';
      const isDeactivating = updates.active === false;

      if (before.role === 'superadmin' && (isDemotingRole || isDeactivating)) {
        const activeSuperadminsSnap = await adminDb
          .collection('users')
          .where('role', '==', 'superadmin')
          .where('active', '==', true)
          .get();

        const activeSuperadmins = activeSuperadminsSnap.docs.filter(d => d.id === uid || d.data().active !== false);
        if (activeSuperadmins.length <= 1) {
          return res.status(400).json({
            success: false,
            error: 'Cannot demote or deactivate the last active Super Admin.'
          });
        }
      }

      // Build sanitized Firestore & Firebase Auth updates
      const safeUpdates = {};
      const authUpdates = {};

      if (updates.name && typeof updates.name === 'string') {
        const trimmedName = updates.name.trim();
        safeUpdates.name = trimmedName;
        if (trimmedName !== before.name) {
          authUpdates.displayName = trimmedName;
        }
      }
      if (updates.email && typeof updates.email === 'string') {
        const normalizedEmail = updates.email.trim().toLowerCase();
        if (normalizedEmail !== (before.email || '').toLowerCase()) {
          safeUpdates.email = normalizedEmail;
          authUpdates.email = normalizedEmail;
        }
      }
      if (updates.role && VALID_ROLES.includes(updates.role)) {
        safeUpdates.role = updates.role;
      }
      if (typeof updates.active === 'boolean') {
        safeUpdates.active = updates.active;
        authUpdates.disabled = !updates.active;
      }

      safeUpdates.updated_at = new Date().toISOString();
      safeUpdates.updated_by = caller.uid;

      // 1. Synchronize Firebase Authentication record when Auth-backed fields changed
      if (Object.keys(authUpdates).length > 0 && typeof adminAuth.updateUser === 'function') {
        try {
          await adminAuth.updateUser(uid, authUpdates);
        } catch (authErr) {
          console.error('Update user Auth error:', authErr.code || 'unknown', authErr.message);
          const mapped = mapAuthError(authErr, 'Failed to update user in authentication service.');
          return res.status(mapped.status).json({ success: false, error: mapped.message });
        }
      }

      // 2. Persist profile changes in Firestore and write server audit log
      try {
        await userRef.update(safeUpdates);

        const logId = genLogId();
        await adminDb.collection('audit_logs').doc(logId).set({
          log_id: logId,
          userId: caller.uid,
          actor: caller.uid,
          actorRole: caller.role,
          action: 'UPDATE_USER',
          module: 'users',
          recordId: uid,
          before,
          after: { ...before, ...safeUpdates },
          reason: updates._reason || 'Super Admin updated user',
          timestamp: new Date().toISOString()
        });
      } catch (dbErr) {
        console.error('Update user Firestore error:', dbErr.code || 'unknown', dbErr.message);
        return res.status(503).json({
          success: false,
          error: 'Database update failed.'
        });
      }

      return res.status(200).json({ success: true, data: { ...before, ...safeUpdates } });
    }

    // ─── ACTION: LIST USERS ───────────────────────────────────────────
    if (action === 'list') {
      try {
        const snap = await adminDb.collection('users').get();
        const users = snap.docs.map(d => d.data());
        return res.status(200).json({ success: true, data: users });
      } catch (err) {
        console.error('List users error in users handler:', err.message);
        return res.status(503).json({ success: false, error: 'Failed to retrieve users from database.' });
      }
    }

    return res.status(400).json({ success: false, error: `Unknown user management action: "${action}".` });
  } catch (err) {
    console.error('Unhandled error in user handler:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
