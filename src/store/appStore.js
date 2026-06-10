import { create } from 'zustand';
import toast from 'react-hot-toast';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

// New optimized service layer
import * as FS from '../utils/firestoreService';
import { enqueueSyncJob, initSyncQueue } from '../utils/syncQueue';
import { getCached, setCached, invalidateCache, invalidateCaches, clearAllCache } from '../utils/cache';
import { saveDailySpreadsheetMapping } from '../utils/firestoreService';

// Legacy API for settings/archive endpoints that still need GAS
import { callAPI } from '../utils/api';

// Safe parsing helper for currency values to prevent propagation of NaN values
const getSafeDue = (due) => {
  const d = parseFloat(due);
  return isNaN(d) ? 0 : d;
};

export const useAppStore = create((set, get) => ({
  // Authentication & Users
  user: null, // Current active user role details
  loadingAuth: true,
  
  // Navigation Workspaces
  activeWorkspace: 'dashboard', // dashboard, collection, customers, expenses, accounts, settings
  activeTab: 'summary', // current open tab in active workspace
  
  // Settings & DB Parameters
  settings: {
    baseRate: 8.5,
    businessName: 'Gaudai AI Dairy',
    adminMobile: '',
    whatsappToken: '',
    whatsappPhoneId: '',
    sheetsIdCollection: '',
    sheetsIdCustomer: '',
    sheetsIdExpense: '',
    sheetsIdMaster: '',
    dueReminderFreq: 2
  },

  // Data lists
  farmers: [],
  products: [],
  customers: [],
  collections: [],
  sales: [],
  expenses: [],
  cashFlow: [],
  todaySummary: {
    revenueToday: 0,
    cashInToday: 0,
    expensesToday: 0,
    farmerPaymentsToday: 0,
    opExpensesToday: 0,
    pendingDues: 0,
    netProfit: 0
  },
  aiInsights: [],
  
  loading: false,
  dataLoaded: false, // Tracks whether secondary data has been loaded

  // Daily spreadsheet management
  dailySpreadsheets: [],
  dailySheetsLoaded: false,

  // Action methods
  setUser: (user) => {
    if (user) {
      localStorage.setItem('GAUDAI_USER_SESSION', JSON.stringify(user));
    } else {
      localStorage.removeItem('GAUDAI_USER_SESSION');
    }
    set({ user });
  },
  setLoadingAuth: (loadingAuth) => set({ loadingAuth }),
  logout: async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Firebase signOut error:', e);
    }
    clearAllCache();
    get().setUser(null);
    toast.success('लॉगआउट यशस्वी / Logged out successfully');
  },
  
  setWorkspace: (workspace) => {
    let tab = 'summary';
    if (workspace === 'customers') tab = 'new-bill';
    if (workspace === 'expenses') tab = 'add';
    if (workspace === 'accounts') tab = 'financials';
    if (workspace === 'settings') tab = 'general';
    set({ activeWorkspace: workspace, activeTab: tab });
  },
  
  setTab: (tab) => set({ activeTab: tab }),

  // ─── DATA LOADING (Firestore-first, cache-accelerated) ─────────

  /**
   * Load critical data for immediate dashboard render.
   * Reads from cache first, then Firestore.
   * Google Sheets is NOT touched during loading.
   */
  loadAllData: async () => {
    set({ loading: true });
    try {
      // Phase 1: Load critical data from cache (instant)
      const cachedSettings = getCached('settings');
      const cachedFarmers = getCached('farmers');
      const cachedProducts = getCached('products');
      const cachedCustomers = getCached('customers');

      if (cachedSettings) set({ settings: cachedSettings });
      if (cachedFarmers) set({ farmers: cachedFarmers });
      if (cachedProducts) set({ products: cachedProducts });
      if (cachedCustomers) set({ customers: cachedCustomers });

      // Phase 2: Load from Firestore (fast, ~200ms with persistence)
      const critical = await FS.loadCriticalData();
      
      const settingsData = (critical.settings.success && critical.settings.data) 
        ? critical.settings.data 
        : get().settings;
      const farmersData = critical.farmers.success ? critical.farmers.data : get().farmers;
      const productsData = critical.products.success ? critical.products.data : get().products;
      const customersData = critical.customers.success ? critical.customers.data : get().customers;

      // Update state and cache
      set({ settings: settingsData, farmers: farmersData, products: productsData, customers: customersData });
      setCached('settings', settingsData);
      setCached('farmers', farmersData);
      setCached('products', productsData);
      setCached('customers', customersData);

      // Phase 3: Load secondary data in background (non-blocking for dashboard)
      get().loadSecondaryData();

    } catch (e) {
      console.error('Failed to load data:', e);
      toast.error('डेटा लोड करण्यास अडचण आली / Failed loading data');
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Load collections, sales, expenses in background.
   * Computes summary and cash flow client-side.
   */
  loadSecondaryData: async () => {
    try {
      // Try cache first for instant display
      const cachedCollections = getCached('collections');
      const cachedSales = getCached('sales');
      const cachedExpenses = getCached('expenses');
      
      if (cachedCollections && cachedSales && cachedExpenses) {
        const summary = FS.computeDashboardSummary(cachedCollections, cachedSales, cachedExpenses, get().customers);
        const cashFlow = FS.computeCashFlow(cachedCollections, cachedSales, cachedExpenses);
        set({ 
          collections: cachedCollections, 
          sales: cachedSales, 
          expenses: cachedExpenses,
          todaySummary: summary,
          cashFlow,
          dataLoaded: true
        });
      }

      // Then load fresh from Firestore
      const secondary = await FS.loadSecondaryData();
      const collectionsData = secondary.collections.success ? secondary.collections.data : get().collections;
      const salesData = secondary.sales.success ? secondary.sales.data : get().sales;
      const expensesData = secondary.expenses.success ? secondary.expenses.data : get().expenses;
      
      // Compute summary and cash flow client-side (no network call!)
      const summary = FS.computeDashboardSummary(collectionsData, salesData, expensesData, get().customers);
      const cashFlow = FS.computeCashFlow(collectionsData, salesData, expensesData);

      set({ 
        collections: collectionsData, 
        sales: salesData, 
        expenses: expensesData,
        todaySummary: summary,
        cashFlow,
        dataLoaded: true
      });

      setCached('collections', collectionsData);
      setCached('sales', salesData);
      setCached('expenses', expensesData);
    } catch (e) {
      console.error('Failed to load secondary data:', e);
    }
  },

  // Refresh summary from local data (no network call)
  refreshSummary: () => {
    const { collections, sales, expenses, customers } = get();
    const summary = FS.computeDashboardSummary(collections, sales, expenses, customers);
    const cashFlow = FS.computeCashFlow(collections, sales, expenses);
    set({ todaySummary: summary, cashFlow });
  },

  // ─── FARMER CRUD ──────────────────────────────────────────────────

  registerFarmer: async (data) => {
    set({ loading: true });
    try {
      const res = await FS.registerFarmer(data);
      if (res.success) {
        toast.success('शेतकरी नोंदणी यशस्वी / Farmer registered!');
        // Optimistic update
        set({ farmers: [...get().farmers, res.data] });
        invalidateCache('farmers');
        // Background sync to Google Sheets
        enqueueSyncJob('registerFarmer', res.data, `farmer_${res.data.farmer_id}`);
        return true;
      }
      return false;
    } catch {
      toast.error('तांत्रिक अडचण आली / Save error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteFarmer: async (farmerId) => {
    set({ loading: true });
    try {
      const res = await FS.deleteFarmer(farmerId);
      if (res.success) {
        const isMarathi = localStorage.getItem('i18nextLng') === 'mr';
        toast.success(isMarathi ? 'शेतकरी हटवला!' : 'Farmer deleted!');
        // Optimistic update
        set({ farmers: get().farmers.filter(f => f.farmer_id !== farmerId) });
        invalidateCache('farmers');
        // Background sync
        enqueueSyncJob('deleteFarmer', { farmer_id: farmerId }, `del_farmer_${farmerId}`);
        return true;
      }
      return false;
    } catch {
      toast.error('शेतकरी हटवण्यास अडचण / Delete error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ─── COLLECTION CRUD ──────────────────────────────────────────────

  addMilkCollection: async (data) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await FS.addMilkCollection(data, settings);
      if (res.success) {
        toast.success('दूध नोंद जतन झाली / Collection added!');
        // Optimistic updates
        const entry = res.data;
        const updatedCollections = [entry, ...get().collections];
        const updatedFarmers = get().farmers.map(f => {
          if (f.farmer_id === data.farmer_id) {
            return { ...f, current_due: getSafeDue(f.current_due) + entry.due_amount };
          }
          return f;
        });
        set({ collections: updatedCollections, farmers: updatedFarmers });
        invalidateCaches(['collections', 'farmers', 'summary']);
        
        // Recompute summary
        get().refreshSummary();

        // Background sync to Google Sheets
        enqueueSyncJob('addMilkCollection', {
          ...entry,
          sheetsIdCollection: settings.sheetsIdCollection
        }, `col_${entry.entry_id}`);

        return true;
      }
      return false;
    } catch {
      toast.error('जतन करताना त्रुटी आली / Save error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  markFarmerPaid: async (entryId, amount) => {
    set({ loading: true });
    try {
      const res = await FS.markFarmerPaid(entryId, amount);
      if (res.success) {
        toast.success('पेमेंट यशस्वी / Payment marked paid!');
        // Optimistic updates
        const amtVal = parseFloat(amount);
        const updatedCollections = get().collections.map(c => {
          if (c.entry_id === entryId) {
            const remaining = Math.max(0, (c.due_amount || 0) - amtVal);
            return {
              ...c,
              paid_amount: (c.paid_amount || 0) + amtVal,
              due_amount: remaining,
              status: remaining <= 0 ? 'Paid' : 'Partial'
            };
          }
          return c;
        });
        const entry = get().collections.find(c => c.entry_id === entryId);
        const updatedFarmers = get().farmers.map(f => {
          if (entry && f.farmer_id === entry.farmer_id) {
            return { ...f, current_due: Math.max(0, getSafeDue(f.current_due) - amtVal) };
          }
          return f;
        });
        set({ collections: updatedCollections, farmers: updatedFarmers });
        invalidateCaches(['collections', 'farmers', 'summary']);
        get().refreshSummary();

        // Background sync
        const settings = get().settings;
        enqueueSyncJob('markFarmerPaid', { 
          entryId, amount, 
          sheetsIdCollection: settings.sheetsIdCollection 
        }, `pay_${entryId}_${Date.now()}`);

        return true;
      }
      return false;
    } catch {
      toast.error('पेमेंट जतन झाले नाही / Payment error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ─── CUSTOMER CRUD ────────────────────────────────────────────────

  addCustomer: async (data) => {
    set({ loading: true });
    try {
      const res = await FS.addCustomer(data);
      if (res.success) {
        toast.success('ग्राहक यशस्वी नोंदवला / Customer added!');
        set({ customers: [...get().customers, res.data] });
        invalidateCache('customers');
        enqueueSyncJob('addCustomer', res.data, `cust_${res.data.customer_id}`);
        return true;
      }
      return false;
    } catch {
      toast.error('नोंदणी त्रुटी / Register error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateCustomer: async (customerId, data) => {
    set({ loading: true });
    try {
      const res = await FS.updateCustomer(customerId, data);
      if (res.success) {
        toast.success('ग्राहक माहिती बदलली / Customer updated!');
        set({
          customers: get().customers.map(c =>
            c.customer_id === customerId ? { ...c, ...data } : c
          )
        });
        invalidateCache('customers');
        enqueueSyncJob('updateCustomer', { customer_id: customerId, ...data }, `upd_cust_${customerId}`);
        return true;
      }
      return false;
    } catch {
      toast.error('माहिती बदल जतन झाला नाही / Update error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteCustomer: async (customerId) => {
    set({ loading: true });
    try {
      const res = await FS.deleteCustomer(customerId);
      if (res.success) {
        const isMarathi = localStorage.getItem('i18nextLng') === 'mr';
        toast.success(isMarathi ? 'ग्राहक हटवला!' : 'Customer deleted!');
        set({ customers: get().customers.filter(c => c.customer_id !== customerId) });
        invalidateCache('customers');
        enqueueSyncJob('deleteCustomer', { customer_id: customerId }, `del_cust_${customerId}`);
        return true;
      }
      return false;
    } catch {
      toast.error('ग्राहक हटवण्यास अडचण / Delete error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  addProduct: async (data) => {
    set({ loading: true });
    try {
      const res = await FS.addProduct(data);
      if (res.success) {
        toast.success('उत्पादन यशस्वी जोडले / Product added!');
        set({ products: [...get().products, res.data] });
        invalidateCache('products');
        enqueueSyncJob('addProduct', res.data, `prod_${res.data.product_id}`);
        return true;
      }
      return false;
    } catch {
      toast.error('उत्पादन जतन करताना त्रुटी / Product save error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateProduct: async (productId, data, newProductId) => {
    set({ loading: true });
    try {
      const res = await FS.updateProduct(productId, data, newProductId);
      if (res.success) {
        toast.success('उत्पादन सुधारित केले / Product updated!');
        const updatedId = newProductId || productId;
        set({
          products: get().products.map(p =>
            p.product_id === productId ? { ...p, ...data, product_id: updatedId, updated_at: new Date().toISOString() } : p
          )
        });
        invalidateCache('products');
        enqueueSyncJob('updateProduct', { product_id: productId, new_product_id: newProductId, data }, `upd_prod_${productId}`);
        return true;
      }
      return false;
    } catch {
      toast.error('बदल जतन झाला नाही / Update error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteProduct: async (productId) => {
    set({ loading: true });
    try {
      const res = await FS.deleteProduct(productId);
      if (res.success) {
        toast.success('उत्पादन हटवले / Product deleted!');
        set({ products: get().products.filter(p => p.product_id !== productId) });
        invalidateCache('products');
        enqueueSyncJob('deleteProduct', { product_id: productId }, `del_prod_${productId}`);
        return true;
      }
      return false;
    } catch {
      toast.error('उत्पादन हटवण्यास अडचण / Delete error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  addSale: async (data) => {
    set({ loading: true });
    try {
      const res = await FS.addSale(data);
      if (res.success) {
        toast.success('बिल जतन झाले / Bill saved!');
        const sale = res.data;
        const updatedSales = [sale, ...get().sales];
        const updatedCustomers = get().customers.map(c => {
          if (c.customer_id === data.customer_id) {
            return { ...c, current_due: getSafeDue(c.current_due) + sale.due_amount };
          }
          return c;
        });
        set({ sales: updatedSales, customers: updatedCustomers });
        invalidateCaches(['sales', 'customers', 'summary']);
        get().refreshSummary();

        const settings = get().settings;
        enqueueSyncJob('addSale', {
          ...sale,
          sheetsIdCustomer: settings.sheetsIdCustomer
        }, `sale_${sale.bill_id}`);

        return true;
      }
      return false;
    } catch {
      toast.error('बिल जतन करण्यात अडचण / Bill save error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  recordCustomerPayment: async (customerId, amount) => {
    set({ loading: true });
    try {
      const res = await FS.recordCustomerPayment(customerId, amount);
      if (res.success) {
        toast.success('देयक नोंद यशस्वी / Payment recorded!');
        const amt = parseFloat(amount);
        set({
          customers: get().customers.map(c => {
            if (c.customer_id === customerId) {
              return { ...c, current_due: Math.max(0, getSafeDue(c.current_due) - amt) };
            }
            return c;
          })
        });
        invalidateCaches(['customers', 'sales', 'summary']);
        get().refreshSummary();

        const settings = get().settings;
        enqueueSyncJob('recordPayment', {
          customer_id: customerId, amount,
          sheetsIdCustomer: settings.sheetsIdCustomer
        }, `custpay_${customerId}_${Date.now()}`);

        return true;
      }
      return false;
    } catch {
      toast.error('त्रुटी आली / Payment error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ─── EXPENSE CRUD ─────────────────────────────────────────────────

  addExpense: async (data) => {
    set({ loading: true });
    try {
      const res = await FS.addExpense(data);
      if (res.success) {
        toast.success('खर्च नोंदवला / Expense added!');
        set({ expenses: [res.data, ...get().expenses] });
        invalidateCaches(['expenses', 'summary']);
        get().refreshSummary();

        const settings = get().settings;
        enqueueSyncJob('addExpense', {
          ...res.data,
          sheetsIdExpense: settings.sheetsIdExpense
        }, `exp_${res.data.expense_id}`);

        return true;
      }
      return false;
    } catch {
      toast.error('खर्च जतन करताना त्रुटी / Expense save error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpense: async (expenseId) => {
    set({ loading: true });
    try {
      const res = await FS.deleteExpense(expenseId);
      if (res.success) {
        toast.success('खर्च हटवला / Expense deleted!');
        set({ expenses: get().expenses.filter(e => e.expense_id !== expenseId) });
        invalidateCaches(['expenses', 'summary']);
        get().refreshSummary();

        const settings = get().settings;
        enqueueSyncJob('deleteExpense', {
          expense_id: expenseId,
          sheetsIdExpense: settings.sheetsIdExpense
        }, `del_exp_${expenseId}`);

        return true;
      }
      return false;
    } catch {
      toast.error('खर्च हटवण्यास अडचण / Delete error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ─── DAILY SPREADSHEETS ADMIN ─────────────────────────────────────

  /**
   * Load daily spreadsheet list from GAS.
   */
  loadDailySpreadsheets: async () => {
    try {
      const res = await callAPI('getDailySpreadsheetAdmin');
      if (res.success) {
        set({ dailySpreadsheets: res.data || [], dailySheetsLoaded: true });
        // Also persist to Firestore for offline access
        if (res.data && res.data.length > 0) {
          for (const sheet of res.data.slice(0, 50)) {
            try {
              await saveDailySpreadsheetMapping(sheet);
            } catch (err) {
              console.warn('Firestore save mapping warning:', err);
            }
          }
        }
        return res;
      }
      return res;
    } catch (e) {
      console.error('loadDailySpreadsheets error:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Get info about a specific date's spreadsheet.
   */
  getDailySpreadsheetInfo: async (dateStr) => {
    try {
      return await callAPI('getDailySpreadsheetInfo', { date: dateStr });
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Re-sync a specific date's daily spreadsheet.
   */
  resyncDailySpreadsheet: async (dateStr) => {
    try {
      const res = await callAPI('resyncDailySpreadsheet', { date: dateStr });
      if (res.success) {
        toast.success(res.message || 'Re-sync complete');
        // Refresh daily sheets list
        get().loadDailySpreadsheets();
      } else {
        toast.error(res.message || 'Re-sync failed');
      }
      return res;
    } catch (e) {
      toast.error('Re-sync error: ' + e.message);
      return { success: false, error: e.message };
    }
  },

  /**
   * Verify a specific date's daily spreadsheet consistency.
   */
  verifyDailySpreadsheet: async (dateStr) => {
    try {
      return await callAPI('verifyDailySpreadsheet', { date: dateStr });
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Run migration of historical data to daily spreadsheets.
   */
  migrateToDailySpreadsheets: async (batchSize) => {
    try {
      const res = await callAPI('migrateToDailySpreadsheets', { batchSize: batchSize || 20 });
      if (res.success) {
        toast.success(res.message || 'Migration batch complete');
        get().loadDailySpreadsheets();
      } else {
        toast.error(res.message || 'Migration failed');
      }
      return res;
    } catch (e) {
      toast.error('Migration error: ' + e.message);
      return { success: false, error: e.message };
    }
  },

  /**
   * Prepare today's daily spreadsheet proactively.
   */
  prepareDailySpreadsheet: async () => {
    try {
      const res = await callAPI('prepareDailySpreadsheet');
      if (res.success) {
        toast.success(res.message || 'Daily spreadsheet ready');
        get().loadDailySpreadsheets();
      }
      return res;
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ─── SETTINGS ─────────────────────────────────────────────────────

  saveSettings: async (newSettings) => {
    set({ loading: true });
    try {
      // Save to Firestore
      const res = await FS.saveSettings(newSettings);
      if (res.success) {
        toast.success('सेटिंग्ज जतन झाल्या / Settings saved!');
        set({ settings: newSettings });
        setCached('settings', newSettings);
        // Background sync to GAS
        enqueueSyncJob('updateSettings', newSettings, `settings_${Date.now()}`);
        return true;
      }
      return false;
    } catch {
      toast.error('सेटिंग्ज जतन करता आल्या नाहीत / Settings error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ─── DATABASE RESET ───────────────────────────────────────────────

  clearAllTransactions: async () => {
    set({ loading: true });
    try {
      // Clear Google Sheets via GAS
      const settings = get().settings;
      await callAPI('clearTransactions', {
        clearMaster: true,
        sheetsIdCollection: settings.sheetsIdCollection,
        sheetsIdCustomer: settings.sheetsIdCustomer,
        sheetsIdExpense: settings.sheetsIdExpense
      });

      // Clear Firestore regardless of GAS result
      const collectionNames = ['collections', 'sales', 'expenses', 'farmers', 'customers', 'products'];
      const deletePromises = [];

      for (const colName of collectionNames) {
        try {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
        } catch (e) {
          console.error(`Failed to read ${colName} for deletion:`, e);
        }
      }

      // Seed default products
      const defaultProducts = [
        { product_id: "P001", product_name: "Milk Packet 500ml", category: "Milk", unit_price: 30, status: "Active", updated_at: new Date().toISOString() },
        { product_id: "P002", product_name: "Milk Packet 1L", category: "Milk", unit_price: 62, status: "Active", updated_at: new Date().toISOString() },
        { product_id: "P003", product_name: "Curd Cup 200g", category: "Curd", unit_price: 25, status: "Active", updated_at: new Date().toISOString() },
        { product_id: "P004", product_name: "Curd Packet 500g", category: "Curd", unit_price: 55, status: "Active", updated_at: new Date().toISOString() },
        { product_id: "P005", product_name: "Paneer 200g", category: "Paneer", unit_price: 85, status: "Active", updated_at: new Date().toISOString() },
        { product_id: "P006", product_name: "Butter 100g", category: "Butter", unit_price: 55, status: "Active", updated_at: new Date().toISOString() },
        { product_id: "P007", product_name: "Ghee 1L", category: "Ghee", unit_price: 650, status: "Active", updated_at: new Date().toISOString() }
      ];
      defaultProducts.forEach(p => deletePromises.push(setDoc(doc(db, 'products', p.product_id), p)));
      await Promise.allSettled(deletePromises);

      // Clear all caches
      clearAllCache();

      // Reload fresh
      await get().loadAllData();
      return { success: true };
    } catch (e) {
      console.error('clearAllTransactions failed:', e);
      return { success: false, message: e.message };
    } finally {
      set({ loading: false });
    }
  }
}));

// ─── Firebase Authentication State Observer ─────────────────────────

onAuthStateChanged(auth, async (firebaseUser) => {
  const store = useAppStore.getState();
  if (firebaseUser) {
    store.setLoadingAuth(true);
    try {
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData && userData.name === 'Ravi Patil') {
          userData.name = 'Chaitanya Dhaware';
          try {
            await setDoc(docRef, { name: 'Chaitanya Dhaware' }, { merge: true });
          } catch (err) {
            console.error('Failed to auto-update admin name in Firestore:', err);
          }
        }
        store.setUser(userData);
      } else {
        // Fallback or Auto-seed for demo testing
        const fallbackUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.email.split('@')[0],
          role: firebaseUser.email.includes('admin') ? 'admin' : 
                (firebaseUser.email.includes('accountant') ? 'accountant' : 'staff'),
          active: true,
          email: firebaseUser.email
        };
        // Save to Firestore
        await setDoc(docRef, fallbackUser);
        store.setUser(fallbackUser);
      }

      // Initialize sync queue for background Google Sheets sync
      initSyncQueue();

      // Load data from Firestore (fast, no GAS calls!)
      await store.loadAllData();
    } catch (e) {
      console.error('Firebase profile sync error:', e);
      // Failover to offline profile
      store.setUser({
        uid: firebaseUser.uid,
        name: firebaseUser.email.split('@')[0],
        role: 'admin',
        active: true,
        email: firebaseUser.email
      });
    } finally {
      store.setLoadingAuth(false);
    }
  } else {
    const saved = localStorage.getItem('GAUDAI_USER_SESSION');
    if (saved) {
      try {
        const savedUser = JSON.parse(saved);
        store.setUser(savedUser);
        initSyncQueue();
        await store.loadAllData();
      } catch (e) {
        console.error('Error restoring session from localStorage:', e);
        store.setUser(null);
      }
    } else {
      store.setUser(null);
    }
    store.setLoadingAuth(false);
  }
});
