import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'fake-api-key',
  projectId: 'i-assisted-dairy-management'
});

const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const TEST_USERS = [
  {
    email: 'superadmin@gaudai.com',
    password: 'password123',
    name: 'Super Admin',
    role: 'superadmin'
  },
  {
    email: 'admin@gaudai.com',
    password: 'password123',
    name: 'Chaitanya Dhaware',
    role: 'admin'
  },
  {
    email: 'staff@gaudai.com',
    password: 'password123',
    name: 'Shankar Rao',
    role: 'staff'
  },
  {
    email: 'accountant@gaudai.com',
    password: 'password123',
    name: 'Sunita Deshpande',
    role: 'accountant'
  }
];

async function seed() {
  console.log('Seeding Auth and Firestore emulators...');

  const testEnv = await initializeTestEnvironment({
    projectId: 'i-assisted-dairy-management',
    firestore: { host: '127.0.0.1', port: 8080 }
  });

  for (const user of TEST_USERS) {
    let uid;
    try {
      const cred = await createUserWithEmailAndPassword(auth, user.email, user.password);
      uid = cred.user.uid;
      console.log(`Created user ${user.email} (UID: ${uid})`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, user.email, user.password);
        uid = cred.user.uid;
        console.log(`User ${user.email} already exists (UID: ${uid})`);
      } else {
        console.error(`Error with ${user.email}:`, err);
        continue;
      }
    }

    // Write Firestore user document using admin context (rules disabled for seeding)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', uid), {
        uid: uid,
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
        created_at: new Date().toISOString()
      }, { merge: true });
    });

    console.log(`Seeded Firestore profile for ${user.email} -> role: ${user.role}`);
  }

  // Seed default settings
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'settings', 'general'), {
      baseRate: 40,
      businessName: 'गौदाई डेअरी',
      currencySymbol: '₹',
      morningShiftStart: '06:00',
      eveningShiftStart: '18:00',
      language: 'mr',
      systemAlert: ''
    }, { merge: true });
  });

  console.log('Seeded default settings/general in Firestore');
  console.log('Done! All users and settings seeded successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
