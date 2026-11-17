/* global process */
import { authenticateRequest } from './_lib/auth.js';

export const ROLE_ACTIONS = {
  accountant: new Set([
    'batchLoadData',
    'getSpreadsheetTabUrl',
    'getMasterFinancialSummary',
    'getCashFlowStatement',
    'getDailySpreadsheetInfo',
    'getExpenses',
    'getSalesHistory',
    'getCollectionEntries',
    'getFarmerList',
    'getCustomerList',
    'getProductList',
    'getSettings'
  ]),

  staff: new Set([
    'batchLoadData',
    'getSpreadsheetTabUrl',
    'getDailySpreadsheetInfo',
    'registerFarmer',
    'getFarmerList',
    'addMilkCollection',
    'getCollectionEntries',
    'markFarmerPaid',
    'addCustomer',
    'getCustomerList',
    'getProductList',
    'addSale',
    'recordPayment',
    'getSalesHistory',
    'addExpense',
    'getExpenses',
    'getSettings'
  ]),

  admin: new Set([
    'batchLoadData',
    'getSpreadsheetTabUrl',
    'getMasterFinancialSummary',
    'getCashFlowStatement',
    'getDailySpreadsheetInfo',
    'getDailySpreadsheetAdmin',
    'resyncDailySpreadsheet',
    'verifyDailySpreadsheet',
    'prepareDailySpreadsheet',
    'migrateToDailySpreadsheets',
    'archivePreviousDayData',
    'archiveSpecificDate',
    'setupDailyArchiveTrigger',
    'getArchiveStatus',
    'registerFarmer',
    'getFarmerList',
    'deleteFarmer',
    'addMilkCollection',
    'getCollectionEntries',
    'markFarmerPaid',
    'addCustomer',
    'getCustomerList',
    'getProductList',
    'addProduct',
    'updateProduct',
    'deleteProduct',
    'addSale',
    'recordPayment',
    'getSalesHistory',
    'addExpense',
    'getExpenses',
    'deleteExpense',
    'getSettings',
    'updateSettings'
  ]),

  superadmin: new Set([
    'batchLoadData',
    'getSpreadsheetTabUrl',
    'getMasterFinancialSummary',
    'getCashFlowStatement',
    'getDailySpreadsheetInfo',
    'getDailySpreadsheetAdmin',
    'resyncDailySpreadsheet',
    'verifyDailySpreadsheet',
    'prepareDailySpreadsheet',
    'migrateToDailySpreadsheets',
    'archivePreviousDayData',
    'archiveSpecificDate',
    'setupDailyArchiveTrigger',
    'getArchiveStatus',
    'registerFarmer',
    'getFarmerList',
    'deleteFarmer',
    'addMilkCollection',
    'getCollectionEntries',
    'markFarmerPaid',
    'addCustomer',
    'getCustomerList',
    'getProductList',
    'addProduct',
    'updateProduct',
    'deleteProduct',
    'addSale',
    'recordPayment',
    'getSalesHistory',
    'addExpense',
    'getExpenses',
    'deleteExpense',
    'getSettings',
    'updateSettings',
    'clearTransactions',
    'importBackupData'
  ])
};

const FORBIDDEN_SHEET_KEYS = [
  'sheetsIdMaster',
  'sheetsIdCollection',
  'sheetsIdCustomer',
  'sheetsIdExpense'
];

const MAX_BODY_BYTES = 1024 * 512; // 512 KB
const APPS_SCRIPT_TIMEOUT_MS = 30000; // 30s

/**
 * Checks whether an object contains any forbidden spreadsheet ID keys at any depth.
 */
function containsForbiddenKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_SHEET_KEYS.includes(key)) return true;
    if (typeof obj[key] === 'object' && containsForbiddenKeys(obj[key])) return true;
  }
  return false;
}

/**
 * Serverless Apps Script Proxy Handler
 */
export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Authenticate and resolve caller role
  const authResult = await authenticateRequest(req, {}, deps);
  if (authResult.error) {
    return res.status(authResult.error.status).json({ success: false, error: authResult.error.message });
  }

  const user = authResult.user;
  const userRole = user.role;

  // 2. Validate request size & parse JSON body
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ success: false, error: 'Payload Too Large. Maximum allowed size is 512KB.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid request payload. Expected JSON object.' });
  }

  const { action, data } = body;

  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "action" parameter.' });
  }

  // 3. Validate action against role allowlist
  const allowedActions = ROLE_ACTIONS[userRole];
  if (!allowedActions) {
    return res.status(403).json({ success: false, error: 'Caller role is not recognized.' });
  }

  // Check if action exists across any known system actions
  const isKnownAction = Object.values(ROLE_ACTIONS).some(set => set.has(action));
  if (!isKnownAction) {
    return res.status(400).json({ success: false, error: `Unknown action: "${action}".` });
  }

  if (!allowedActions.has(action)) {
    return res.status(403).json({ success: false, error: `Action "${action}" is not permitted for role "${userRole}".` });
  }

  // 4. Defense-in-depth: Reject any client-supplied spreadsheet IDs
  if (containsForbiddenKeys(body)) {
    return res.status(400).json({
      success: false,
      error: 'Client-supplied spreadsheet IDs are forbidden. Sheet IDs are locked in server configuration.'
    });
  }

  // 5. Forward to Google Apps Script with APPS_SCRIPT_SECRET injected server-side
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptSecret = process.env.APPS_SCRIPT_SECRET;

  if (!appsScriptUrl || !appsScriptSecret) {
    console.error('Server Configuration Error: APPS_SCRIPT_URL or APPS_SCRIPT_SECRET is missing.');
    return res.status(500).json({ success: false, error: 'Backend service configuration error.' });
  }

  const payload = {
    action,
    data: data || {},
    secret: appsScriptSecret,
    actor: {
      uid: user.uid,
      role: user.role,
      email: user.email
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);

  try {
    const upstreamRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      return res.status(502).json({
        success: false,
        error: 'Upstream spreadsheet service responded with an error.'
      });
    }

    const json = await upstreamRes.json();

    // Sanitize response: never leak whatsappToken or internal sheet configuration
    if (json && typeof json === 'object') {
      if (json.data && typeof json.data === 'object') {
        delete json.data.whatsappToken;
      }
      delete json.whatsappToken;
    }

    return res.status(200).json(json);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(504).json({ success: false, error: 'Spreadsheet service timed out.' });
    }
    console.error('Apps Script Proxy Error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to communicate with spreadsheet service.' });
  }
}
