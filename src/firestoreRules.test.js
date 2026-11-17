/* global process */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'fs';
import path from 'path';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-dairy-erp-test';

describe('Firestore Security Rules Hotfix', () => {
  let testEnv;

  beforeAll(async () => {
    const hostPort = (typeof process !== 'undefined' && process.env.FIRESTORE_EMULATOR_HOST) || '127.0.0.1:8080';
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr || '8080', 10);

    try {
      const res = await fetch(`http://${host}:${port}/`);
      if (!res.ok && res.status !== 404 && res.status !== 200) {
        throw new Error('Emulator not ready');
      }
    } catch {
      console.warn(`Firestore emulator not running at ${host}:${port}. Use 'npm run test:rules' to run with emulator.`);
      return;
    }

    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host,
        port
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async (context) => {
    if (!testEnv) {
      context.skip();
      return;
    }
    await testEnv.clearFirestore();
  });

  // ─── 1. USERS & ROLE ESCALATION TESTS ─────────────────────────────
  describe('Users Collection & Role Escalation', () => {
    it('allows a user to read their own profile document (First Login flow)', async () => {
      // Seed user profile with admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_user_1'), {
          uid: 'staff_user_1',
          name: 'Ramesh Patil',
          email: 'ramesh@gaudai.com',
          role: 'staff',
          active: true
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_user_1', { email: 'ramesh@gaudai.com' }).firestore();
      const userDocRef = doc(staffDb, 'users', 'staff_user_1');

      await assertSucceeds(getDoc(userDocRef));
    });

    it('blocks a non-superadmin user from creating their own user document', async () => {
      const userDb = testEnv.authenticatedContext('new_user_123', { email: 'new@gaudai.com' }).firestore();
      const userDocRef = doc(userDb, 'users', 'new_user_123');

      await assertFails(setDoc(userDocRef, {
        uid: 'new_user_123',
        name: 'Attacker',
        email: 'new@gaudai.com',
        role: 'superadmin',
        active: true
      }));
    });

    it('blocks a user from escalating their own role to superadmin or admin', async () => {
      // Seed a legitimate staff user
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_1'), {
          uid: 'staff_1',
          name: 'Staff Worker',
          email: 'staff@gaudai.com',
          role: 'staff',
          active: true
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_1', { email: 'staff@gaudai.com' }).firestore();
      const userDocRef = doc(staffDb, 'users', 'staff_1');

      // Attempt role escalation
      await assertFails(updateDoc(userDocRef, { role: 'superadmin' }));
      await assertFails(updateDoc(userDocRef, { role: 'admin' }));
    });

    it('blocks a user from changing their own active flag or email', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_1'), {
          uid: 'staff_1',
          name: 'Staff Worker',
          email: 'staff@gaudai.com',
          role: 'staff',
          active: false
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_1', { email: 'staff@gaudai.com' }).firestore();
      const userDocRef = doc(staffDb, 'users', 'staff_1');

      await assertFails(updateDoc(userDocRef, { active: true }));
      await assertFails(updateDoc(userDocRef, { email: 'hacked@gaudai.com' }));
    });

    it('allows a user to update allowed profile fields (e.g., name, phone)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_1'), {
          uid: 'staff_1',
          name: 'Staff Worker',
          email: 'staff@gaudai.com',
          role: 'staff',
          active: true,
          phone: '9876543210'
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_1', { email: 'staff@gaudai.com' }).firestore();
      const userDocRef = doc(staffDb, 'users', 'staff_1');

      await assertSucceeds(updateDoc(userDocRef, { name: 'Updated Staff Worker', phone: '9999999999' }));
    });

    it('allows superadmin to create users and assign roles', async () => {
      // Seed legitimate superadmin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'superadmin_uid'), {
          uid: 'superadmin_uid',
          name: 'Super Admin',
          email: 'sa@gaudai.com',
          role: 'superadmin',
          active: true
        });
      });

      const saDb = testEnv.authenticatedContext('superadmin_uid', { email: 'sa@gaudai.com' }).firestore();

      // Superadmin creates new user
      await assertSucceeds(setDoc(doc(saDb, 'users', 'new_staff_uid'), {
        uid: 'new_staff_uid',
        name: 'New Staff',
        email: 'newstaff@gaudai.com',
        role: 'staff',
        active: true
      }));

      // Superadmin changes role of another user
      await assertSucceeds(updateDoc(doc(saDb, 'users', 'new_staff_uid'), {
        role: 'admin'
      }));
    });
  });

  // ─── 2. EMAIL-CONTAINS-SUPERADMIN REMOVAL TESTS ───────────────────
  describe('Email-Contains-Superadmin Exploit Prevention', () => {
    it('blocks an attacker whose email contains "superadmin" from acting as superadmin', async () => {
      // Attacker signs in with an email containing "superadmin", but their Firestore profile is staff or missing
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'attacker_uid'), {
          uid: 'attacker_uid',
          name: 'Attacker',
          email: 'fake_superadmin_123@attacker.com',
          role: 'staff',
          active: true
        });
      });

      const attackerDb = testEnv.authenticatedContext('attacker_uid', {
        email: 'fake_superadmin_123@attacker.com'
      }).firestore();

      // Attempt superadmin-only actions: creating another user, updating another user's role, or deleting
      await assertFails(setDoc(doc(attackerDb, 'users', 'victim_uid'), {
        uid: 'victim_uid',
        name: 'Victim',
        role: 'admin',
        active: true
      }));

      await assertFails(updateDoc(doc(attackerDb, 'users', 'attacker_uid'), {
        role: 'superadmin'
      }));
    });
  });

  // ─── 3. AUDIT LOGS FORGERY PREVENTION TESTS ───────────────────────
  describe('Audit Logs Integrity', () => {
    it('allows creating an audit log when logged identity equals caller uid', async () => {
      const userDb = testEnv.authenticatedContext('operator_42', { email: 'op@gaudai.com' }).firestore();

      await assertSucceeds(setDoc(doc(userDb, 'audit_logs', 'log_1'), {
        log_id: 'log_1',
        userId: 'operator_42',
        actor: 'operator_42',
        action: 'UPDATE_FARMER',
        module: 'farmers',
        timestamp: new Date().toISOString()
      }));
    });

    it('blocks forging an audit log with another user id', async () => {
      const userDb = testEnv.authenticatedContext('operator_42', { email: 'op@gaudai.com' }).firestore();

      // Forging userId to frame another user
      await assertFails(setDoc(doc(userDb, 'audit_logs', 'forged_log_1'), {
        log_id: 'forged_log_1',
        userId: 'innocent_victim_uid',
        actor: 'innocent_victim_uid',
        action: 'DELETE_ALL_DATA',
        module: 'system',
        timestamp: new Date().toISOString()
      }));

      // Forging actor to frame another user
      await assertFails(setDoc(doc(userDb, 'audit_logs', 'forged_log_2'), {
        log_id: 'forged_log_2',
        actor: 'superadmin_uid',
        action: 'SUPERADMIN_ACTION',
        module: 'users',
        timestamp: new Date().toISOString()
      }));
    });

    it('blocks updating or deleting audit logs (strictly immutable)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'audit_logs', 'immutable_log'), {
          log_id: 'immutable_log',
          userId: 'operator_42',
          actor: 'operator_42',
          action: 'LOGIN',
          timestamp: new Date().toISOString()
        });
      });

      const userDb = testEnv.authenticatedContext('operator_42').firestore();
      const logRef = doc(userDb, 'audit_logs', 'immutable_log');

      await assertFails(updateDoc(logRef, { action: 'TAMPERED_ACTION' }));
    });
  });

  // ─── 4. NORMAL STAFF WORK FLOW TESTS ──────────────────────────────
  describe('Normal Staff Operational Workflows', () => {
    beforeEach(async () => {
      // Seed staff profile
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_ramesh'), {
          uid: 'staff_ramesh',
          name: 'Ramesh',
          email: 'ramesh@gaudai.com',
          role: 'staff',
          active: true
        });
        await setDoc(doc(adminDb, 'settings', 'general'), {
          businessName: 'Gaudai AI Dairy',
          baseRate: 8.5
        });
      });
    });

    it('allows staff to read business settings', async () => {
      const staffDb = testEnv.authenticatedContext('staff_ramesh', { email: 'ramesh@gaudai.com' }).firestore();
      await assertSucceeds(getDoc(doc(staffDb, 'settings', 'general')));
    });

    it('blocks staff from modifying business settings (admin only)', async () => {
      const staffDb = testEnv.authenticatedContext('staff_ramesh', { email: 'ramesh@gaudai.com' }).firestore();
      await assertFails(updateDoc(doc(staffDb, 'settings', 'general'), { baseRate: 10.0 }));
    });

    it('allows staff to create farmers, collections, customers, sales, and expenses', async () => {
      const staffDb = testEnv.authenticatedContext('staff_ramesh', { email: 'ramesh@gaudai.com' }).firestore();

      // Farmer creation
      await assertSucceeds(setDoc(doc(staffDb, 'farmers', 'F001'), {
        name: 'Kisan Babar',
        mobile: '9822000000',
        milk_type: 'cow',
        created_at: new Date().toISOString()
      }));

      // Milk collection entry
      await assertSucceeds(setDoc(doc(staffDb, 'collections', 'C001'), {
        farmer_id: 'F001',
        quantity: 12.5,
        fat: 4.2,
        snf: 8.5,
        total_amount: 500,
        date: '2026-11-17'
      }));

      // Customer creation
      await assertSucceeds(setDoc(doc(staffDb, 'customers', 'CUST001'), {
        shop_name: 'Ganesh Sweets',
        owner_name: 'Ganesh',
        phone: '9822111111'
      }));

      // Sales entry
      await assertSucceeds(setDoc(doc(staffDb, 'sales', 'S001'), {
        customer_id: 'CUST001',
        total_amount: 1500,
        date: '2026-11-17'
      }));

      // Expense entry
      await assertSucceeds(setDoc(doc(staffDb, 'expenses', 'E001'), {
        category: 'fuel',
        amount: 350,
        date: '2026-11-17'
      }));
    });
  });
});
