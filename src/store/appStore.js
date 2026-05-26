import { create } from 'zustand';
import { callAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

  // Caching lists
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

  // Load configuration and cached entries
  loadAllData: async () => {
    set({ loading: true });
    try {
      const settingsRes = await callAPI('getSettings');
      if (settingsRes.success) {
        set({ settings: settingsRes.data });
      }

      const settings = get().settings;
      const [farmersRes, productsRes, customersRes, collectionsRes, salesRes, expensesRes, summaryRes, cashflowRes] = await Promise.all([
        callAPI('getFarmerList'),
        callAPI('getProductList'),
        callAPI('getCustomerList'),
        callAPI('getCollectionEntries', { sheetsIdCollection: settings.sheetsIdCollection }),
        callAPI('getSalesHistory', { sheetsIdCustomer: settings.sheetsIdCustomer }),
        callAPI('getExpenses', { sheetsIdExpense: settings.sheetsIdExpense }),
        callAPI('getMasterFinancialSummary', {
          sheetsIdCollection: settings.sheetsIdCollection,
          sheetsIdCustomer: settings.sheetsIdCustomer,
          sheetsIdExpense: settings.sheetsIdExpense,
          sheetsIdMaster: settings.sheetsIdMaster
        }),
        callAPI('getCashFlowStatement', {
          sheetsIdCollection: settings.sheetsIdCollection,
          sheetsIdCustomer: settings.sheetsIdCustomer,
          sheetsIdExpense: settings.sheetsIdExpense,
          sheetsIdMaster: settings.sheetsIdMaster
        })
      ]);

      set({
        farmers: farmersRes.success ? farmersRes.data : [],
        products: productsRes.success ? productsRes.data : [],
        customers: customersRes.success ? customersRes.data : [],
        collections: collectionsRes.success ? collectionsRes.data : [],
        sales: salesRes.success ? salesRes.data : [],
        expenses: expensesRes.success ? expensesRes.data : [],
        todaySummary: summaryRes.success ? summaryRes.data : get().todaySummary,
        cashFlow: cashflowRes.success ? cashflowRes.data : []
      });
    } catch (e) {
      console.error('Failed to load data:', e);
      toast.error('डेटा लोड करण्यास अडचण आली / Failed loading data');
    } finally {
      set({ loading: false });
    }
  },

  // Refresh dynamic summaries (P&L and Cashflow)
  refreshSummary: async () => {
    try {
      const settings = get().settings;
      const [summaryRes, cashflowRes] = await Promise.all([
        callAPI('getMasterFinancialSummary', {
          sheetsIdCollection: settings.sheetsIdCollection,
          sheetsIdCustomer: settings.sheetsIdCustomer,
          sheetsIdExpense: settings.sheetsIdExpense,
          sheetsIdMaster: settings.sheetsIdMaster
        }),
        callAPI('getCashFlowStatement', {
          sheetsIdCollection: settings.sheetsIdCollection,
          sheetsIdCustomer: settings.sheetsIdCustomer,
          sheetsIdExpense: settings.sheetsIdExpense,
          sheetsIdMaster: settings.sheetsIdMaster
        })
      ]);
      set({
        todaySummary: summaryRes.success ? summaryRes.data : get().todaySummary,
        cashFlow: cashflowRes.success ? cashflowRes.data : get().cashFlow
      });
    } catch (err) {
      console.error(err);
    }
  },

  // Farmer CRUD
  registerFarmer: async (data) => {
    set({ loading: true });
    try {
      const res = await callAPI('registerFarmer', data);
      if (res.success) {
        toast.success('शेतकरी नोंदणी यशस्वी / Farmer registered!');
        // Reload farmer cache
        const updated = await callAPI('getFarmerList');
        if (updated.success) set({ farmers: updated.data });
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

  // Collection CRUD
  addMilkCollection: async (data) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      // Inject calculated rate in payload
      const rate = data.fat * settings.baseRate;
      const totalAmount = rate * data.quantity;
      const dueAmount = totalAmount - data.paidAmount;

      const payload = {
        ...data,
        calculated_rate: rate,
        total_amount: totalAmount,
        due_amount: dueAmount,
        sheetsIdCollection: settings.sheetsIdCollection
      };

      const res = await callAPI('addMilkCollection', payload);
      if (res.success) {
        toast.success('दूध नोंद जतन झाली / Collection added!');
        
        // Reload related caches
        const [updatedCol, updatedFar, updatedSum] = await Promise.all([
          callAPI('getCollectionEntries', { sheetsIdCollection: settings.sheetsIdCollection }),
          callAPI('getFarmerList'),
          callAPI('getMasterFinancialSummary', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          })
        ]);
        if (updatedCol.success) set({ collections: updatedCol.data });
        if (updatedFar.success) set({ farmers: updatedFar.data });
        if (updatedSum.success) set({ todaySummary: updatedSum.data });

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

  markFarmerPaid: async (entryId) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await callAPI('markFarmerPaid', { entryId, sheetsIdCollection: settings.sheetsIdCollection });
      if (res.success) {
        toast.success('पेमेंट यशस्वी / Payment marked paid!');
        const [updatedCol, updatedFar, updatedSum] = await Promise.all([
          callAPI('getCollectionEntries', { sheetsIdCollection: settings.sheetsIdCollection }),
          callAPI('getFarmerList'),
          callAPI('getMasterFinancialSummary', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          })
        ]);
        if (updatedCol.success) set({ collections: updatedCol.data });
        if (updatedFar.success) set({ farmers: updatedFar.data });
        if (updatedSum.success) set({ todaySummary: updatedSum.data });
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

  // Customer CRUD
  addCustomer: async (data) => {
    set({ loading: true });
    try {
      const res = await callAPI('addCustomer', data);
      if (res.success) {
        toast.success('ग्राहक यशस्वी नोंदवला / Customer added!');
        const updated = await callAPI('getCustomerList');
        if (updated.success) set({ customers: updated.data });
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

  addProduct: async (data) => {
    set({ loading: true });
    try {
      const res = await callAPI('addProduct', data);
      if (res.success) {
        toast.success('उत्पादन यशस्वी जोडले / Product added!');
        const updated = await callAPI('getProductList');
        if (updated.success) set({ products: updated.data });
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

  updateProduct: async (productId, data) => {
    set({ loading: true });
    try {
      const res = await callAPI('updateProduct', { product_id: productId, data });
      if (res.success) {
        toast.success('दर सुधारित केला / Product updated!');
        const updated = await callAPI('getProductList');
        if (updated.success) set({ products: updated.data });
        return true;
      }
      return false;
    } catch {
      toast.error('दर बदल जतन झाला नाही / Price update error');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  addSale: async (data) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await callAPI('addSale', { ...data, sheetsIdCustomer: settings.sheetsIdCustomer });
      if (res.success) {
        toast.success('बिल जतन झाले / Bill saved!');
        const [updatedSal, updatedCust, updatedSum] = await Promise.all([
          callAPI('getSalesHistory', { sheetsIdCustomer: settings.sheetsIdCustomer }),
          callAPI('getCustomerList'),
          callAPI('getMasterFinancialSummary', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          })
        ]);
        if (updatedSal.success) set({ sales: updatedSal.data });
        if (updatedCust.success) set({ customers: updatedCust.data });
        if (updatedSum.success) set({ todaySummary: updatedSum.data });
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
      const settings = get().settings;
      const res = await callAPI('recordPayment', { customer_id: customerId, amount, sheetsIdCustomer: settings.sheetsIdCustomer });
      if (res.success) {
        toast.success('देयक नोंद यशस्वी / Payment recorded!');
        const [updatedCust, updatedSal, updatedSum] = await Promise.all([
          callAPI('getCustomerList'),
          callAPI('getSalesHistory', { sheetsIdCustomer: settings.sheetsIdCustomer }),
          callAPI('getMasterFinancialSummary', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          })
        ]);
        if (updatedCust.success) set({ customers: updatedCust.data });
        if (updatedSal.success) set({ sales: updatedSal.data });
        if (updatedSum.success) set({ todaySummary: updatedSum.data });
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

  // Expense CRUD
  addExpense: async (data) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await callAPI('addExpense', { ...data, sheetsIdExpense: settings.sheetsIdExpense });
      if (res.success) {
        toast.success('खर्च नोंदवला / Expense added!');
        const [updatedExp, updatedSum] = await Promise.all([
          callAPI('getExpenses', { sheetsIdExpense: settings.sheetsIdExpense }),
          callAPI('getMasterFinancialSummary', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          })
        ]);
        if (updatedExp.success) set({ expenses: updatedExp.data });
        if (updatedSum.success) set({ todaySummary: updatedSum.data });
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
      const settings = get().settings;
      const res = await callAPI('deleteExpense', { expense_id: expenseId, sheetsIdExpense: settings.sheetsIdExpense });
      if (res.success) {
        toast.success('खर्च हटवला / Expense deleted!');
        const [updatedExp, updatedSum] = await Promise.all([
          callAPI('getExpenses', { sheetsIdExpense: settings.sheetsIdExpense }),
          callAPI('getMasterFinancialSummary', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          })
        ]);
        if (updatedExp.success) set({ expenses: updatedExp.data });
        if (updatedSum.success) set({ todaySummary: updatedSum.data });
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

  // Settings update
  saveSettings: async (newSettings) => {
    set({ loading: true });
    try {
      const res = await callAPI('updateSettings', newSettings);
      if (res.success) {
        toast.success('सेटिंग्ज जतन झाल्या / Settings saved!');
        set({ settings: newSettings });
        return true;
      }
      return false;
    } catch {
      toast.error('सेटिंग्ज जतन करता आल्या नाहीत / Settings error');
      return false;
    } finally {
      set({ loading: false });
    }
  }
}));

// Firebase Authentication State Observer
onAuthStateChanged(auth, async (firebaseUser) => {
  const store = useAppStore.getState();
  if (firebaseUser) {
    store.setLoadingAuth(true);
    try {
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        store.setUser(docSnap.data());
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

