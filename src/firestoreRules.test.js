/* global process */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'fs';
import path from 'path';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

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

    it('blocks a user from reading another user\'s profile document', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_user_1'), {
          uid: 'staff_user_1',
          name: 'Ramesh Patil',
          email: 'ramesh@gaudai.com',
          role: 'staff',
          active: true
        });
        await setDoc(doc(adminDb, 'users', 'secret_admin'), {
          uid: 'secret_admin',
          name: 'Admin Boss',
          email: 'admin@gaudai.com',
          role: 'admin',
          active: true
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_user_1', { email: 'ramesh@gaudai.com' }).firestore();
      const otherUserRef = doc(staffDb, 'users', 'secret_admin');

      await assertFails(getDoc(otherUserRef));
    });

    it('blocks an admin from reading other users\' profile documents or listing all users', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'admin_1'), {
          uid: 'admin_1',
          name: 'Branch Admin',
          email: 'admin1@gaudai.com',
          role: 'admin',
          active: true
        });
        await setDoc(doc(adminDb, 'users', 'other_user'), {
          uid: 'other_user',
          name: 'Other Worker',
          email: 'other@gaudai.com',
          role: 'staff',
          active: true
        });
      });

      const adminDb = testEnv.authenticatedContext('admin_1', { email: 'admin1@gaudai.com' }).firestore();
      
      // Admin reading another user document -> denied
      await assertFails(getDoc(doc(adminDb, 'users', 'other_user')));

      // Admin attempting to list the whole users collection -> denied
      await assertFails(getDocs(collection(adminDb, 'users')));
    });

    it('allows superadmin to read any user profile document and list all users', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'superadmin_1'), {
          uid: 'superadmin_1',
          name: 'Master Superadmin',
          email: 'sa@gaudai.com',
          role: 'superadmin',
          active: true
        });
        await setDoc(doc(adminDb, 'users', 'staff_target'), {
          uid: 'staff_target',
          name: 'Staff Target',
          email: 'staff@gaudai.com',
          role: 'staff',
          active: true
        });
      });

      const saDb = testEnv.authenticatedContext('superadmin_1', { email: 'sa@gaudai.com' }).firestore();

      // Superadmin reading another user document -> allowed
      await assertSucceeds(getDoc(doc(saDb, 'users', 'staff_target')));

      // Superadmin querying/listing users collection -> allowed
      await assertSucceeds(getDocs(collection(saDb, 'users')));
    });

    it('blocks all client-side user document creation (even by superadmin; must route via /api/users)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'superadmin_1'), {
          uid: 'superadmin_1',
          name: 'Super Admin',
          email: 'sa@gaudai.com',
          role: 'superadmin',
          active: true
        });
      });

      const saDb = testEnv.authenticatedContext('superadmin_1', { email: 'sa@gaudai.com' }).firestore();
      const userDb = testEnv.authenticatedContext('attacker_1', { email: 'attacker@gaudai.com' }).firestore();

      // Non-superadmin client create -> denied
      await assertFails(setDoc(doc(userDb, 'users', 'new_user_1'), {
        uid: 'new_user_1',
        name: 'Attacker',
        role: 'superadmin',
        active: true
      }));

      // Superadmin client create -> denied (must use /api/users Admin SDK)
      await assertFails(setDoc(doc(saDb, 'users', 'new_user_2'), {
        uid: 'new_user_2',
        name: 'New Staff',
        role: 'staff',
        active: true
      }));
    });

    it('blocks all client-side user document updates (even own profile; must route via /api/users)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_1'), {
          uid: 'staff_1',
          name: 'Staff Worker',
          email: 'staff@gaudai.com',
          role: 'staff',
          active: true
        });
        await setDoc(doc(adminDb, 'users', 'superadmin_1'), {
          uid: 'superadmin_1',
          name: 'Super Admin',
          email: 'sa@gaudai.com',
          role: 'superadmin',
          active: true
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_1', { email: 'staff@gaudai.com' }).firestore();
      const saDb = testEnv.authenticatedContext('superadmin_1', { email: 'sa@gaudai.com' }).firestore();

      // User updating own name via client -> denied
      await assertFails(updateDoc(doc(staffDb, 'users', 'staff_1'), { name: 'Renamed Worker' }));

      // Superadmin updating user via client -> denied (must use /api/users Admin SDK)
      await assertFails(updateDoc(doc(saDb, 'users', 'staff_1'), { role: 'admin' }));
    });

    it('blocks all client-side user document deletion (even by superadmin)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'superadmin_1'), {
          uid: 'superadmin_1',
          name: 'Super Admin',
          email: 'sa@gaudai.com',
          role: 'superadmin',
          active: true
        });
        await setDoc(doc(adminDb, 'users', 'staff_to_delete'), {
          uid: 'staff_to_delete',
          name: 'Staff to Delete',
          email: 'del@gaudai.com',
          role: 'staff',
          active: true
        });
      });

      const saDb = testEnv.authenticatedContext('superadmin_1', { email: 'sa@gaudai.com' }).firestore();

      // Superadmin attempting client delete -> denied
      await assertFails(deleteDoc(doc(saDb, 'users', 'staff_to_delete')));
    });

    it('blocks a user from escalating their own role to superadmin or admin', async () => {
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

  // ─── 5. FAIL-CLOSED HELPERS & DENY-BY-DEFAULT TESTS ───────────────
  describe('Fail-Closed Helpers & Deny-by-Default Architecture', () => {
    it('denies read and write to unmapped collections by default', async () => {
      const staffDb = testEnv.authenticatedContext('staff_ramesh', { email: 'ramesh@gaudai.com' }).firestore();
      const unmappedDoc = doc(staffDb, 'unknown_secret_collection', 'doc_123');

      await assertFails(getDoc(unmappedDoc));
      await assertFails(setDoc(unmappedDoc, { secret: 'data' }));
    });

    it('fails closed when user profile document is completely missing', async () => {
      // Authenticated in Firebase Auth, but zero Firestore document in users/ghost_user
      const ghostDb = testEnv.authenticatedContext('ghost_user', { email: 'ghost@gaudai.com' }).firestore();

      // Should not be able to create a farmer (requires isStaff())
      await assertFails(setDoc(doc(ghostDb, 'farmers', 'F_GHOST'), {
        name: 'Ghost Farmer',
        mobile: '9822999999',
        created_at: new Date().toISOString()
      }));
    });

    it('fails closed when user profile is marked inactive (active: false)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'deactivated_admin'), {
          uid: 'deactivated_admin',
          name: 'Deactivated Admin',
          email: 'admin@gaudai.com',
          role: 'admin',
          active: false
        });
      });

      const deactDb = testEnv.authenticatedContext('deactivated_admin', { email: 'admin@gaudai.com' }).firestore();

      // Should be blocked from updating settings even though role is admin
      await assertFails(updateDoc(doc(deactDb, 'settings', 'general'), { baseRate: 12.0 }));
    });

    it('fails closed when role is malformed or improperly cased', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        // Casing mismatch or unauthorized string
        await setDoc(doc(adminDb, 'users', 'casing_user'), {
          uid: 'casing_user',
          name: 'Cased Admin',
          role: 'Admin', // Capitalized - malformed
          active: true
        });
        await setDoc(doc(adminDb, 'users', 'unknown_role_user'), {
          uid: 'unknown_role_user',
          name: 'Intern',
          role: 'intern', // Unknown role string
          active: true
        });
      });

      const casedDb = testEnv.authenticatedContext('casing_user').firestore();
      const unknownDb = testEnv.authenticatedContext('unknown_role_user').firestore();

      await assertFails(updateDoc(doc(casedDb, 'settings', 'general'), { baseRate: 15.0 }));
      await assertFails(setDoc(doc(unknownDb, 'farmers', 'F_INTERN'), { name: 'Intern Farmer' }));
    });

    it('allows signed-in user to create sync failure for own UID, but blocks for another UID', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users', 'staff_ramesh'), {
          uid: 'staff_ramesh',
          name: 'Ramesh',
          role: 'staff',
          active: true
        });
      });

      const staffDb = testEnv.authenticatedContext('staff_ramesh', { email: 'ramesh@gaudai.com' }).firestore();

      // Valid sync failure logging
      await assertSucceeds(setDoc(doc(staffDb, 'sync_failures', 'fail_1'), {
        id: 'fail_1',
        userId: 'staff_ramesh',
        jobId: 'col_123',
        action: 'addMilkCollection',
        error: 'Permanent 400 error'
      }));

      // Forged sync failure claiming another user
      await assertFails(setDoc(doc(staffDb, 'sync_failures', 'forged_fail'), {
        id: 'forged_fail',
        userId: 'other_user_uid',
        jobId: 'col_999',
        action: 'addMilkCollection',
        error: 'Permanent 400 error'
      }));
    });
  });
});
