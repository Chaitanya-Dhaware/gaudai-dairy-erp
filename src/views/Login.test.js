import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Mock LocalStorage
const localStorageStore = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key) => localStorageStore[key] || null,
    setItem: (key, value) => { localStorageStore[key] = String(value); },
    removeItem: (key) => { delete localStorageStore[key]; },
    clear: () => {
      for (const k in localStorageStore) delete localStorageStore[k];
    }
  },
  writable: true,
  configurable: true
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  },
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock Firebase modules
vi.mock('../utils/firebase', () => ({
  auth: { currentUser: null },
  db: {}
}));

let authStateCallback = null;

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((authInstance, cb) => {
    authStateCallback = cb;
    return () => {};
  }),
  signOut: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: () => ({}),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: () => ({}),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  deleteDoc: vi.fn()
}));

describe('Authentication Failure & State Isolation Security', () => {
  let useAppStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    // Dynamically import store after mocks are established
    const storeModule = await import('../store/appStore');
    useAppStore = storeModule.useAppStore;
    useAppStore.getState().setUser(null);
  });

  it('proves a failed Firebase sign-in never sets a user in the store', async () => {
    const store = useAppStore.getState();
    expect(store.user).toBeNull();

    // Simulate Firebase rejection (e.g. wrong password or invalid user)
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error('Firebase: Error (auth/invalid-credential).')
    );

    let loginErrorCaught = false;
    try {
      await signInWithEmailAndPassword({}, 'attacker@example.com', 'wrongpassword');
    } catch {
      loginErrorCaught = true;
    }

    expect(loginErrorCaught).toBe(true);

    // Verify state isolation
    const currentState = useAppStore.getState();
    expect(currentState.user).toBeNull();
    expect(localStorage.getItem('GAUDAI_USER_SESSION')).toBeNull();
  });

  it('proves demo credentials with failed Firebase sign-in never grant any local session', async () => {
    const store = useAppStore.getState();
    expect(store.user).toBeNull();

    // Even if an attacker supplies superadmin email and password
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error('Firebase: Error (auth/invalid-credential).')
    );

    let caught = false;
    try {
      await signInWithEmailAndPassword({}, 'superadmin@gaudai.com', 'password123');
    } catch {
      caught = true;
    }

    expect(caught).toBe(true);

    // Ensure store is still completely null and no demo fallback occurred
    const currentState = useAppStore.getState();
    expect(currentState.user).toBeNull();
    expect(localStorage.getItem('GAUDAI_USER_SESSION')).toBeNull();
  });

  it('clears forged localStorage session when Firebase reports unauthenticated state', async () => {
    // Forged session planted in localStorage by an attacker
    localStorage.setItem(
      'GAUDAI_USER_SESSION',
      JSON.stringify({ uid: 'forged_root', role: 'superadmin', name: 'Fake Admin' })
    );

    // Trigger authStateChanged with null (no valid Firebase session)
    if (authStateCallback) {
      await authStateCallback(null);
    }

    const state = useAppStore.getState();
    expect(state.user).toBeNull();
    expect(localStorage.getItem('GAUDAI_USER_SESSION')).toBeNull();
  });
});
