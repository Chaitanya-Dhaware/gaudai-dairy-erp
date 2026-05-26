// API Connector for Google Apps Script Backend
// If APPS_SCRIPT_URL is not set or contains "placeholder", falls back to LocalStorage Mock DB for instant demo capability.

import { db } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const IS_MOCK_MODE = !APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('placeholder');

// Helper to simulate network latency
const delay = (ms) => {
  if (typeof globalThis.process !== 'undefined' && globalThis.process.env?.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Mock Database Initializer
const initMockDB = () => {
  if (!localStorage.getItem('GAUDAI_DB_INITIALIZED')) {
    // Seed default farmers
    const farmers = [
      { farmer_id: 'F-204', name: 'Rajesh Gaikwad', mobile: '9876543210', address: 'Wadgaon Village', milk_type: 'Buffalo', current_due: 25 },
      { farmer_id: 'F-201', name: 'Anil Deshmukh', mobile: '8877665544', address: 'Shivajinagar', milk_type: 'Cow', current_due: 344 },
      { farmer_id: 'F-198', name: 'Suresh Patil', mobile: '9988776655', address: 'Koregaon', milk_type: 'Mixed', current_due: 645 }
    ];

    // Seed default products
    const products = [
      { product_id: 'P001', product_name: 'Full Cream Milk 1L', category: 'Milk', unit_price: 64, status: 'Active' },
      { product_id: 'P002', product_name: 'Standard Milk 1L', category: 'Milk', unit_price: 52, status: 'Active' },
      { product_id: 'P003', product_name: 'Fresh Curd 1kg', category: 'Curd', unit_price: 90, status: 'Active' },
      { product_id: 'P004', product_name: 'Cow Ghee 1kg', category: 'Other', unit_price: 650, status: 'Active' },
      { product_id: 'P005', product_name: 'Buffalo Ghee 1kg', category: 'Other', unit_price: 720, status: 'Active' },
      { product_id: 'P006', product_name: 'Lassi Cup 200ml', category: 'Lassi', unit_price: 20, status: 'Active' }
    ];

    // Seed default customers
    const customers = [
      { customer_id: 'C001', shop_name: 'Rajesh Deshmukh', owner_name: 'Rajesh Deshmukh', mobile: '9422012345', address: 'Satara District', current_due: 12450 },
      { customer_id: 'C002', shop_name: 'Rahul Dairy', owner_name: 'Rahul Patil', mobile: '9890123456', address: 'Pune Bypass Road', current_due: 2200 },
      { customer_id: 'C003', shop_name: 'Krishna Sweets', owner_name: 'Madhav Shinde', mobile: '9763221100', address: 'Main Bazar', current_due: 0 }
    ];

    // Seed default milk collections
    const collections = [
      { entry_id: 'E001', farmer_id: 'F-204', date: '2026-05-25', milk_type: 'Buffalo', quantity: 12.5, fat: 6.5, snf: 9.0, calculated_rate: 42.0, total_amount: 525, paid_amount: 500, due_amount: 25, status: 'Partial', timestamp: new Date().toISOString() },
      { entry_id: 'E002', farmer_id: 'F-201', date: '2026-05-25', milk_type: 'Cow', quantity: 8.2, fat: 4.5, snf: 8.5, calculated_rate: 42.0, total_amount: 344, paid_amount: 0, due_amount: 344, status: 'Pending', timestamp: new Date().toISOString() },
      { entry_id: 'E003', farmer_id: 'F-198', date: '2026-05-25', milk_type: 'Mixed', quantity: 15.0, fat: 5.0, snf: 8.8, calculated_rate: 43.0, total_amount: 645, paid_amount: 0, due_amount: 645, status: 'Pending', timestamp: new Date().toISOString() }
    ];

    // Seed default sales
    const sales = [
      { bill_id: 'B001', customer_id: 'C001', date: '2026-05-25', items: [{ product_id: 'P001', product_name: 'Full Cream Milk 1L', quantity: 10, unit_price: 64, total: 640 }], total_amount: 640, paid_amount: 640, due_amount: 0, status: 'Paid', timestamp: new Date().toISOString() },
      { bill_id: 'B002', customer_id: 'C001', date: '2026-05-24', items: [{ product_id: 'P001', product_name: 'Full Cream Milk 1L', quantity: 200, unit_price: 62, total: 12400 }], total_amount: 12400, paid_amount: 0, due_amount: 12450, status: 'Pending', timestamp: new Date().toISOString() }
    ];

    // Seed default expenses
    const expenses = [
      { expense_id: 'EXP001', date: '2026-05-25', reason: 'Dry Fodder (Wheat Straw)', amount: 8200, category: 'Supplies', payment_method: 'Cash', notes: 'Monthly cattle feed replenishment', timestamp: new Date().toISOString() },
      { expense_id: 'EXP002', date: '2026-05-25', reason: 'Tanker Diesel Refill', amount: 3150, category: 'Fuel', payment_method: 'UPI', notes: 'Diesel for transport tanker', timestamp: new Date().toISOString() },
      { expense_id: 'EXP003', date: '2026-05-25', reason: 'Vaccination - Batch A', amount: 1100, category: 'Maintenance', payment_method: 'Cash', notes: 'Veterinary support fees', timestamp: new Date().toISOString() }
    ];

    localStorage.setItem('GAUDAI_FARMERS', JSON.stringify(farmers));
    localStorage.setItem('GAUDAI_PRODUCTS', JSON.stringify(products));
    localStorage.setItem('GAUDAI_CUSTOMERS', JSON.stringify(customers));
    localStorage.setItem('GAUDAI_COLLECTIONS', JSON.stringify(collections));
    localStorage.setItem('GAUDAI_SALES', JSON.stringify(sales));
    localStorage.setItem('GAUDAI_EXPENSES', JSON.stringify(expenses));
    localStorage.setItem('GAUDAI_SETTINGS', JSON.stringify({ baseRate: 8.5, businessName: 'Gaudai AI Dairy' }));
    localStorage.setItem('GAUDAI_DB_INITIALIZED', 'true');
  }
};

initMockDB();

// Mock DB helper get/set
const getMockData = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setMockData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// Sync successful write actions to Firestore backup
async function syncWriteToFirestore(action, responseData, payload) {
  if (!db || !responseData || !responseData.success) return;

  try {
    switch (action) {
      case 'registerFarmer': {
        const farmer = responseData.data;
        if (farmer && farmer.farmer_id) {
          await setDoc(doc(db, 'farmers', farmer.farmer_id), farmer);
        }
        break;
      }
      case 'addMilkCollection': {
        const entry = responseData.data;
        if (entry && entry.entry_id) {
          await setDoc(doc(db, 'collections', entry.entry_id), entry);
          // Also update the farmer's current_due in Firestore
          const farmerRef = doc(db, 'farmers', entry.farmer_id);
          const farmerSnap = await getDoc(farmerRef);
          if (farmerSnap.exists()) {
            const currentDue = (farmerSnap.data().current_due || 0) + entry.due_amount;
            await updateDoc(farmerRef, { current_due: currentDue });
          }
        }
        break;
      }
      case 'markFarmerPaid': {
        const entryId = payload.entry_id || payload.entryId;
        if (entryId) {
          const entryRef = doc(db, 'collections', entryId);
          const entrySnap = await getDoc(entryRef);
          if (entrySnap.exists()) {
            const entry = entrySnap.data();
            const oldDue = entry.due_amount;
            await updateDoc(entryRef, {
              paid_amount: entry.paid_amount + oldDue,
              due_amount: 0,
              status: 'Paid'
            });
            // Update farmer
            const farmerRef = doc(db, 'farmers', entry.farmer_id);
            const farmerSnap = await getDoc(farmerRef);
            if (farmerSnap.exists()) {
              const currentDue = Math.max(0, (farmerSnap.data().current_due || 0) - oldDue);
              await updateDoc(farmerRef, { current_due: currentDue });
            }
          }
        }
        break;
      }
      case 'addCustomer': {
        const customer = responseData.data;
        if (customer && customer.customer_id) {
          await setDoc(doc(db, 'customers', customer.customer_id), customer);
        }
        break;
      }
      case 'addProduct': {
        const product = responseData.data;
        if (product && product.product_id) {
          await setDoc(doc(db, 'products', product.product_id), product);
        }
        break;
      }
      case 'updateProduct': {
        const productId = payload.product_id;
        const updateData = payload.data;
        if (productId && updateData) {
          await setDoc(doc(db, 'products', productId), updateData, { merge: true });
        }
        break;
      }
      case 'addSale': {
        const sale = responseData.data;
        if (sale && sale.bill_id) {
          await setDoc(doc(db, 'sales', sale.bill_id), sale);
          // Update customer due
          const customerRef = doc(db, 'customers', sale.customer_id);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            const currentDue = (customerSnap.data().current_due || 0) + sale.due_amount;
            await updateDoc(customerRef, { current_due: currentDue });
          }
        }
        break;
      }
      case 'recordPayment': {
        const customerId = payload.customer_id;
        const amt = parseFloat(payload.amount);
        if (customerId && !isNaN(amt)) {
          const customerRef = doc(db, 'customers', customerId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            const currentDue = Math.max(0, (customerSnap.data().current_due || 0) - amt);
            await updateDoc(customerRef, { current_due: currentDue });
          }
          // Also write payment sale record to Firestore
          const paymentId = `PAY${Date.now()}`;
          await setDoc(doc(db, 'sales', paymentId), {
            bill_id: paymentId,
            customer_id: customerId,
            date: new Date().toISOString().split('T')[0],
            items: [],
            total_amount: 0,
            paid_amount: amt,
            due_amount: -amt,
            status: 'Paid',
            timestamp: new Date().toISOString(),
            is_payment_record: true
          });
        }
        break;
      }
      case 'addExpense': {
        const expense = responseData.data;
        if (expense && expense.expense_id) {
          await setDoc(doc(db, 'expenses', expense.expense_id), expense);
        }
        break;
      }
      case 'deleteExpense': {
        const expenseId = payload.expense_id;
        if (expenseId) {
          await deleteDoc(doc(db, 'expenses', expenseId));
        }
        break;
      }
      case 'updateSettings': {
        await setDoc(doc(db, 'settings', 'general'), payload);
        break;
      }
    }
  } catch (err) {
    console.error('Failed to sync write to Firestore backup:', err);
  }
}

// Fetch backups from Firestore when Apps Script fails
async function readFromFirestore(action) {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    switch (action) {
      case 'getFarmerList': {
        const snap = await getDocs(collection(db, 'farmers'));
        const list = snap.docs.map(d => d.data());
        return { success: true, data: list };
      }
      case 'getProductList': {
        const snap = await getDocs(collection(db, 'products'));
        const list = snap.docs.map(d => d.data());
        return { success: true, data: list };
      }
      case 'getCustomerList': {
        const snap = await getDocs(collection(db, 'customers'));
        const list = snap.docs.map(d => d.data());
        return { success: true, data: list };
      }
      case 'getCollectionEntries': {
        const snap = await getDocs(collection(db, 'collections'));
        const list = snap.docs.map(d => d.data());
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        return { success: true, data: list };
      }
      case 'getSalesHistory': {
        const snap = await getDocs(collection(db, 'sales'));
        const list = snap.docs.map(d => d.data());
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        return { success: true, data: list };
      }
      case 'getExpenses': {
        const snap = await getDocs(collection(db, 'expenses'));
        const list = snap.docs.map(d => d.data());
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        return { success: true, data: list };
      }
      case 'getSettings': {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          return { success: true, data: docSnap.data() };
        }
        return { success: false, message: 'Settings not found' };
      }
      case 'getMasterFinancialSummary': {
        const collectionsSnap = await getDocs(collection(db, 'collections'));
        const salesSnap = await getDocs(collection(db, 'sales'));
        const expensesSnap = await getDocs(collection(db, 'expenses'));
        const customersSnap = await getDocs(collection(db, 'customers'));

        const collectionsList = collectionsSnap.docs.map(d => d.data());
        const salesList = salesSnap.docs.map(d => d.data());
        const expensesList = expensesSnap.docs.map(d => d.data());
        const customersList = customersSnap.docs.map(d => d.data());

        const today = new Date().toISOString().split('T')[0];

        const revenueToday = salesList
          .filter(s => s.date === today)
          .reduce((sum, s) => sum + s.total_amount, 0);

        const cashInToday = salesList
          .filter(s => s.date === today)
          .reduce((sum, s) => sum + s.paid_amount, 0);

        const farmerPaymentsToday = collectionsList
          .filter(c => c.date === today)
          .reduce((sum, c) => sum + c.paid_amount, 0);

        const opExpensesToday = expensesList
          .filter(e => e.date === today)
          .reduce((sum, e) => sum + e.amount, 0);

        const totalPendingDues = customersList.reduce((sum, c) => sum + (c.current_due || 0), 0);

        return {
          success: true,
          data: {
            revenueToday,
            cashInToday,
            expensesToday: farmerPaymentsToday + opExpensesToday,
            farmerPaymentsToday,
            opExpensesToday,
            pendingDues: totalPendingDues,
            netProfit: revenueToday - (farmerPaymentsToday + opExpensesToday)
          }
        };
      }
      case 'getCashFlowStatement': {
        const collectionsSnap = await getDocs(collection(db, 'collections'));
        const salesSnap = await getDocs(collection(db, 'sales'));
        const expensesSnap = await getDocs(collection(db, 'expenses'));

        const collectionsList = collectionsSnap.docs.map(d => d.data());
        const salesList = salesSnap.docs.map(d => d.data());
        const expensesList = expensesSnap.docs.map(d => d.data());

        const dates = new Set([
          ...collectionsList.map(c => c.date),
          ...salesList.map(s => s.date),
          ...expensesList.map(e => e.date)
        ]);

        let cashFlows = [];
        let balance = 100000;

        Array.from(dates).sort().forEach(d => {
          const cashIn = salesList.filter(s => s.date === d).reduce((sum, s) => sum + s.paid_amount, 0);
          const cashOutFarmers = collectionsList.filter(c => c.date === d).reduce((sum, c) => sum + c.paid_amount, 0);
          const cashOutOps = expensesList.filter(e => e.date === d).reduce((sum, e) => sum + e.amount, 0);
          const cashOut = cashOutFarmers + cashOutOps;

          const opening = balance;
          balance = opening + cashIn - cashOut;

          cashFlows.push({
            date: d,
            opening_balance: opening,
            cash_in: cashIn,
            cash_out: cashOut,
            closing_balance: balance
          });
        });

        return { success: true, data: cashFlows.reverse() };
      }
      default:
        return { success: false, message: `Read action ${action} not supported` };
    }
  } catch (err) {
    console.error(`Firestore backup read failed for action ${action}:`, err);
    return { success: false, error: err.message };
  }
}

// Core API caller
export async function callAPI(action, payload = {}) {
  let response;

  if (IS_MOCK_MODE) {
    initMockDB();
    await delay(600); // Simulate network speed
    response = handleMockAPI(action, payload);
  } else {
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        // Using text/plain avoids the CORS preflight OPTIONS request
        // that Google Apps Script cannot handle. GAS still receives valid JSON.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });

      if (!res.ok) {
        throw new Error(`Apps Script Error: ${res.statusText}`);
      }

      response = await res.json();
    } catch (error) {
      console.error('Apps Script Fetch Error, falling back to Firestore/Mock DB:', error);
      // Fallback to Firestore read backup
      if (action.startsWith('get') || action === 'getMasterFinancialSummary' || action === 'getCashFlowStatement') {
        const firestoreResponse = await readFromFirestore(action);
        if (firestoreResponse.success && firestoreResponse.data) {
          if (action === 'getSettings' && !firestoreResponse.data.baseRate) {
            // let it fallback
          } else {
            return firestoreResponse;
          }
        }
      }
      response = handleMockAPI(action, payload);
    }
  }

  // Sync writes to Firestore backup
  if (response && response.success) {
    syncWriteToFirestore(action, response, payload).catch(err => {
      console.error('Firestore async write backup failed:', err);
    });
  }

  return response;
}

// Handler for all Workspace endpoints when offline/mocking
function handleMockAPI(action, payload) {
  let farmers, collections, customers, products, sales, expenses, settings;

  switch (action) {
    // --- COLLECTION MANAGEMENT ---
    case 'registerFarmer': {
      farmers = getMockData('GAUDAI_FARMERS');
      const nextFarmerId = `F-${farmers.length + 200}`;
      const newFarmer = {
        farmer_id: nextFarmerId,
        name: payload.name,
        mobile: payload.mobile,
        address: payload.address || '',
        milk_type: payload.milk_type || 'Cow',
        current_due: 0,
        created_at: new Date().toISOString()
      };
      farmers.unshift(newFarmer);
      setMockData('GAUDAI_FARMERS', farmers);
      return { success: true, message: 'Farmer registered successfully', data: newFarmer };
    }

    case 'getFarmerList':
      return { success: true, data: getMockData('GAUDAI_FARMERS') };

    case 'addMilkCollection': {
      collections = getMockData('GAUDAI_COLLECTIONS');
      farmers = getMockData('GAUDAI_FARMERS');
      
      const newCollection = {
        entry_id: `E${collections.length + 100}`,
        farmer_id: payload.farmer_id,
        date: payload.date || new Date().toISOString().split('T')[0],
        milk_type: payload.milk_type,
        quantity: parseFloat(payload.quantity),
        fat: parseFloat(payload.fat),
        snf: parseFloat(payload.snf),
        calculated_rate: parseFloat(payload.calculated_rate),
        total_amount: parseFloat(payload.total_amount),
        paid_amount: parseFloat(payload.paid_amount),
        due_amount: parseFloat(payload.due_amount),
        status: payload.due_amount <= 0 ? 'Paid' : (payload.paid_amount > 0 ? 'Partial' : 'Pending'),
        timestamp: new Date().toISOString()
      };
      
      collections.unshift(newCollection);
      setMockData('GAUDAI_COLLECTIONS', collections);

      // Update farmer's due
      const farmerIndex = farmers.findIndex(f => f.farmer_id === payload.farmer_id);
      if (farmerIndex !== -1) {
        farmers[farmerIndex].current_due = (farmers[farmerIndex].current_due || 0) + newCollection.due_amount;
        setMockData('GAUDAI_FARMERS', farmers);
      }
      return { success: true, message: 'Collection saved successfully', data: newCollection };
    }

    case 'getCollectionEntries':
      return { success: true, data: getMockData('GAUDAI_COLLECTIONS') };

    case 'markFarmerPaid': {
      collections = getMockData('GAUDAI_COLLECTIONS');
      farmers = getMockData('GAUDAI_FARMERS');
      
      const collectionIndex = collections.findIndex(c => c.entry_id === (payload.entry_id || payload.entryId));
      if (collectionIndex !== -1) {
        const entry = collections[collectionIndex];
        const oldDue = entry.due_amount;
        entry.paid_amount += oldDue;
        entry.due_amount = 0;
        entry.status = 'Paid';
        setMockData('GAUDAI_COLLECTIONS', collections);

        // Update farmer
        const fIdx = farmers.findIndex(f => f.farmer_id === entry.farmer_id);
        if (fIdx !== -1) {
          farmers[fIdx].current_due = Math.max(0, (farmers[fIdx].current_due || 0) - oldDue);
          setMockData('GAUDAI_FARMERS', farmers);
        }
        return { success: true, message: 'Payment recorded successfully' };
      }
      return { success: false, message: 'Collection entry not found' };
    }

    // --- CUSTOMER MANAGEMENT ---
    case 'addCustomer': {
      customers = getMockData('GAUDAI_CUSTOMERS');
      const nextCustId = `C${String(customers.length + 1).padStart(3, '0')}`;
      const newCustomer = {
        customer_id: nextCustId,
        shop_name: payload.shop_name,
        owner_name: payload.owner_name,
        mobile: payload.mobile,
        address: payload.address || '',
        current_due: 0,
        created_at: new Date().toISOString()
      };
      customers.unshift(newCustomer);
      setMockData('GAUDAI_CUSTOMERS', customers);
      return { success: true, data: newCustomer };
    }

    case 'getCustomerList':
      return { success: true, data: getMockData('GAUDAI_CUSTOMERS') };

    case 'getProductList':
      return { success: true, data: getMockData('GAUDAI_PRODUCTS') };

    case 'addProduct': {
      products = getMockData('GAUDAI_PRODUCTS');
      const nextProdId = `P${String(products.length + 1).padStart(3, '0')}`;
      const newProduct = {
        product_id: nextProdId,
        product_name: payload.product_name,
        category: payload.category,
        unit_price: parseFloat(payload.unit_price),
        status: payload.status || 'Active',
        updated_at: new Date().toISOString()
      };
      products.push(newProduct);
      setMockData('GAUDAI_PRODUCTS', products);
      return { success: true, data: newProduct };
    }

    case 'updateProduct': {
      products = getMockData('GAUDAI_PRODUCTS');
      const prodIdx = products.findIndex(p => p.product_id === payload.product_id);
      if (prodIdx !== -1) {
        products[prodIdx] = { ...products[prodIdx], ...payload.data, updated_at: new Date().toISOString() };
        setMockData('GAUDAI_PRODUCTS', products);
        return { success: true, data: products[prodIdx] };
      }
      return { success: false, message: 'Product not found' };
    }

    case 'addSale': {
      sales = getMockData('GAUDAI_SALES');
      customers = getMockData('GAUDAI_CUSTOMERS');

      const newSale = {
        bill_id: `B${sales.length + 100}`,
        customer_id: payload.customer_id,
        date: payload.date || new Date().toISOString().split('T')[0],
        items: payload.items,
        total_amount: parseFloat(payload.total_amount),
        paid_amount: parseFloat(payload.paid_amount),
        due_amount: parseFloat(payload.due_amount),
        status: payload.due_amount <= 0 ? 'Paid' : (payload.paid_amount > 0 ? 'Partial' : 'Pending'),
        timestamp: new Date().toISOString()
      };

      sales.unshift(newSale);
      setMockData('GAUDAI_SALES', sales);

      // Update customer due
      const custIdx = customers.findIndex(c => c.customer_id === payload.customer_id);
      if (custIdx !== -1) {
        customers[custIdx].current_due = (customers[custIdx].current_due || 0) + newSale.due_amount;
        setMockData('GAUDAI_CUSTOMERS', customers);
      }
      return { success: true, data: newSale };
    }

    case 'recordPayment': {
      customers = getMockData('GAUDAI_CUSTOMERS');
      const cIdx = customers.findIndex(c => c.customer_id === payload.customer_id);
      if (cIdx !== -1) {
        const amt = parseFloat(payload.amount);
        customers[cIdx].current_due = Math.max(0, (customers[cIdx].current_due || 0) - amt);
        setMockData('GAUDAI_CUSTOMERS', customers);
        
        // Also add a sales payment entry
        sales = getMockData('GAUDAI_SALES');
        sales.unshift({
          bill_id: `PAY${Date.now()}`,
          customer_id: payload.customer_id,
          date: new Date().toISOString().split('T')[0],
          items: [],
          total_amount: 0,
          paid_amount: amt,
          due_amount: -amt,
          status: 'Paid',
          timestamp: new Date().toISOString(),
          is_payment_record: true
        });
        setMockData('GAUDAI_SALES', sales);

        return { success: true, current_due: customers[cIdx].current_due };
      }
      return { success: false, message: 'Customer not found' };
    }

    case 'getSalesHistory':
      return { success: true, data: getMockData('GAUDAI_SALES') };

    // --- EXPENSE WORKSPACE ---
    case 'addExpense': {
      expenses = getMockData('GAUDAI_EXPENSES');
      const newExpense = {
        expense_id: `EXP${expenses.length + 100}`,
        date: payload.date || new Date().toISOString().split('T')[0],
        reason: payload.reason,
        amount: parseFloat(payload.amount),
        category: payload.category || 'Other',
        payment_method: payload.payment_method || 'Cash',
        notes: payload.notes || '',
        timestamp: new Date().toISOString()
      };
      expenses.unshift(newExpense);
      setMockData('GAUDAI_EXPENSES', expenses);
      return { success: true, data: newExpense };
    }

    case 'getExpenses':
      return { success: true, data: getMockData('GAUDAI_EXPENSES') };

    case 'deleteExpense': {
      expenses = getMockData('GAUDAI_EXPENSES');
      const filteredExpenses = expenses.filter(e => e.expense_id !== payload.expense_id);
      setMockData('GAUDAI_EXPENSES', filteredExpenses);
      return { success: true, message: 'Expense deleted successfully' };
    }

    // --- MASTER ACCOUNTS ---
    case 'getMasterFinancialSummary': {
      collections = getMockData('GAUDAI_COLLECTIONS');
      sales = getMockData('GAUDAI_SALES');
      expenses = getMockData('GAUDAI_EXPENSES');
      customers = getMockData('GAUDAI_CUSTOMERS');
      
      const today = new Date().toISOString().split('T')[0];

      // Revenue Today: total bill amounts created today + payments today
      const revenueToday = sales
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + s.total_amount, 0);

      // Cash In Today: paid amount from sales today
      const cashInToday = sales
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + s.paid_amount, 0);

      // Farmer Payments Today: paid amount to farmers today
      const farmerPaymentsToday = collections
        .filter(c => c.date === today)
        .reduce((sum, c) => sum + c.paid_amount, 0);

      // Operational Expenses Today: expense entries today
      const opExpensesToday = expenses
        .filter(e => e.date === today)
        .reduce((sum, e) => sum + e.amount, 0);

      // Total Pending Dues (receivables from customers)
      const totalPendingDues = customers.reduce((sum, c) => sum + (c.current_due || 0), 0);

      return {
        success: true,
        data: {
          revenueToday,
          cashInToday,
          expensesToday: farmerPaymentsToday + opExpensesToday,
          farmerPaymentsToday,
          opExpensesToday,
          pendingDues: totalPendingDues,
          netProfit: revenueToday - (farmerPaymentsToday + opExpensesToday)
        }
      };
    }

    case 'getCashFlowStatement': {
      collections = getMockData('GAUDAI_COLLECTIONS');
      sales = getMockData('GAUDAI_SALES');
      expenses = getMockData('GAUDAI_EXPENSES');

      // Aggregate Cash Flow by date
      // cash_in = Customer Sales paid amount
      // cash_out = Farmer collections paid amount + expenses amount
      const dates = new Set([
        ...collections.map(c => c.date),
        ...sales.map(s => s.date),
        ...expenses.map(e => e.date)
      ]);

      let cashFlows = [];
      let balance = 100000; // Mock opening balance

      Array.from(dates).sort().forEach(d => {
        const cashIn = sales.filter(s => s.date === d).reduce((sum, s) => sum + s.paid_amount, 0);
        const cashOutFarmers = collections.filter(c => c.date === d).reduce((sum, c) => sum + c.paid_amount, 0);
        const cashOutOps = expenses.filter(e => e.date === d).reduce((sum, e) => sum + e.amount, 0);
        const cashOut = cashOutFarmers + cashOutOps;

        const opening = balance;
        balance = opening + cashIn - cashOut;

        cashFlows.push({
          date: d,
          opening_balance: opening,
          cash_in: cashIn,
          cash_out: cashOut,
          closing_balance: balance
        });
      });

      return { success: true, data: cashFlows.reverse() };
    }

    case 'getSettings':
      settings = JSON.parse(localStorage.getItem('GAUDAI_SETTINGS')) || { baseRate: 8.5, businessName: 'Gaudai AI Dairy' };
      return { success: true, data: settings };

    case 'updateSettings':
      localStorage.setItem('GAUDAI_SETTINGS', JSON.stringify(payload));
      return { success: true, message: 'Settings updated successfully' };

    default:
      return { success: false, message: `Action ${action} not supported in mock mode` };
  }
}
