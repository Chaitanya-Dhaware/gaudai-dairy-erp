import { create } from 'zustand';
import { callAPI, readFromFirestore } from '../utils/api';
import toast from 'react-hot-toast';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

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
      
      // Try batch load first for ultra-fast startup
      const batchRes = await callAPI('batchLoadData', {
        sheetsIdCollection: settings.sheetsIdCollection,
        sheetsIdCustomer: settings.sheetsIdCustomer,
        sheetsIdExpense: settings.sheetsIdExpense,
        sheetsIdMaster: settings.sheetsIdMaster
      });

      if (batchRes && batchRes.success && batchRes.data) {
        const d = batchRes.data;

        // Check Firestore backup to detect if Sheets is out of sync/empty
        const [backupFarmers, backupCollections, backupCustomers, backupProducts, backupSales, backupExpenses] = await Promise.all([
          readFromFirestore('getFarmerList'),
          readFromFirestore('getCollectionEntries'),
          readFromFirestore('getCustomerList'),
          readFromFirestore('getProductList'),
          readFromFirestore('getSalesHistory'),
          readFromFirestore('getExpenses')
        ]).catch(() => [null, null, null, null, null, null]);

        const appScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL || '';
        const isMockMode = !appScriptUrl || appScriptUrl.includes('placeholder');

        const mergeLists = (fsList, gsList, idKey) => {
          const fsItems = fsList || [];
          const gsItems = gsList || [];
          const merged = [...fsItems];
          gsItems.forEach(gs => {
            if (!merged.some(fs => fs[idKey] === gs[idKey])) {
              merged.push(gs);
            }
          });
          return merged;
        };

        const fsFarmers = (!isMockMode && backupFarmers && backupFarmers.success) ? backupFarmers.data : [];
        const fsProducts = (!isMockMode && backupProducts && backupProducts.success) ? backupProducts.data : [];
        const fsCustomers = (!isMockMode && backupCustomers && backupCustomers.success) ? backupCustomers.data : [];
        const fsCollections = (!isMockMode && backupCollections && backupCollections.success) ? backupCollections.data : [];
        const fsSales = (!isMockMode && backupSales && backupSales.success) ? backupSales.data : [];
        const fsExpenses = (!isMockMode && backupExpenses && backupExpenses.success) ? backupExpenses.data : [];

        // Check if there are any missing entries in Sheets compared to Firestore
        const missingFarmers = isMockMode ? [] : fsFarmers.filter(bf => !d.farmers.some(sf => sf.farmer_id === bf.farmer_id));
        const missingCollections = isMockMode ? [] : fsCollections.filter(bc => !d.collections.some(sc => sc.entry_id === bc.entry_id));
        const missingCustomers = isMockMode ? [] : fsCustomers.filter(bc => !d.customers.some(sc => sc.customer_id === bc.customer_id));
        const missingProducts = isMockMode ? [] : fsProducts.filter(bp => !d.products.some(sp => sp.product_id === bp.product_id));
        const missingSales = isMockMode ? [] : fsSales.filter(bs => !d.sales.some(ss => ss.bill_id === bs.bill_id));
        const missingExpenses = isMockMode ? [] : fsExpenses.filter(be => !d.expenses.some(se => se.expense_id === be.expense_id));



        const needsSync = 
          missingFarmers.length > 0 ||
          missingCollections.length > 0 ||
          missingCustomers.length > 0 ||
          missingProducts.length > 0 ||
          missingSales.length > 0 ||
          missingExpenses.length > 0;

        if (needsSync) {
          const isMarathi = localStorage.getItem('i18nextLng') === 'mr';
          toast.loading(isMarathi ? 'डेटा गुगल शीटमध्ये सिंक करत आहे...' : 'Syncing backup data to Google Sheets...');
          await callAPI('importBackupData', {
            farmers: missingFarmers,
            collections: missingCollections,
            customers: missingCustomers,
            products: missingProducts,
            sales: missingSales,
            expenses: missingExpenses,
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense
          });
          toast.dismiss();
          toast.success(isMarathi ? 'गुगल शीट सिंक यशस्वी!' : 'Google Sheets sync completed!');
          
          // Re-fetch optimized batch data
          const reBatchRes = await callAPI('batchLoadData', {
            sheetsIdCollection: settings.sheetsIdCollection,
            sheetsIdCustomer: settings.sheetsIdCustomer,
            sheetsIdExpense: settings.sheetsIdExpense,
            sheetsIdMaster: settings.sheetsIdMaster
          });
          if (reBatchRes && reBatchRes.success && reBatchRes.data) {
            const rd = reBatchRes.data;
            set({
              farmers: mergeLists(fsFarmers, rd.farmers, 'farmer_id'),
              products: mergeLists(fsProducts, rd.products, 'product_id'),
              customers: mergeLists(fsCustomers, rd.customers, 'customer_id'),
              collections: rd.collections || [],
              sales: rd.sales || [],
              expenses: rd.expenses || [],
              todaySummary: rd.summary || get().todaySummary,
              cashFlow: rd.cashFlow || []
            });
            return;
          }
        }

        const farmersData = mergeLists(fsFarmers, d.farmers, 'farmer_id');
        const productsData = mergeLists(fsProducts, d.products, 'product_id');
        const customersData = mergeLists(fsCustomers, d.customers, 'customer_id');

        set({
          farmers: farmersData,
          products: productsData,
          customers: customersData,
          collections: d.collections || [],
          sales: d.sales || [],
          expenses: d.expenses || [],
          todaySummary: d.summary || get().todaySummary,
          cashFlow: d.cashFlow || []
        });
      } else {
        // Fallback to legacy parallel fetches if batch fails
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
      }
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
      const paidVal = data.paid_amount !== undefined ? data.paid_amount : (data.paidAmount !== undefined ? data.paidAmount : 0);
      const rate = data.fat * settings.baseRate;
      const totalAmount = rate * data.quantity;
      const dueAmount = totalAmount - paidVal;

      const payload = {
        ...data,
        paid_amount: paidVal,
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

  markFarmerPaid: async (entryId, amount) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await callAPI('markFarmerPaid', { entryId, amount, sheetsIdCollection: settings.sheetsIdCollection });
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

  deleteFarmer: async (farmerId) => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await callAPI('deleteFarmer', { farmer_id: farmerId, sheetsIdCollection: settings.sheetsIdCollection });
      if (res.success) {
        toast.success(localStorage.getItem('i18nextLng') === 'mr' ? 'शेतकरी हटवला!' : 'Farmer deleted!');
        const updatedFarmers = await callAPI('getFarmerList');
        if (updatedFarmers.success) set({ farmers: updatedFarmers.data });
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
  },

  clearAllTransactions: async () => {
    set({ loading: true });
    try {
      const settings = get().settings;
      const res = await callAPI('clearTransactions', {
        clearMaster: true,
        sheetsIdCollection: settings.sheetsIdCollection,
        sheetsIdCustomer: settings.sheetsIdCustomer,
        sheetsIdExpense: settings.sheetsIdExpense
      });

      if (res && res.success) {
        const appScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL || '';
        const isMockMode = !appScriptUrl || appScriptUrl.includes('placeholder');

        if (!isMockMode) {
          const collectionsSnap = await getDocs(collection(db, 'collections')).catch(() => ({ docs: [] }));
          const salesSnap = await getDocs(collection(db, 'sales')).catch(() => ({ docs: [] }));
          const expensesSnap = await getDocs(collection(db, 'expenses')).catch(() => ({ docs: [] }));
          const farmersSnap = await getDocs(collection(db, 'farmers')).catch(() => ({ docs: [] }));
          const customersSnap = await getDocs(collection(db, 'customers')).catch(() => ({ docs: [] }));
          const productsSnap = await getDocs(collection(db, 'products')).catch(() => ({ docs: [] }));

          // Delete Firestore records
          const deletePromises = [];
          collectionsSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          salesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          expensesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          farmersSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          customersSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          productsSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));

          // Seed default products back to Firestore
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

          // Resilient delete that ignores isolated timeout errors
          await Promise.allSettled(deletePromises);
        } else {
          // Mock mode local storage reset
          localStorage.removeItem('GAUDAI_COLLECTIONS');
          localStorage.removeItem('GAUDAI_SALES');
          localStorage.removeItem('GAUDAI_EXPENSES');
          localStorage.removeItem('GAUDAI_FARMERS');
          localStorage.removeItem('GAUDAI_CUSTOMERS');
          localStorage.removeItem('GAUDAI_PRODUCTS');
          localStorage.setItem('GAUDAI_COLLECTIONS', '[]');
          localStorage.setItem('GAUDAI_SALES', '[]');
          localStorage.setItem('GAUDAI_EXPENSES', '[]');
          localStorage.setItem('GAUDAI_FARMERS', '[]');
          localStorage.setItem('GAUDAI_CUSTOMERS', '[]');

          const defaultProducts = [
            { product_id: "P001", product_name: "Milk Packet 500ml", category: "Milk", unit_price: 30, status: "Active", updated_at: new Date().toISOString() },
            { product_id: "P002", product_name: "Milk Packet 1L", category: "Milk", unit_price: 62, status: "Active", updated_at: new Date().toISOString() },
            { product_id: "P003", product_name: "Curd Cup 200g", category: "Curd", unit_price: 25, status: "Active", updated_at: new Date().toISOString() },
            { product_id: "P004", product_name: "Curd Packet 500g", category: "Curd", unit_price: 55, status: "Active", updated_at: new Date().toISOString() },
            { product_id: "P005", product_name: "Paneer 200g", category: "Paneer", unit_price: 85, status: "Active", updated_at: new Date().toISOString() },
            { product_id: "P006", product_name: "Butter 100g", category: "Butter", unit_price: 55, status: "Active", updated_at: new Date().toISOString() },
            { product_id: "P007", product_name: "Ghee 1L", category: "Ghee", unit_price: 650, status: "Active", updated_at: new Date().toISOString() }
          ];
          localStorage.setItem('GAUDAI_PRODUCTS', JSON.stringify(defaultProducts));
        }

        // Reload cache locally
        await get().loadAllData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('clearAllTransactions failed:', e);
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

