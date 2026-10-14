/**
 * superAdminService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All Super Admin Firestore operations: edit, soft-delete, trash, restore,
 * audit logging, user management (via Firebase Auth REST), sync status, etc.
 *
 * Security: every mutation writes an immutable audit_log entry.
 * Soft deletes move documents to trash/ collection — not permanent until purged.
 */

import { db, auth } from './firebase';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, writeBatch, query, orderBy, limit, where
} from 'firebase/firestore';

const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY    = import.meta.env.VITE_FIREBASE_API_KEY;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString(); }
function genId(prefix = 'ID') { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }

/**
 * Write an immutable audit log entry to Firestore.
 * Call this after every privileged or destructive operation.
 */
export async function writeAuditLog({ actor, actorRole, action, module, recordId, before = null, after = null, reason = '', result = 'success' }) {
  try {
    const logId = genId('AL');
    await setDoc(doc(db, 'audit_logs', logId), {
      log_id: logId,
      actor,
      actorRole,
      action,
      module,
      recordId: recordId || '',
      before: before ? JSON.stringify(before).substring(0, 3000) : null,
      after:  after  ? JSON.stringify(after).substring(0, 3000)  : null,
      reason,
      result,
      timestamp: nowISO()
    });
  } catch (e) {
    // Audit log failure must never block the main operation
    console.error('Audit log write failed:', e);
  }
}

// ─── USER MANAGEMENT ────────────────────────────────────────────────────────

/**
 * Load all user profile documents from `users/` collection.
 */
export async function loadAllUsers() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, data: users };
  } catch (err) {
    console.error('loadAllUsers error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new user via Firebase Auth REST API.
 * Immediately sends a password-reset email so the user sets their own password.
 * Writes the user profile to Firestore `users/{uid}`.
 */
export async function createUser({ email, name, role }, actorUid, actorRole) {
  try {
    // 1. Create Firebase Auth account with a random strong temp password
    const tempPassword = `Temp_${Math.random().toString(36).slice(2,10)}!`;
    const createRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: tempPassword, returnSecureToken: false })
      }
    );
    const createData = await createRes.json();
    if (!createRes.ok || createData.error) {
      return { success: false, error: createData.error?.message || 'Firebase Auth create failed' };
    }
    const uid = createData.localId;

    // 2. Write user profile to Firestore
    const profile = {
      uid,
      email,
      name,
      role,
      active: true,
      created_at: nowISO(),
      created_by: actorUid
    };
    await setDoc(doc(db, 'users', uid), profile);

    // 3. Send password reset email via REST API
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
      }
    );

    await writeAuditLog({
      actor: actorUid, actorRole,
      action: 'CREATE_USER', module: 'users', recordId: uid,
      before: null, after: profile, reason: 'Super Admin created user'
    });

    return { success: true, data: profile };
  } catch (err) {
    console.error('createUser error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update a user's profile (name, role, active) in Firestore.
 * Prevents demotion of the last superadmin.
 */
export async function updateUser(uid, updates, actorUid, actorRole) {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return { success: false, error: 'User not found' };
    const before = snap.data();

    // Guard: cannot demote or deactivate the last superadmin
    if ((updates.role && updates.role !== 'superadmin') || updates.active === false) {
      if (before.role === 'superadmin') {
        const allSnap = await getDocs(collection(db, 'users'));
        const superadmins = allSnap.docs.filter(d => d.data().role === 'superadmin' && d.data().active !== false);
        if (superadmins.length <= 1 && superadmins[0]?.id === uid) {
          return { success: false, error: 'Cannot demote or deactivate the last active Super Admin.' };
        }
      }
    }

    const after = { ...before, ...updates, updated_at: nowISO(), updated_by: actorUid };
    await updateDoc(userRef, { ...updates, updated_at: nowISO(), updated_by: actorUid });

    await writeAuditLog({
      actor: actorUid, actorRole,
      action: 'UPDATE_USER', module: 'users', recordId: uid,
      before, after, reason: updates._reason || 'Super Admin updated user profile'
    });

    return { success: true, data: after };
  } catch (err) {
    console.error('updateUser error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send a password reset email to a user.
 */
export async function resetUserPassword(email, actorUid, actorRole) {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
      }
    );
    const data = await res.json();
    if (!res.ok || data.error) return { success: false, error: data.error?.message || 'Failed' };

    await writeAuditLog({
      actor: actorUid, actorRole,
      action: 'RESET_PASSWORD', module: 'users', recordId: email,
      before: null, after: null, reason: 'Super Admin triggered password reset'
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── FARMER MANAGEMENT ──────────────────────────────────────────────────────

/**
 * Update a farmer's profile — all fields supported.
 */
export async function updateFarmer(farmerId, updates, actorUid, actorRole) {
  try {
    const ref = doc(db, 'farmers', farmerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Farmer not found' };
    const before = snap.data();
    const after = { ...before, ...updates, updated_at: nowISO(), updated_by: actorUid };
    await updateDoc(ref, { ...updates, updated_at: nowISO(), updated_by: actorUid });

    await writeAuditLog({ actor: actorUid, actorRole, action: 'UPDATE_FARMER', module: 'farmers', recordId: farmerId, before, after, reason: updates._reason || '' });
    return { success: true, data: after };
  } catch (err) {
    console.error('updateFarmer error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Soft-delete a farmer: moves record to `trash` collection.
 */
export async function softDeleteFarmer(farmerId, reason, actorUid, actorRole) {
  try {
    const ref = doc(db, 'farmers', farmerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Farmer not found' };
    const before = snap.data();

    const batch = writeBatch(db);
    batch.set(doc(db, 'trash', `farmers_${farmerId}`), {
      ...before,
      _collection: 'farmers',
      _deleted_at: nowISO(),
      _deleted_by: actorUid,
      _reason: reason
    });
    batch.delete(ref);
    await batch.commit();

    await writeAuditLog({ actor: actorUid, actorRole, action: 'SOFT_DELETE_FARMER', module: 'farmers', recordId: farmerId, before, after: null, reason });
    return { success: true };
  } catch (err) {
    console.error('softDeleteFarmer error:', err);
    return { success: false, error: err.message };
  }
}

// ─── COLLECTION MANAGEMENT ──────────────────────────────────────────────────

/**
 * Update a milk collection entry.
 * Recalculates total_amount, due_amount if quantity/fat/rate changes.
 */
export async function updateCollection(entryId, updates, settings, actorUid, actorRole) {
  try {
    const ref = doc(db, 'collections', entryId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Collection entry not found' };
    const before = snap.data();

    // Recalculate if financial fields changed
    let recalculated = { ...updates };
    const q = updates.quantity !== undefined ? parseFloat(updates.quantity) : before.quantity;
    const f = updates.fat !== undefined ? parseFloat(updates.fat) : before.fat;
    const rate = f * (settings?.baseRate || 8.5);
    const totalAmount = rate * q;
    const paidAmount = updates.paid_amount !== undefined ? parseFloat(updates.paid_amount) : before.paid_amount;
    const dueAmount = Math.max(0, totalAmount - paidAmount);

    recalculated = {
      ...recalculated,
      calculated_rate: rate,
      total_amount: totalAmount,
      due_amount: dueAmount,
      status: dueAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending'),
      updated_at: nowISO(),
      updated_by: actorUid
    };

    // Update farmer due delta
    const dueDelta = dueAmount - (before.due_amount || 0);
    const batch = writeBatch(db);
    batch.update(ref, recalculated);
    if (dueDelta !== 0) {
      const farmerRef = doc(db, 'farmers', before.farmer_id);
      const farmerSnap = await getDoc(farmerRef);
      if (farmerSnap.exists()) {
        const newDue = Math.max(0, (farmerSnap.data().current_due || 0) + dueDelta);
        batch.update(farmerRef, { current_due: newDue });
      }
    }
    await batch.commit();

    const after = { ...before, ...recalculated };
    await writeAuditLog({ actor: actorUid, actorRole, action: 'UPDATE_COLLECTION', module: 'collections', recordId: entryId, before, after, reason: updates._reason || 'SA correction' });
    return { success: true, data: after };
  } catch (err) {
    console.error('updateCollection error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Soft-delete a collection entry.
 */
export async function softDeleteCollection(entryId, reason, actorUid, actorRole) {
  try {
    const ref = doc(db, 'collections', entryId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Entry not found' };
    const before = snap.data();

    const batch = writeBatch(db);
    batch.set(doc(db, 'trash', `collections_${entryId}`), {
      ...before, _collection: 'collections', _deleted_at: nowISO(), _deleted_by: actorUid, _reason: reason
    });
    batch.delete(ref);
    // Reverse farmer due
    if (before.due_amount > 0) {
      const farmerRef = doc(db, 'farmers', before.farmer_id);
      const farmerSnap = await getDoc(farmerRef);
      if (farmerSnap.exists()) {
        batch.update(farmerRef, { current_due: Math.max(0, (farmerSnap.data().current_due || 0) - before.due_amount) });
      }
    }
    await batch.commit();

    await writeAuditLog({ actor: actorUid, actorRole, action: 'SOFT_DELETE_COLLECTION', module: 'collections', recordId: entryId, before, after: null, reason });
    return { success: true };
  } catch (err) {
    console.error('softDeleteCollection error:', err);
    return { success: false, error: err.message };
  }
}

// ─── EXPENSE MANAGEMENT ─────────────────────────────────────────────────────

/**
 * Update an expense entry.
 */
export async function updateExpense(expenseId, updates, actorUid, actorRole) {
  try {
    const ref = doc(db, 'expenses', expenseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Expense not found' };
    const before = snap.data();
    const after = { ...before, ...updates, updated_at: nowISO(), updated_by: actorUid };
    await updateDoc(ref, { ...updates, updated_at: nowISO(), updated_by: actorUid });
    await writeAuditLog({ actor: actorUid, actorRole, action: 'UPDATE_EXPENSE', module: 'expenses', recordId: expenseId, before, after, reason: updates._reason || '' });
    return { success: true, data: after };
  } catch (err) {
    console.error('updateExpense error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Soft-delete an expense.
 */
export async function softDeleteExpense(expenseId, reason, actorUid, actorRole) {
  try {
    const ref = doc(db, 'expenses', expenseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Expense not found' };
    const before = snap.data();
    const batch = writeBatch(db);
    batch.set(doc(db, 'trash', `expenses_${expenseId}`), { ...before, _collection: 'expenses', _deleted_at: nowISO(), _deleted_by: actorUid, _reason: reason });
    batch.delete(ref);
    await batch.commit();
    await writeAuditLog({ actor: actorUid, actorRole, action: 'SOFT_DELETE_EXPENSE', module: 'expenses', recordId: expenseId, before, after: null, reason });
    return { success: true };
  } catch (err) {
    console.error('softDeleteExpense error:', err);
    return { success: false, error: err.message };
  }
}

// ─── SALE / INVOICE MANAGEMENT ──────────────────────────────────────────────

/**
 * Update a sale record (with mandatory reason).
 */
export async function updateSale(billId, updates, actorUid, actorRole) {
  try {
    const ref = doc(db, 'sales', billId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Sale not found' };
    const before = snap.data();

    // Recalculate status if financial fields changed
    const paidAmount = updates.paid_amount !== undefined ? parseFloat(updates.paid_amount) : before.paid_amount;
    const totalAmount = updates.total_amount !== undefined ? parseFloat(updates.total_amount) : before.total_amount;
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const status = dueAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending');

    const finalUpdates = { ...updates, paid_amount: paidAmount, total_amount: totalAmount, due_amount: dueAmount, status, updated_at: nowISO(), updated_by: actorUid };
    await updateDoc(ref, finalUpdates);

    // Adjust customer due if due_amount changed
    const dueDelta = dueAmount - (before.due_amount || 0);
    if (Math.abs(dueDelta) > 0.01 && before.customer_id) {
      const custRef = doc(db, 'customers', before.customer_id);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        const newDue = Math.max(0, (custSnap.data().current_due || 0) + dueDelta);
        await updateDoc(custRef, { current_due: newDue });
      }
    }

    const after = { ...before, ...finalUpdates };
    await writeAuditLog({ actor: actorUid, actorRole, action: 'UPDATE_SALE', module: 'sales', recordId: billId, before, after, reason: updates._reason || 'SA correction' });
    return { success: true, data: after };
  } catch (err) {
    console.error('updateSale error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Soft-delete a sale.
 */
export async function softDeleteSale(billId, reason, actorUid, actorRole) {
  try {
    const ref = doc(db, 'sales', billId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Sale not found' };
    const before = snap.data();
    const batch = writeBatch(db);
    batch.set(doc(db, 'trash', `sales_${billId}`), { ...before, _collection: 'sales', _deleted_at: nowISO(), _deleted_by: actorUid, _reason: reason });
    batch.delete(ref);
    // Reverse customer due if applicable
    if ((before.due_amount || 0) > 0 && before.customer_id && !before.is_payment_record) {
      const custRef = doc(db, 'customers', before.customer_id);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        batch.update(custRef, { current_due: Math.max(0, (custSnap.data().current_due || 0) - before.due_amount) });
      }
    }
    await batch.commit();
    await writeAuditLog({ actor: actorUid, actorRole, action: 'SOFT_DELETE_SALE', module: 'sales', recordId: billId, before, after: null, reason });
    return { success: true };
  } catch (err) {
    console.error('softDeleteSale error:', err);
    return { success: false, error: err.message };
  }
}

// ─── TRASH / RESTORE ────────────────────────────────────────────────────────

/**
 * Load all items in the trash collection.
 */
export async function loadTrash() {
  try {
    const snap = await getDocs(collection(db, 'trash'));
    const items = snap.docs.map(d => ({ _trashId: d.id, ...d.data() }));
    items.sort((a, b) => (b._deleted_at || '').localeCompare(a._deleted_at || ''));
    return { success: true, data: items };
  } catch (err) {
    console.error('loadTrash error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Restore a record from trash back to its original collection.
 */
export async function restoreFromTrash(trashId, actorUid, actorRole) {
  try {
    const trashRef = doc(db, 'trash', trashId);
    const snap = await getDoc(trashRef);
    if (!snap.exists()) return { success: false, error: 'Trash item not found' };
    const data = snap.data();
    const { _collection, _trashId: _t, _deleted_at, _deleted_by, _reason, ...original } = data;

    const batch = writeBatch(db);
    // Determine original doc ID
    const originalId = trashId.replace(`${_collection}_`, '');
    batch.set(doc(db, _collection, originalId), { ...original, _restored_at: nowISO(), _restored_by: actorUid });
    batch.delete(trashRef);
    await batch.commit();

    await writeAuditLog({ actor: actorUid, actorRole, action: 'RESTORE_FROM_TRASH', module: _collection, recordId: originalId, before: data, after: original, reason: 'Restored from trash' });
    return { success: true };
  } catch (err) {
    console.error('restoreFromTrash error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Permanently purge a record from trash (irreversible).
 */
export async function purgeFromTrash(trashId, reason, actorUid, actorRole) {
  try {
    const trashRef = doc(db, 'trash', trashId);
    const snap = await getDoc(trashRef);
    if (!snap.exists()) return { success: false, error: 'Trash item not found' };
    const data = snap.data();
    await deleteDoc(trashRef);
    await writeAuditLog({ actor: actorUid, actorRole, action: 'PURGE_RECORD', module: data._collection, recordId: trashId, before: data, after: null, reason });
    return { success: true };
  } catch (err) {
    console.error('purgeFromTrash error:', err);
    return { success: false, error: err.message };
  }
}

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

/**
 * Load audit logs with optional filters.
 */
export async function loadAuditLogs({ module: mod, action, limitCount = 200 } = {}) {
  try {
    let q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    let logs = snap.docs.map(d => d.data());
    if (mod) logs = logs.filter(l => l.module === mod);
    if (action) logs = logs.filter(l => l.action === action);
    return { success: true, data: logs };
  } catch (err) {
    console.error('loadAuditLogs error:', err);
    return { success: false, error: err.message };
  }
}

// ─── SYNC STATUS ────────────────────────────────────────────────────────────

/**
 * Load sync failure records from Firestore.
 */
export async function loadSyncFailures() {
  try {
    const snap = await getDocs(collection(db, 'sync_failures'));
    const failures = snap.docs.map(d => d.data());
    failures.sort((a, b) => (b.failedAt || '').localeCompare(a.failedAt || ''));
    return { success: true, data: failures };
  } catch (err) {
    console.error('loadSyncFailures error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Clear a specific sync failure record (after manual resolution).
 */
export async function clearSyncFailure(failureId, actorUid, actorRole) {
  try {
    await deleteDoc(doc(db, 'sync_failures', failureId));
    await writeAuditLog({ actor: actorUid, actorRole, action: 'CLEAR_SYNC_FAILURE', module: 'sync', recordId: failureId, reason: 'Manually cleared by SA' });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── DATABASE OVERVIEW ──────────────────────────────────────────────────────

/**
 * Get record counts for all main Firestore collections.
 */
export async function getDatabaseOverview() {
  const collections = ['farmers', 'customers', 'collections', 'sales', 'expenses', 'products', 'users', 'audit_logs', 'sync_failures', 'trash', 'daily_spreadsheets'];
  const results = {};
  await Promise.all(collections.map(async (col) => {
    try {
      const snap = await getDocs(collection(db, col));
      results[col] = snap.size;
    } catch {
      results[col] = '?';
    }
  }));
  return { success: true, data: results };
}

// ─── CUSTOMER MANAGEMENT ────────────────────────────────────────────────────

/**
 * Update customer profile with audit log.
 */
export async function updateCustomerSA(customerId, updates, actorUid, actorRole) {
  try {
    const ref = doc(db, 'customers', customerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Customer not found' };
    const before = snap.data();
    await updateDoc(ref, { ...updates, updated_at: nowISO(), updated_by: actorUid });
    const after = { ...before, ...updates, updated_at: nowISO() };
    await writeAuditLog({ actor: actorUid, actorRole, action: 'UPDATE_CUSTOMER', module: 'customers', recordId: customerId, before, after, reason: updates._reason || '' });
    return { success: true, data: after };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Soft-delete a customer.
 */
export async function softDeleteCustomer(customerId, reason, actorUid, actorRole) {
  try {
    const ref = doc(db, 'customers', customerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Customer not found' };
    const before = snap.data();
    const batch = writeBatch(db);
    batch.set(doc(db, 'trash', `customers_${customerId}`), { ...before, _collection: 'customers', _deleted_at: nowISO(), _deleted_by: actorUid, _reason: reason });
    batch.delete(ref);
    await batch.commit();
    await writeAuditLog({ actor: actorUid, actorRole, action: 'SOFT_DELETE_CUSTOMER', module: 'customers', recordId: customerId, before, after: null, reason });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── SETTINGS (SA) ──────────────────────────────────────────────────────────

/**
 * Load full settings for SA view.
 */
export async function loadSettingsSA() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    return { success: true, data: snap.exists() ? snap.data() : {} };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save settings with audit log.
 */
export async function saveSettingsSA(settings, actorUid, actorRole) {
  try {
    const before = (await getDoc(doc(db, 'settings', 'general'))).data() || {};
    await setDoc(doc(db, 'settings', 'general'), settings);
    await writeAuditLog({ actor: actorUid, actorRole, action: 'UPDATE_SETTINGS', module: 'settings', recordId: 'general', before, after: settings, reason: 'SA updated settings' });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
