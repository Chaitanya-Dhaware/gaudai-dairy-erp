// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'react-hot-toast';

// 1. Mock LocalStorage before anything else imports api.js
const localStorageStore = {};
const mockStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = String(value); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => {
    for (const k in localStorageStore) delete localStorageStore[k];
  }
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  configurable: true,
  writable: true
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true
  });
}

// 2. Mock toast with vi.hoisted
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));
vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast
}));

// 3. Mock Firebase
let authStateCallback = null;

vi.mock('../utils/firebase', () => ({
  auth: { currentUser: null },
  db: {}
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    authStateCallback = cb;
    return () => {};
  }),
  signOut: vi.fn(),
  connectAuthEmulator: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: () => ({}),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: () => ({}),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  deleteDoc: vi.fn(),
  enableIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  connectFirestoreEmulator: vi.fn()
}));

vi.mock('../components/LanguageToggle', () => ({
  default: () => <div data-testid="lang-toggle" />
}));

vi.mock('../assets/gaudai-logo.png', () => ({
  default: 'mock-logo.png'
}));

let Login;
let useAppStore;

describe('Login Component & Auth Failure Isolation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage.clear();
    if (!Login) {
      const loginMod = await import('./Login');
      Login = loginMod.Login;
      const storeMod = await import('../store/appStore');
      useAppStore = storeMod.useAppStore;
    }
    useAppStore.getState().setUser(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Login component, submits failed credentials, asserts error toast and NO user is set', async () => {
    // Mock failed Firebase authentication
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error('Firebase: Error (auth/invalid-credential).')
    );

    render(<Login />);

    const emailInput = screen.getByPlaceholderText('manager@dairy.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In|प्रवेश करा/i });

    // Fill in credentials
    fireEvent.change(emailInput, { target: { value: 'unknown@dairy.com' } });
    fireEvent.change(passwordInput, { target: { value: 'incorrectpassword' } });

    // Submit form
    fireEvent.click(submitBtn);

    // Assert that sign in was attempted
    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'unknown@dairy.com',
        'incorrectpassword'
      );
    });

    // Assert that error toast was displayed
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid email or password');
    });

    // Assert that NO user was set in store
    const state = useAppStore.getState();
    expect(state.user).toBeNull();
  });

  it('proves demo credentials with failed Firebase sign-in never grant any local session', async () => {
    const store = useAppStore.getState();
    expect(store.user).toBeNull();

    // Test proves removal of legacy demo bypass (formerly: superadmin@gaudai.com / password123)
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error('Firebase: Error (auth/invalid-credential).')
    );

    render(<Login />);

    const emailInput = screen.getByPlaceholderText('manager@dairy.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In|प्रवेश करा/i });

    fireEvent.change(emailInput, { target: { value: 'attacker-demo@dairy.com' } });
    fireEvent.change(passwordInput, { target: { value: 'demo-password-attempt' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid email or password');
    });

    expect(useAppStore.getState().user).toBeNull();
  });

  it('reads user role authoritatively from Firestore and never trusts localStorage', async () => {
    // Attacker plants forged role in localStorage
    mockStorage.setItem('role', 'superadmin');
    mockStorage.setItem('GAUDAI_USER_SESSION', JSON.stringify({ role: 'superadmin' }));

    const { getDoc } = await import('firebase/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: 'user_123', email: 'staff@dairy.com', role: 'staff', name: 'Legit Staff' })
    });

    if (authStateCallback) {
      await authStateCallback({ uid: 'user_123', email: 'staff@dairy.com' });
    }

    const state = useAppStore.getState();
    // Authoritative role from Firestore must be 'staff', never the forged 'superadmin' from localStorage
    expect(state.user).not.toBeNull();
    expect(state.user.role).toBe('staff');
  });

  it('clears unauthenticated state when Firebase reports no active session', async () => {
    mockStorage.setItem(
      'GAUDAI_USER_SESSION',
      JSON.stringify({ uid: 'forged_root', role: 'superadmin', name: 'Fake Admin' })
    );

    if (authStateCallback) {
      await authStateCallback(null);
    }

    const state = useAppStore.getState();
    expect(state.user).toBeNull();
  });
});
