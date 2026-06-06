/**
 * Firestore Service – Primary data access layer
 * All reads/writes go through Firestore as the source of truth.
 * Google Sheets synchronization happens asynchronously via syncQueue.
 */

import { db } from './firebase';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, writeBatch, query, where, orderBy, limit
} from 'firebase/firestore';

import { initMockDB } from './api';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const IS_MOCK_MODE = !APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('placeholder');

function ensureMockDB() {
  if (IS_MOCK_MODE) {
    initMockDB();
  }
}

// ─── READ OPERATIONS ────────────────────────────────────────────────

export async function loadSettings() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const settings = JSON.parse(localStorage.getItem('GAUDAI_SETTINGS')) || { baseRate: 8.5, businessName: 'Gaudai AI Dairy' };
    return { success: true, data: settings };
  }
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'general'));
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, message: 'Settings not found' };
  } catch (err) {
    console.error('loadSettings error:', err);
    return { success: false, error: err.message };
  }
}

export async function loadFarmers() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const list = JSON.parse(localStorage.getItem('GAUDAI_FARMERS') || '[]');
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'farmers'));
    const list = snap.docs.map(d => d.data());
    return { success: true, data: list };
  } catch (err) {
    console.error('loadFarmers error:', err);
    return { success: true, data: [] };
  }
}

export async function loadProducts() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const list = JSON.parse(localStorage.getItem('GAUDAI_PRODUCTS') || '[]');
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'products'));
    const list = snap.docs.map(d => d.data());
    return { success: true, data: list };
  } catch (err) {
    console.error('loadProducts error:', err);
    return { success: true, data: [] };
  }
}

export async function loadCustomers() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const list = JSON.parse(localStorage.getItem('GAUDAI_CUSTOMERS') || '[]');
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'customers'));
    const list = snap.docs.map(d => d.data());
    return { success: true, data: list };
  } catch (err) {
    console.error('loadCustomers error:', err);
    return { success: true, data: [] };
  }
}

export async function loadCollections() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const list = JSON.parse(localStorage.getItem('GAUDAI_COLLECTIONS') || '[]');
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'collections'));
    const list = snap.docs.map(d => d.data());
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { success: true, data: list };
  } catch (err) {
    console.error('loadCollections error:', err);
    return { success: true, data: [] };
  }
}

export async function loadSales() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const list = JSON.parse(localStorage.getItem('GAUDAI_SALES') || '[]');
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'sales'));
    const list = snap.docs.map(d => d.data());
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { success: true, data: list };
  } catch (err) {
    console.error('loadSales error:', err);
    return { success: true, data: [] };
  }
}

export async function loadExpenses() {
  if (IS_MOCK_MODE) {
    ensureMockDB();
    const list = JSON.parse(localStorage.getItem('GAUDAI_EXPENSES') || '[]');
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'expenses'));
    const list = snap.docs.map(d => d.data());
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { success: true, data: list };
  } catch (err) {
    console.error('loadExpenses error:', err);
    return { success: true, data: [] };
  }
}

/**
 * Load critical data for initial dashboard render.
 * Returns settings + farmers + products + customers in parallel.
 */
export async function loadCriticalData() {
  const [settings, farmers, products, customers] = await Promise.all([
    loadSettings(),
    loadFarmers(),
    loadProducts(),
    loadCustomers()
  ]);
  return { settings, farmers, products, customers };
}

/**
 * Load secondary data (collections, sales, expenses) in background.
 */
export async function loadSecondaryData() {
  const [collections, sales, expenses] = await Promise.all([
    loadCollections(),
    loadSales(),
    loadExpenses()
  ]);
  return { collections, sales, expenses };
}

/**
 * Compute dashboard summary from local data arrays.
 * Avoids any network call — pure computation.
 */
export function computeDashboardSummary(collections, sales, expenses, customers) {
  const today = new Date().toLocaleDateString('en-CA'); // yyyy-MM-dd

  const revenueToday = (sales || [])
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const cashInToday = (sales || [])
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (s.paid_amount || 0), 0);

  const farmerPaymentsToday = (collections || [])
    .filter(c => c.date === today)
    .reduce((sum, c) => sum + (c.paid_amount || 0), 0);

  const opExpensesToday = (expenses || [])
    .filter(e => e.date === today)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const pendingDues = (customers || [])
    .reduce((sum, c) => sum + (c.current_due || 0), 0);

  return {
    revenueToday,
    cashInToday,
    expensesToday: farmerPaymentsToday + opExpensesToday,
    farmerPaymentsToday,
    opExpensesToday,
    pendingDues,
    netProfit: revenueToday - (farmerPaymentsToday + opExpensesToday)
  };
}

/**
 * Compute cash flow statement from local data arrays.
 */
export function computeCashFlow(collections, sales, expenses) {
  const dates = new Set([
    ...(collections || []).map(c => c.date),
    ...(sales || []).map(s => s.date),
    ...(expenses || []).map(e => e.date)
  ]);

  let cashFlows = [];
  let balance = 100000; // Opening balance

  Array.from(dates).sort().forEach(d => {
    const cashIn = (sales || []).filter(s => s.date === d).reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    const cashOutFarmers = (collections || []).filter(c => c.date === d).reduce((sum, c) => sum + (c.paid_amount || 0), 0);
    const cashOutOps = (expenses || []).filter(e => e.date === d).reduce((sum, e) => sum + (e.amount || 0), 0);
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

  return cashFlows.reverse();
}

// ─── WRITE OPERATIONS ───────────────────────────────────────────────

/**
 * Register a new farmer in Firestore.
 */
export async function registerFarmer(data) {
  if (IS_MOCK_MODE) {
    const farmers = JSON.parse(localStorage.getItem('GAUDAI_FARMERS') || '[]');
    let maxId = 0;
    farmers.forEach(f => {
      if (f.farmer_id) {
        const num = parseInt(f.farmer_id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    const farmerId = `F-${String(maxId + 1).padStart(2, '0')}`;
    const newFarmer = {
      farmer_id: farmerId,
      name: data.name,
      mobile: data.mobile || '',
      address: data.address || '',
      milk_type: data.milk_type || 'Cow',
      current_due: 0,
      created_at: new Date().toISOString()
    };
    farmers.unshift(newFarmer);
    localStorage.setItem('GAUDAI_FARMERS', JSON.stringify(farmers));
    return { success: true, message: 'Farmer registered successfully', data: newFarmer };
  }
  try {
    const snap = await getDocs(collection(db, 'farmers'));
    let maxId = 0;
    snap.forEach(docSnap => {
      const fid = docSnap.data().farmer_id;
      if (fid) {
        const num = parseInt(fid.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    const farmerId = `F-${String(maxId + 1).padStart(2, '0')}`;
    const newFarmer = {
      farmer_id: farmerId,
      name: data.name,
      mobile: data.mobile || '',
      address: data.address || '',
      milk_type: data.milk_type || 'Cow',
      current_due: 0,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'farmers', farmerId), newFarmer);
    return { success: true, message: 'Farmer registered successfully', data: newFarmer };
  } catch (err) {
    console.error('registerFarmer error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a farmer from Firestore.
 */
export async function deleteFarmer(farmerId) {
  if (IS_MOCK_MODE) {
    const farmers = JSON.parse(localStorage.getItem('GAUDAI_FARMERS') || '[]');
    const filtered = farmers.filter(f => f.farmer_id !== farmerId);
    localStorage.setItem('GAUDAI_FARMERS', JSON.stringify(filtered));
    return { success: true, message: 'Farmer deleted successfully' };
  }
  try {
    await deleteDoc(doc(db, 'farmers', farmerId));
    return { success: true, message: 'Farmer deleted successfully' };
  } catch (err) {
    console.error('deleteFarmer error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Add a milk collection entry to Firestore.
 * Updates farmer's current_due atomically.
 */
export async function addMilkCollection(data, settings) {
  if (IS_MOCK_MODE) {
    const collections = JSON.parse(localStorage.getItem('GAUDAI_COLLECTIONS') || '[]');
    const farmers = JSON.parse(localStorage.getItem('GAUDAI_FARMERS') || '[]');
    const entryId = `E${Date.now()}`;
    const paidVal = data.paid_amount !== undefined ? data.paid_amount : (data.paidAmount !== undefined ? data.paidAmount : 0);
    const rate = data.fat * (settings.baseRate || 8.5);
    const totalAmount = rate * data.quantity;
    const dueAmount = Math.max(0, totalAmount - paidVal);

    const entry = {
      entry_id: entryId,
      farmer_id: data.farmer_id,
      date: data.date || new Date().toISOString().split('T')[0],
      milk_type: data.milk_type,
      quantity: parseFloat(data.quantity),
      fat: parseFloat(data.fat),
      snf: parseFloat(data.snf) || 8.5,
      calculated_rate: rate,
      total_amount: totalAmount,
      paid_amount: parseFloat(paidVal),
      due_amount: dueAmount,
      status: dueAmount <= 0 ? 'Paid' : (paidVal > 0 ? 'Partial' : 'Pending'),
      timestamp: new Date().toISOString()
    };

    collections.unshift(entry);
    localStorage.setItem('GAUDAI_COLLECTIONS', JSON.stringify(collections));

    const fIdx = farmers.findIndex(f => f.farmer_id === data.farmer_id);
    if (fIdx !== -1) {
      farmers[fIdx].current_due = (farmers[fIdx].current_due || 0) + dueAmount;
      localStorage.setItem('GAUDAI_FARMERS', JSON.stringify(farmers));
    }
    return { success: true, message: 'Milk collection saved', data: entry };
  }
  try {
    const entryId = `E${Date.now()}`;
    const paidVal = data.paid_amount !== undefined ? data.paid_amount : (data.paidAmount !== undefined ? data.paidAmount : 0);
    const rate = data.fat * (settings.baseRate || 8.5);
    const totalAmount = rate * data.quantity;
    const dueAmount = Math.max(0, totalAmount - paidVal);

    const entry = {
      entry_id: entryId,
      farmer_id: data.farmer_id,
      date: data.date || new Date().toISOString().split('T')[0],
      milk_type: data.milk_type,
      quantity: parseFloat(data.quantity),
      fat: parseFloat(data.fat),
      snf: parseFloat(data.snf) || 8.5,
      calculated_rate: rate,
      total_amount: totalAmount,
      paid_amount: parseFloat(paidVal),
      due_amount: dueAmount,
      status: dueAmount <= 0 ? 'Paid' : (paidVal > 0 ? 'Partial' : 'Pending'),
      timestamp: new Date().toISOString()
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'collections', entryId), entry);

    // Update farmer's current_due
    const farmerRef = doc(db, 'farmers', data.farmer_id);
    const farmerSnap = await getDoc(farmerRef);
    if (farmerSnap.exists()) {
      const currentDue = (farmerSnap.data().current_due || 0) + dueAmount;
      batch.update(farmerRef, { current_due: currentDue });
    }

    await batch.commit();
    return { success: true, message: 'Milk collection saved', data: entry };
  } catch (err) {
    console.error('addMilkCollection error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mark a farmer's collection entry as paid.
 */
export async function markFarmerPaid(entryId, amount) {
  if (IS_MOCK_MODE) {
    const collections = JSON.parse(localStorage.getItem('GAUDAI_COLLECTIONS') || '[]');
    const farmers = JSON.parse(localStorage.getItem('GAUDAI_FARMERS') || '[]');
    const collectionIndex = collections.findIndex(c => c.entry_id === entryId);
    if (collectionIndex !== -1) {
      const entry = collections[collectionIndex];
      const oldDue = entry.due_amount || 0;
      const amtCleared = amount !== undefined && amount !== null ? parseFloat(amount) : oldDue;
      const finalAmt = Math.min(oldDue, amtCleared);
      const remainingDue = Math.max(0, oldDue - finalAmt);

      entry.paid_amount = (entry.paid_amount || 0) + finalAmt;
      entry.due_amount = remainingDue;
      entry.status = remainingDue <= 0 ? 'Paid' : 'Partial';

      localStorage.setItem('GAUDAI_COLLECTIONS', JSON.stringify(collections));

      const fIdx = farmers.findIndex(f => f.farmer_id === entry.farmer_id);
      if (fIdx !== -1) {
        farmers[fIdx].current_due = Math.max(0, (farmers[fIdx].current_due || 0) - finalAmt);
        localStorage.setItem('GAUDAI_FARMERS', JSON.stringify(farmers));
      }
      return { success: true, message: 'Payment recorded' };
    }
    return { success: false, message: 'Collection entry not found' };
  }
  try {
    const entryRef = doc(db, 'collections', entryId);
    const entrySnap = await getDoc(entryRef);
    if (!entrySnap.exists()) {
      return { success: false, message: 'Collection entry not found' };
    }

    const entry = entrySnap.data();
    const oldDue = entry.due_amount || 0;
    const amtCleared = amount !== undefined && amount !== null ? parseFloat(amount) : oldDue;
    const finalAmt = Math.min(oldDue, amtCleared);
    const remainingDue = Math.max(0, oldDue - finalAmt);

    const batch = writeBatch(db);
    batch.update(entryRef, {
      paid_amount: (entry.paid_amount || 0) + finalAmt,
      due_amount: remainingDue,
      status: remainingDue <= 0 ? 'Paid' : 'Partial'
    });

    // Update farmer due
    const farmerRef = doc(db, 'farmers', entry.farmer_id);
    const farmerSnap = await getDoc(farmerRef);
    if (farmerSnap.exists()) {
      const currentDue = Math.max(0, (farmerSnap.data().current_due || 0) - finalAmt);
      batch.update(farmerRef, { current_due: currentDue });
    }

    await batch.commit();
    return { success: true, message: 'Payment recorded' };
  } catch (err) {
    console.error('markFarmerPaid error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Add a customer to Firestore.
 */
export async function addCustomer(data) {
  if (IS_MOCK_MODE) {
    const customers = JSON.parse(localStorage.getItem('GAUDAI_CUSTOMERS') || '[]');
    let maxId = 0;
    customers.forEach(c => {
      if (c.customer_id) {
        const num = parseInt(c.customer_id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    const customerId = `c-${String(maxId + 1).padStart(2, '0')}`;
    const newCustomer = {
      customer_id: customerId,
      shop_name: data.shop_name,
      owner_name: data.owner_name,
      mobile: data.mobile || '',
      address: data.address || '',
      current_due: 0,
      created_at: new Date().toISOString()
    };
    customers.unshift(newCustomer);
    localStorage.setItem('GAUDAI_CUSTOMERS', JSON.stringify(customers));
    return { success: true, message: 'Customer added', data: newCustomer };
  }
  try {
    const snap = await getDocs(collection(db, 'customers'));
    let maxId = 0;
    snap.forEach(docSnap => {
      const cid = docSnap.data().customer_id;
      if (cid) {
        const num = parseInt(cid.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    const customerId = `c-${String(maxId + 1).padStart(2, '0')}`;
    const newCustomer = {
      customer_id: customerId,
      shop_name: data.shop_name,
      owner_name: data.owner_name,
      mobile: data.mobile || '',
      address: data.address || '',
      current_due: 0,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'customers', customerId), newCustomer);
    return { success: true, message: 'Customer added', data: newCustomer };
  } catch (err) {
    console.error('addCustomer error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Add a product to Firestore.
 */
export async function addProduct(data) {
  if (IS_MOCK_MODE) {
    const products = JSON.parse(localStorage.getItem('GAUDAI_PRODUCTS') || '[]');
    let maxId = 6;
    products.forEach(p => {
      if (p.product_id) {
        const num = parseInt(p.product_id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    const productId = `P${String(maxId + 1).padStart(3, '0')}`;
    const newProduct = {
      product_id: productId,
      product_name: data.product_name,
      category: data.category || 'Other',
      unit_price: parseFloat(data.unit_price),
      status: 'Active',
      updated_at: new Date().toISOString()
    };
    products.push(newProduct);
    localStorage.setItem('GAUDAI_PRODUCTS', JSON.stringify(products));
    return { success: true, message: 'Product added', data: newProduct };
  }
  try {
    const snap = await getDocs(collection(db, 'products'));
    let maxId = 6;
    snap.forEach(docSnap => {
      const pid = docSnap.data().product_id;
      if (pid) {
        const num = parseInt(pid.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    const productId = `P${String(maxId + 1).padStart(3, '0')}`;
    const newProduct = {
      product_id: productId,
      product_name: data.product_name,
      category: data.category || 'Other',
      unit_price: parseFloat(data.unit_price),
      status: 'Active',
      updated_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'products', productId), newProduct);
    return { success: true, message: 'Product added', data: newProduct };
  } catch (err) {
    console.error('addProduct error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update a product's price in Firestore.
 */
export async function updateProduct(productId, data) {
  if (IS_MOCK_MODE) {
    const products = JSON.parse(localStorage.getItem('GAUDAI_PRODUCTS') || '[]');
    const prodIdx = products.findIndex(p => p.product_id === productId);
    if (prodIdx !== -1) {
      products[prodIdx] = { 
        ...products[prodIdx], 
        unit_price: parseFloat(data.unit_price), 
        updated_at: new Date().toISOString() 
      };
      localStorage.setItem('GAUDAI_PRODUCTS', JSON.stringify(products));
      return { success: true, message: 'Product updated' };
    }
    return { success: false, message: 'Product not found' };
  }
  try {
    const prodRef = doc(db, 'products', productId);
    await updateDoc(prodRef, {
      unit_price: parseFloat(data.unit_price),
      updated_at: new Date().toISOString()
    });
    return { success: true, message: 'Product updated' };
  } catch (err) {
    console.error('updateProduct error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Add a sale to Firestore. Updates customer due atomically.
 */
export async function addSale(data) {
  if (IS_MOCK_MODE) {
    const sales = JSON.parse(localStorage.getItem('GAUDAI_SALES') || '[]');
    const customers = JSON.parse(localStorage.getItem('GAUDAI_CUSTOMERS') || '[]');
    const billId = `B${Date.now()}`;
    const totalVal = parseFloat(data.total_amount);
    const paidVal = parseFloat(data.paid_amount);
    const dueVal = parseFloat(data.due_amount);

    const sale = {
      bill_id: billId,
      customer_id: data.customer_id,
      date: data.date || new Date().toISOString().split('T')[0],
      items: data.items || [],
      total_amount: totalVal,
      paid_amount: paidVal,
      due_amount: dueVal,
      status: dueVal <= 0 ? 'Paid' : (paidVal > 0 ? 'Partial' : 'Pending'),
      timestamp: new Date().toISOString()
    };

    sales.unshift(sale);
    localStorage.setItem('GAUDAI_SALES', JSON.stringify(sales));

    const custIdx = customers.findIndex(c => c.customer_id === data.customer_id);
    if (custIdx !== -1) {
      customers[custIdx].current_due = (customers[custIdx].current_due || 0) + dueVal;
      localStorage.setItem('GAUDAI_CUSTOMERS', JSON.stringify(customers));
    }
    return { success: true, message: 'Sale recorded', data: sale };
  }
  try {
    const billId = `B${Date.now()}`;
    const totalVal = parseFloat(data.total_amount);
    const paidVal = parseFloat(data.paid_amount);
    const dueVal = parseFloat(data.due_amount);

    const sale = {
      bill_id: billId,
      customer_id: data.customer_id,
      date: data.date || new Date().toISOString().split('T')[0],
      items: data.items || [],
      total_amount: totalVal,
      paid_amount: paidVal,
      due_amount: dueVal,
      status: dueVal <= 0 ? 'Paid' : (paidVal > 0 ? 'Partial' : 'Pending'),
      timestamp: new Date().toISOString()
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'sales', billId), sale);

    // Update customer due
    const customerRef = doc(db, 'customers', data.customer_id);
    const customerSnap = await getDoc(customerRef);
    if (customerSnap.exists()) {
      const currentDue = (customerSnap.data().current_due || 0) + dueVal;
      batch.update(customerRef, { current_due: currentDue });
    }

    await batch.commit();
    return { success: true, message: 'Sale recorded', data: sale };
  } catch (err) {
    console.error('addSale error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Record a customer payment. Updates customer due and creates payment record.
 */
export async function recordCustomerPayment(customerId, amount) {
  if (IS_MOCK_MODE) {
    const customers = JSON.parse(localStorage.getItem('GAUDAI_CUSTOMERS') || '[]');
    const sales = JSON.parse(localStorage.getItem('GAUDAI_SALES') || '[]');
    const amt = parseFloat(amount);

    const cIdx = customers.findIndex(c => c.customer_id === customerId);
    if (cIdx !== -1) {
      customers[cIdx].current_due = Math.max(0, (customers[cIdx].current_due || 0) - amt);
      localStorage.setItem('GAUDAI_CUSTOMERS', JSON.stringify(customers));
    }

    const paymentId = `PAY${Date.now()}`;
    sales.unshift({
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
    localStorage.setItem('GAUDAI_SALES', JSON.stringify(sales));
    return { success: true, message: 'Payment recorded' };
  }
  try {
    const amt = parseFloat(amount);
    const batch = writeBatch(db);

    // Update customer due
    const customerRef = doc(db, 'customers', customerId);
    const customerSnap = await getDoc(customerRef);
    if (customerSnap.exists()) {
      const currentDue = Math.max(0, (customerSnap.data().current_due || 0) - amt);
      batch.update(customerRef, { current_due: currentDue });
    }

    // Create payment record
    const paymentId = `PAY${Date.now()}`;
    batch.set(doc(db, 'sales', paymentId), {
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

    await batch.commit();
    return { success: true, message: 'Payment recorded' };
  } catch (err) {
    console.error('recordCustomerPayment error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Add an expense to Firestore.
 */
export async function addExpense(data) {
  if (IS_MOCK_MODE) {
    const expenses = JSON.parse(localStorage.getItem('GAUDAI_EXPENSES') || '[]');
    const expId = `EXP${Date.now()}`;
    const expense = {
      expense_id: expId,
      date: data.date || new Date().toISOString().split('T')[0],
      reason: data.reason,
      amount: parseFloat(data.amount),
      category: data.category || 'Other',
      payment_method: data.payment_method || 'Cash',
      notes: data.notes || '',
      timestamp: new Date().toISOString()
    };
    expenses.unshift(expense);
    localStorage.setItem('GAUDAI_EXPENSES', JSON.stringify(expenses));
    return { success: true, message: 'Expense added', data: expense };
  }
  try {
    const expId = `EXP${Date.now()}`;
    const expense = {
      expense_id: expId,
      date: data.date || new Date().toISOString().split('T')[0],
      reason: data.reason,
      amount: parseFloat(data.amount),
      category: data.category || 'Other',
      payment_method: data.payment_method || 'Cash',
      notes: data.notes || '',
      timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, 'expenses', expId), expense);
    return { success: true, message: 'Expense added', data: expense };
  } catch (err) {
    console.error('addExpense error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete an expense from Firestore.
 */
export async function deleteExpense(expenseId) {
  if (IS_MOCK_MODE) {
    const expenses = JSON.parse(localStorage.getItem('GAUDAI_EXPENSES') || '[]');
    const filtered = expenses.filter(e => e.expense_id !== expenseId);
    localStorage.setItem('GAUDAI_EXPENSES', JSON.stringify(filtered));
    return { success: true, message: 'Expense deleted' };
  }
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
    return { success: true, message: 'Expense deleted' };
  } catch (err) {
    console.error('deleteExpense error:', err);
    return { success: false, error: err.message };
  }
}

// ─── DAILY SPREADSHEET MAPPING ──────────────────────────────────────

/**
 * Load all daily spreadsheet mappings from Firestore.
 * Returns an array of { date, spreadsheetId, spreadsheetName, ... }
 */
export async function loadDailySpreadsheets() {
  if (IS_MOCK_MODE) {
    const list = JSON.parse(localStorage.getItem('GAUDAI_DAILY_SHEETS') || '[]');
    return { success: true, data: list };
  }
  try {
    const snap = await getDocs(collection(db, 'daily_spreadsheets'));
    const list = snap.docs.map(d => d.data());
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { success: true, data: list };
  } catch (err) {
    console.error('loadDailySpreadsheets error:', err);
    return { success: true, data: [] };
  }
}

/**
 * Get a specific date's spreadsheet mapping.
 */
export async function getDailySpreadsheetByDate(dateStr) {
  if (IS_MOCK_MODE) {
    const list = JSON.parse(localStorage.getItem('GAUDAI_DAILY_SHEETS') || '[]');
    const found = list.find(d => d.date === dateStr);
    return { success: true, data: found || null };
  }
  try {
    const docSnap = await getDoc(doc(db, 'daily_spreadsheets', dateStr));
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: true, data: null };
  } catch (err) {
    console.error('getDailySpreadsheetByDate error:', err);
    return { success: true, data: null };
  }
}

/**
 * Save or update a daily spreadsheet mapping in Firestore.
 */
export async function saveDailySpreadsheetMapping(data) {
  if (IS_MOCK_MODE) {
    const list = JSON.parse(localStorage.getItem('GAUDAI_DAILY_SHEETS') || '[]');
    const idx = list.findIndex(d => d.date === data.date);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.unshift(data);
    }
    localStorage.setItem('GAUDAI_DAILY_SHEETS', JSON.stringify(list));
    return { success: true };
  }
  try {
    await setDoc(doc(db, 'daily_spreadsheets', data.date), data, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('saveDailySpreadsheetMapping error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Save settings to Firestore.
 */
export async function saveSettings(settings) {
  if (IS_MOCK_MODE) {
    localStorage.setItem('GAUDAI_SETTINGS', JSON.stringify(settings));
    return { success: true, message: 'Settings saved' };
  }
  try {
    await setDoc(doc(db, 'settings', 'general'), settings);
    return { success: true, message: 'Settings saved' };
  } catch (err) {
    console.error('saveSettings error:', err);
    return { success: false, error: err.message };
  }
}
