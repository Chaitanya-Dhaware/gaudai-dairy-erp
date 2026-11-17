import { authenticateRequest } from './_lib/auth.js';
import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';

const VALID_ROLES = ['staff', 'accountant', 'admin', 'superadmin'];

function genLogId() {
  return 'AL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

/**
 * Serverless User Management Endpoint (Superadmin Only)
 */
export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Strict Superadmin Authentication
  const authResult = await authenticateRequest(req, { requiredRoles: ['superadmin'] }, deps);
  if (authResult.error) {
    return res.status(authResult.error.status).json({ success: false, error: authResult.error.message });
  }

  const caller = authResult.user;
  const adminAuth = deps.auth || getAdminAuth();
  const adminDb = deps.db || getAdminDb();

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid request payload.' });
  }

  const { action } = body;

  // ─── ACTION: CREATE USER ──────────────────────────────────────────
  if (action === 'create') {
    const { email, name, role } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required.' });
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'User name is required.' });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    try {
      // 1. Create user in Firebase Authentication
      const userRecord = await adminAuth.createUser({
        email: email.trim().toLowerCase(),
        displayName: name.trim()
      });

      const uid = userRecord.uid;

      // 2. Generate password reset link for first-time access
      let resetLink = null;
      try {
        resetLink = await adminAuth.generatePasswordResetLink(email.trim().toLowerCase());
      } catch (linkErr) {
        console.warn('Could not generate password reset link:', linkErr.message);
      }

      // 3. Save profile to Cloud Firestore
      const now = new Date().toISOString();
      const profile = {
        uid,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        active: true,
        created_at: now,
        created_by: caller.uid
      };

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

      return res.status(200).json({
        success: true,
        data: profile,
        resetLink
      });
    } catch (err) {
      console.error('Create user error:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to create user.'
      });
    }
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
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    const before = userDoc.data();

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

    // Filter allowed updates
    const safeUpdates = {};
    if (updates.name && typeof updates.name === 'string') safeUpdates.name = updates.name.trim();
    if (updates.role && VALID_ROLES.includes(updates.role)) safeUpdates.role = updates.role;
    if (typeof updates.active === 'boolean') safeUpdates.active = updates.active;
    safeUpdates.updated_at = new Date().toISOString();
    safeUpdates.updated_by = caller.uid;

    await userRef.update(safeUpdates);

    // Write server audit log
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

    return res.status(200).json({ success: true, data: { ...before, ...safeUpdates } });
  }

  // ─── ACTION: LIST USERS ───────────────────────────────────────────
  if (action === 'list') {
    const snap = await adminDb.collection('users').get();
    const users = snap.docs.map(d => d.data());
    return res.status(200).json({ success: true, data: users });
  }

  return res.status(400).json({ success: false, error: `Unknown user management action: "${action}".` });
}
