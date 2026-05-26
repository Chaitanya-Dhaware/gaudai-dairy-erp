import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Force mock mode for api.js by clearing Apps Script URL in test environment
import.meta.env.VITE_APPS_SCRIPT_URL = '';

// 1. Mock LocalStorage before importing store/api
const localStorageStore = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key) => localStorageStore[key] || null,
    setItem: (key, value) => { localStorageStore[key] = String(value); },
    clear: () => {
      for (const key in localStorageStore) {
        delete localStorageStore[key];
      }
    },
    removeItem: (key) => { delete localStorageStore[key]; }
  },
  writable: true,
  configurable: true
});

// 2. Mock Firebase and other modules
vi.mock('../utils/firebase', () => ({
  auth: { uid: 'test-user-id', email: 'admin@gaudai.com' },
  db: {}
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  onAuthStateChanged: (auth, callback) => {
    // Immediately invoke callback with mock user to trigger sync
    callback({ uid: 'test-user-id', email: 'admin@gaudai.com' });
    return () => {};
  },
  signOut: async () => {}
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: () => ({}),
  getDoc: async () => ({
    exists: () => true,
    data: () => ({ uid: 'test-user-id', name: 'Test Admin', role: 'admin', active: true })
  }),
  setDoc: async () => {},
  collection: () => ({}),
  getDocs: async () => ({ docs: [] }),
  updateDoc: async () => {},
  deleteDoc: async () => {}
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

let useAppStore;

beforeAll(async () => {
  const storeModule = await import('./appStore');
  useAppStore = storeModule.useAppStore;
});

describe('Gaudai AI Dairy ERP - AppStore', () => {
  beforeEach(async () => {
    // Clear mock localStorage and re-initialize it for fresh state
    localStorage.clear();
    // Re-importing or resetting state of appStore
    const store = useAppStore.getState();
    // Pre-populate settings and basic data in store
    store.setUser({ uid: 'adm1', name: 'Ravi Patil', role: 'admin', active: true, email: 'admin@gaudai.com' });
    await store.loadAllData();
  });

  it('should initialize with mock database seed values', () => {
    const state = useAppStore.getState();
    expect(state.farmers.length).toBeGreaterThan(0);
    expect(state.products.length).toBeGreaterThan(0);
    expect(state.customers.length).toBeGreaterThan(0);
    expect(state.settings.baseRate).toBe(8.5);
  });

  it('should register a new farmer successfully', async () => {
    const store = useAppStore.getState();
    const success = await store.registerFarmer({
      name: 'Balasaheb Shinde',
      mobile: '9922334455',
      address: 'Satara Road',
      milk_type: 'Buffalo'
    });

    expect(success).toBe(true);
    // Retrieve updated farmers list
    const updatedFarmers = useAppStore.getState().farmers;
    const newFarmer = updatedFarmers.find(f => f.name === 'Balasaheb Shinde');
    expect(newFarmer).toBeDefined();
    expect(newFarmer.mobile).toBe('9922334455');
    expect(newFarmer.milk_type).toBe('Buffalo');
  });

  it('should add milk collection and calculate rate correctly', async () => {
    const store = useAppStore.getState();
    const testFarmerId = 'F-201'; // Anil Deshmukh from seed data
    const farmerBefore = store.farmers.find(f => f.farmer_id === testFarmerId);
    const initialDue = farmerBefore.current_due;

    // Add collection entry
    // baseRate is 8.5, fat is 4.5. Rate = 8.5 * 4.5 = 38.25
    // qty is 10. Total amount = 382.5. Paid is 200. Due = 182.5
    const success = await store.addMilkCollection({
      farmer_id: testFarmerId,
      date: '2026-05-26',
      milk_type: 'Cow',
      quantity: 10,
      fat: 4.5,
      snf: 8.5,
      paidAmount: 200
    });

    expect(success).toBe(true);

    const updatedState = useAppStore.getState();
    // Validate calculations
    const latestEntry = updatedState.collections[0];
    expect(latestEntry.calculated_rate).toBe(38.25);
    expect(latestEntry.total_amount).toBe(382.5);
    expect(latestEntry.due_amount).toBe(182.5);

    // Validate that the farmer's current due was updated in cache
    const farmerAfter = updatedState.farmers.find(f => f.farmer_id === testFarmerId);
    expect(farmerAfter.current_due).toBe(initialDue + 182.5);
  });

  it('should record sales invoice and update customer dues', async () => {
    const store = useAppStore.getState();
    const testCustomerId = 'C002'; // Rahul Dairy from seed
    const customerBefore = store.customers.find(c => c.customer_id === testCustomerId);
    const initialDue = customerBefore.current_due;

    // Add sale bill: total amount = 500, paid = 100, due = 400
    const success = await store.addSale({
      customer_id: testCustomerId,
      items: [
        { product_id: 'P002', product_name: 'Standard Milk 1L', quantity: 10, unit_price: 50, total: 500 }
      ],
      total_amount: 500,
      paid_amount: 100,
      due_amount: 400,
      date: '2026-05-26'
    });

    expect(success).toBe(true);

    const updatedState = useAppStore.getState();
    const customerAfter = updatedState.customers.find(c => c.customer_id === testCustomerId);
    expect(customerAfter.current_due).toBe(initialDue + 400);
  });

  it('should record an operational expense', async () => {
    const store = useAppStore.getState();
    const initialExpensesCount = store.expenses.length;

    const success = await store.addExpense({
      date: '2026-05-26',
      reason: 'Cattle Feed Bag Purchase',
      amount: 1500,
      category: 'Supplies',
      payment_method: 'Cash',
      notes: 'Bought 1 bag of high protein feed'
    });

    expect(success).toBe(true);

    const updatedState = useAppStore.getState();
    expect(updatedState.expenses.length).toBe(initialExpensesCount + 1);
    expect(updatedState.expenses[0].reason).toBe('Cattle Feed Bag Purchase');
  });
});
