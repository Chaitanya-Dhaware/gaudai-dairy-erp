import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZZ_P7XTXziKmPpVLIminu3yP2L2RPfCg",
  authDomain: "i-assisted-dairy-management.firebaseapp.com",
  projectId: "i-assisted-dairy-management",
  storageBucket: "i-assisted-dairy-management.firebasestorage.app",
  messagingSenderId: "867346829567",
  appId: "1:867346829567:web:0485908c6633f642e83cca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'general'));
    if (docSnap.exists()) {
      console.log('Firestore Settings Doc:', docSnap.data());
    } else {
      console.log('Firestore Settings Doc not found');
    }

    // Check all collections
    const collections = ['farmers', 'collections', 'products', 'customers', 'sales', 'expenses'];
    for (const c of collections) {
      const snap = await getDocs(collection(db, c));
      console.log(`Collection '${c}' count:`, snap.size);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
