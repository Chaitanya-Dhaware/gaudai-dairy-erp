/**
 * Gaudai AI Engine — Core intelligence layer for the AI Chat Assistant.
 * 
 * Handles:
 * - Natural language intent classification
 * - OCR processing of handwritten documents via Gemini multimodal
 * - Data extraction and validation
 * - Action execution through existing appStore methods
 * - Report generation from live data
 * - Query answering from Firestore data
 */

import { chatWithGemini, processImageWithGemini, processExcelWithGemini } from './gemini';
import * as XLSX from 'xlsx';

// ─── SYSTEM PROMPT BUILDER ──────────────────────────────────────────

/**
 * Build a dynamic system prompt with current business context.
 * This gives Gemini awareness of actual farmers, customers, products, etc.
 */
export function buildSystemPrompt(storeSnapshot) {
  const { farmers = [], customers = [], products = [], settings = {}, collections = [], sales = [], expenses = [] } = storeSnapshot;

  const today = new Date().toLocaleDateString('en-CA');
  const farmerList = farmers.slice(0, 50).map(f => `${f.farmer_id}: ${f.name} (${f.milk_type}, Due: ₹${f.current_due || 0})`).join('\n');
  const customerList = customers.slice(0, 50).map(c => `${c.customer_id}: ${c.shop_name} / ${c.owner_name} (Due: ₹${c.current_due || 0})`).join('\n');
  const productList = products.map(p => `${p.product_id}: ${p.product_name} — ₹${p.unit_price} (${p.category})`).join('\n');

  // Today's summary stats
  const todayCollections = collections.filter(c => c.date === today);
  const todaySales = sales.filter(s => s.date === today);
  const todayExpenses = expenses.filter(e => e.date === today);
  const todayMilkTotal = todayCollections.reduce((s, c) => s + (c.quantity || 0), 0);
  const todayRevenue = todaySales.reduce((s, c) => s + (c.total_amount || 0), 0);
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  return `You are "Gaudai AI" — an intelligent dairy business assistant for the Gaudai AI Dairy ERP platform.

TODAY'S DATE: ${today}
BUSINESS: ${settings.businessName || 'Gaudai AI Dairy'}
BASE MILK RATE MULTIPLIER: ₹${settings.baseRate || 8.5} per unit fat
MILK RATE FORMULA: Rate = Fat × BaseRate (${settings.baseRate || 8.5}), Total = Rate × Quantity

═══ REGISTERED FARMERS (${farmers.length} total) ═══
${farmerList || 'No farmers registered yet.'}

═══ REGISTERED CUSTOMERS (${customers.length} total) ═══
${customerList || 'No customers registered yet.'}

═══ PRODUCTS (${products.length} total) ═══
${productList || 'No products registered yet.'}

═══ TODAY'S SNAPSHOT ═══
• Milk Collected: ${todayMilkTotal} liters from ${todayCollections.length} entries
• Sales Revenue: ₹${todayRevenue} from ${todaySales.length} bills
• Expenses: ₹${todayExpenseTotal} from ${todayExpenses.length} entries
• Total Farmers: ${farmers.length}
• Total Customers: ${customers.length}

═══ YOUR CAPABILITIES ═══
You can perform the following actions by responding with a JSON action block:

1. ADD_COLLECTION — Add milk collection entry
2. ADD_EXPENSE — Add an expense record
3. ADD_SALE — Add a sales bill
4. RECORD_PAYMENT — Record customer payment
5. MARK_FARMER_PAID — Record farmer payment
6. REGISTER_FARMER — Register a new farmer
7. ADD_CUSTOMER — Add a new customer
8. QUERY_DATA — Answer questions from business data
9. GENERATE_REPORT — Generate a business report
10. OCR_RESULT — Present extracted OCR data for confirmation

═══ RESPONSE FORMAT ═══
When the user asks you to perform a data operation, respond with BOTH:
1. A human-readable explanation
2. A JSON action block wrapped in \`\`\`action markers

Example for adding milk collection:
"I'll add the milk collection for Rajesh Gaikwad. Here are the details:"
\`\`\`action
{
  "type": "ADD_COLLECTION",
  "data": {
    "farmer_id": "F-01",
    "farmer_name": "Rajesh Gaikwad",
    "milk_type": "Buffalo",
    "quantity": 25,
    "fat": 6.5,
    "snf": 8.5,
    "date": "${today}"
  },
  "summary": "Buffalo milk, 25L, Fat 6.5, Rate ₹55.25, Total ₹1,381.25"
}
\`\`\`

For queries/reports, just respond with a clear, formatted answer. Use ₹ for currency. Be concise but thorough.

═══ RULES ═══
1. ALWAYS fuzzy-match farmer/customer names against the registered lists above. If no match found, ask for clarification.
2. ALWAYS calculate rates: Rate = Fat × ${settings.baseRate || 8.5}, Total = Rate × Quantity
3. NEVER invent farmer_ids or customer_ids — use only IDs from the lists above.
4. For dates: understand "today", "yesterday", "last week", DD/MM/YYYY, DD-MM-YYYY, etc.
5. When showing amounts, use Indian number formatting (₹1,23,456).
6. Respond in the same language the user writes in (English, Marathi, or Hindi).
7. For ambiguous requests, ask clarifying questions.
8. When the user uploads an image, it will be processed separately — you'll receive extracted OCR data to present.`;
}

// ─── OCR SYSTEM PROMPT ──────────────────────────────────────────────

export function buildOCRPrompt(task = '') {
  return `You are an OCR specialist for a dairy business. Extract ALL data from this handwritten document or image.

DOCUMENT TYPES YOU MAY ENCOUNTER:
1. COLLECTION SHEET — Contains farmer names, milk quantity, fat, SNF, dates
2. SALES RECORD — Contains customer names, products, quantities, prices
3. EXPENSE NOTE — Contains expense descriptions, amounts, dates
4. PAYMENT REGISTER — Contains farmer/customer names, payment amounts, dates
5. CUSTOMER_LIST — Contains customer names, shop names, mobile numbers, addresses to register
6. FARMER_LIST — Contains farmer names, mobile numbers, addresses, milk type to register

${task ? `USER TASK / INSTRUCTION FOR THIS IMAGE:
The user wants you to do: "${task}"
Classify the document type appropriately according to their request. For example, if they want to register customers, set the document_type to "CUSTOMER_LIST". If they want to register farmers, set the document_type to "FARMER_LIST".` : ''}

RESPOND WITH STRICT JSON FORMAT:
\`\`\`json
{
  "document_type": "COLLECTION" | "SALES" | "EXPENSE" | "PAYMENT" | "CUSTOMER_LIST" | "FARMER_LIST",
  "confidence": 0.0-1.0,
  "extracted_date": "YYYY-MM-DD or null",
  "entries": [
    {
      "name": "person/business name",
      "date": "YYYY-MM-DD",
      "fields": {
        // For COLLECTION: quantity, fat, snf, milk_type
        // For SALES: product, quantity, price, total
        // For EXPENSE: reason, amount, category
        // For PAYMENT: amount, type (received/paid)
        // For CUSTOMER_LIST: shop_name, owner_name, mobile, address
        // For FARMER_LIST: name, mobile, address, milk_type
      }
    }
  ],
  "raw_text": "full text you can read from the image",
  "notes": "any observations about quality, unreadable parts, etc."
}
\`\`\`

RULES:
- If the document contains names, shop names, mobile numbers, or addresses without quantities/fat/sales transaction figures, classify it as "CUSTOMER_LIST" (or "FARMER_LIST" if it lists farmers).
- If the document contains milk collections (names with quantity, fat, SNF), classify it as "COLLECTION".
- If the document contains sales (names with products, quantity, price, totals), classify it as "SALES".
- If the document contains payments (names with received/paid amounts), classify it as "PAYMENT".
- Extract ALL rows/entries you can read, even partial ones
- For unclear text, include your best guess with a note
- Dates can be in any format — convert all to YYYY-MM-DD
- Numbers should be plain digits (no commas, no currency symbols)
- If you can't determine document_type, use "UNKNOWN"
- Set confidence based on handwriting clarity (0.0 = unreadable, 1.0 = perfectly clear)`;
}

export function buildExcelPrompt(task = '') {
  return `You are a data extraction specialist for a dairy business. Map the uploaded spreadsheet JSON data into structured entities.

DOCUMENT TYPES YOU MAY ENCOUNTER:
1. COLLECTION SHEET — Contains farmer names, milk quantity, fat, SNF, dates
2. SALES RECORD — Contains customer names, products, quantities, prices
3. EXPENSE NOTE — Contains expense descriptions, amounts, dates
4. PAYMENT REGISTER — Contains farmer/customer names, payment amounts, dates
5. CUSTOMER_LIST — Contains customer names, shop names, mobile numbers, addresses to register
6. FARMER_LIST — Contains farmer names, mobile numbers, addresses, milk type to register

${task ? `USER TASK / INSTRUCTION FOR THIS SPREADSHEET:
The user wants you to do: "${task}"
Classify the document type appropriately according to their request. For example, if they want to register customers, set the document_type to "CUSTOMER_LIST". If they want to register farmers, set the document_type to "FARMER_LIST".` : ''}

RESPOND WITH STRICT JSON FORMAT:
\`\`\`json
{
  "document_type": "COLLECTION" | "SALES" | "EXPENSE" | "PAYMENT" | "CUSTOMER_LIST" | "FARMER_LIST",
  "confidence": 1.0,
  "extracted_date": "YYYY-MM-DD or null",
  "entries": [
    {
      "name": "person/business name",
      "date": "YYYY-MM-DD",
      "fields": {
        // For COLLECTION: quantity, fat, snf, milk_type
        // For SALES: product, quantity, price, total
        // For EXPENSE: reason, amount, category
        // For PAYMENT: amount, type (received/paid)
        // For CUSTOMER_LIST: shop_name, owner_name, mobile, address
        // For FARMER_LIST: name, mobile, address, milk_type
      }
    }
  ],
  "raw_text": "spreadsheet data",
  "notes": "any observations"
}
\`\`\`

RULES:
- If the spreadsheet contains names, shop names, mobile numbers, or addresses without quantities/fat/sales transaction figures, classify it as "CUSTOMER_LIST" (or "FARMER_LIST" if it lists farmers).
- If the spreadsheet contains milk collections (names with quantity, fat, SNF), classify it as "COLLECTION".
- If the spreadsheet contains sales (names with products, quantity, price, totals), classify it as "SALES".
- If the spreadsheet contains payments (names with received/paid amounts), classify it as "PAYMENT".
- Map columns dynamically to the fields (e.g. Map names to "name", shop names to "shop_name" or "name", phone numbers/mobiles to "mobile", addresses to "address", quantities to "quantity", etc.)
- If a date is missing in rows but found in headers/notes or user instructions, use that as the date
- Respond with ONLY the JSON code block. Do not write markdown text outside the code block.`;
}

// ─── INTENT PROCESSING ──────────────────────────────────────────────

/**
 * Process a user message through the AI engine.
 * Returns structured response with optional actions.
 */
export async function processUserMessage(text, storeSnapshot) {
  const systemPrompt = buildSystemPrompt(storeSnapshot);

  const messages = [
    { role: 'user', text }
  ];

  const aiResponse = await chatWithGemini(systemPrompt, messages);
  return parseAIResponse(aiResponse);
}

/**
 * Process a user message with conversation history for context.
 */
export async function processConversation(conversationHistory, storeSnapshot) {
  const systemPrompt = buildSystemPrompt(storeSnapshot);
  const aiResponse = await chatWithGemini(systemPrompt, conversationHistory);
  return parseAIResponse(aiResponse);
}

/**
 * Process an uploaded image through OCR.
 * Returns extracted data for user confirmation.
 */
export async function processOCRImage(imageBase64, mimeType, storeSnapshot, task = '') {
  const ocrPrompt = buildOCRPrompt(task);

  // Step 1: Extract raw data from image
  const ocrResult = await processImageWithGemini(ocrPrompt, imageBase64, mimeType);

  // Step 2: Parse OCR JSON result
  let extracted;
  try {
    const jsonMatch = ocrResult.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      extracted = JSON.parse(jsonMatch[1]);
    } else {
      // Try parsing entire response as JSON
      extracted = JSON.parse(ocrResult);
    }
  } catch {
    // If JSON parsing fails, return the raw text for the AI to handle
    return {
      type: 'ocr_raw',
      message: 'I processed the image but couldn\'t extract structured data. Here\'s what I found:',
      rawText: ocrResult,
      action: null
    };
  }

  // Step 3: Validate and match against existing data
  const validated = validateOCRData(extracted, storeSnapshot);

  // Step 4: Build response
  return {
    type: 'ocr_result',
    message: buildOCRResponseMessage(validated),
    data: validated,
    action: {
      type: 'OCR_CONFIRM',
      data: validated
    }
  };
}

/**
 * Helper to parse Excel array buffer into JSON client-side.
 */
export async function parseExcelData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Convert sheet to JSON array of objects
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Process Excel spreadsheet data using Gemini.
 */
export async function processExcelFile(file, storeSnapshot, task = '') {
  // Step 1: Parse sheet client-side
  const excelJson = await parseExcelData(file);
  
  // Limit to first 200 rows to avoid token limit and maintain good response time
  const slicedJson = excelJson.slice(0, 200);
  const excelJsonStr = JSON.stringify(slicedJson, null, 2);

  // Step 2: Build instruction prompt
  const excelPrompt = buildExcelPrompt(task);

  // Step 3: Run mapper on Gemini
  const geminiResult = await processExcelWithGemini(excelPrompt, excelJsonStr);

  // Step 4: Parse extracted JSON from response
  let extracted;
  try {
    const jsonMatch = geminiResult.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      extracted = JSON.parse(jsonMatch[1]);
    } else {
      extracted = JSON.parse(geminiResult);
    }
  } catch {
    return {
      type: 'excel_raw',
      message: 'I processed the spreadsheet but could not map it to structured records. Here is the raw response:',
      rawText: geminiResult,
      action: null
    };
  }

  // Step 5: Validate entries
  const validated = validateOCRData(extracted, storeSnapshot);

  // Step 6: Return structured response
  return {
    type: 'ocr_result', // Match OCR UI render path
    message: buildOCRResponseMessage(validated),
    data: validated,
    action: {
      type: 'OCR_CONFIRM',
      data: validated
    }
  };
}

// ─── OCR VALIDATION ─────────────────────────────────────────────────

/**
 * Validate extracted OCR data against existing business records.
 * Fuzzy-matches names to farmer_ids and customer_ids.
 */
function validateOCRData(extracted, storeSnapshot) {
  const { farmers = [], customers = [], settings = {} } = storeSnapshot;
  const baseRate = settings.baseRate || 8.5;

  // Normalize document type for robustness
  let docType = (extracted.document_type || '').toUpperCase().trim();
  if (docType.includes('CUSTOMER')) {
    docType = 'CUSTOMER_LIST';
  } else if (docType.includes('FARMER')) {
    docType = 'FARMER_LIST';
  } else if (docType.includes('COLLECT')) {
    docType = 'COLLECTION';
  } else if (docType.includes('SALE')) {
    docType = 'SALES';
  } else if (docType.includes('EXPENSE')) {
    docType = 'EXPENSE';
  } else if (docType.includes('PAYMENT')) {
    docType = 'PAYMENT';
  } else {
    docType = 'UNKNOWN';
  }

  const isValidType = docType !== 'UNKNOWN';

  const result = {
    ...extracted,
    document_type: docType,
    entries: (extracted.entries || []).map(entry => {
      const validated = { ...entry, validation: { valid: true, warnings: [] } };

      if (!isValidType) {
        validated.validation.valid = false;
        validated.validation.warnings.push("Unknown type. Specify a task in your message.");
      }

      if (docType === 'COLLECTION') {
        // Try to match farmer name
        const match = fuzzyMatchName(entry.name, farmers, 'name');
        if (match) {
          validated.matched_id = match.farmer_id;
          validated.matched_name = match.name;
        } else {
          validated.validation.valid = false;
          validated.validation.warnings.push(`Farmer "${entry.name}" not found in records`);
        }

        // Calculate rate and total if collection
        if (entry.fields) {
          const fat = parseFloat(entry.fields.fat) || 0;
          const qty = parseFloat(entry.fields.quantity) || 0;
          const rate = fat * baseRate;
          const total = rate * qty;
          validated.calculated = { rate: Math.round(rate * 100) / 100, total: Math.round(total * 100) / 100 };
        }
      }

      if (docType === 'PAYMENT') {
        // Try to match name against customers first, then farmers
        const custMatch = fuzzyMatchName(entry.name, customers, 'shop_name') || fuzzyMatchName(entry.name, customers, 'owner_name');
        const farmMatch = fuzzyMatchName(entry.name, farmers, 'name');
        if (custMatch) {
          validated.matched_id = custMatch.customer_id;
          validated.matched_name = custMatch.shop_name;
        } else if (farmMatch) {
          validated.matched_id = farmMatch.farmer_id;
          validated.matched_name = farmMatch.name;
        } else {
          validated.validation.valid = false;
          validated.validation.warnings.push(`Person "${entry.name}" not found in records`);
        }
      }

      if (docType === 'SALES') {
        // Try to match customer name
        const match = fuzzyMatchName(entry.name, customers, 'shop_name') ||
          fuzzyMatchName(entry.name, customers, 'owner_name');
        if (match) {
          validated.matched_id = match.customer_id;
          validated.matched_name = match.shop_name;
        } else {
          validated.validation.valid = false;
          validated.validation.warnings.push(`Customer "${entry.name}" not found in records`);
        }
      }

      if (docType === 'CUSTOMER_LIST' || docType === 'CUSTOMERS') {
        // Check if customer already exists (warning only, it is valid to register a new one)
        const nameToMatch = entry.fields?.shop_name || entry.fields?.owner_name || entry.name;
        const match = fuzzyMatchName(nameToMatch, customers, 'shop_name') ||
          fuzzyMatchName(nameToMatch, customers, 'owner_name');
        if (match) {
          validated.validation.warnings.push(`Customer "${nameToMatch}" matches existing: ${match.shop_name}`);
        }
      }

      if (docType === 'FARMER_LIST' || docType === 'FARMERS') {
        // Check if farmer already exists
        const nameToMatch = entry.fields?.name || entry.name;
        const match = fuzzyMatchName(nameToMatch, farmers, 'name');
        if (match) {
          validated.validation.warnings.push(`Farmer "${nameToMatch}" matches existing: ${match.name}`);
        }
      }

      // Validate date
      if (entry.date) {
        const parsed = parseFlexibleDate(entry.date);
        if (parsed) {
          validated.parsed_date = parsed;
        } else {
          validated.validation.warnings.push(`Could not parse date: "${entry.date}"`);
        }
      }

      return validated;
    })
  };

  return result;
}

function buildOCRResponseMessage(validated) {
  const { document_type, entries = [], confidence } = validated;
  const typeLabel = {
    COLLECTION: '🥛 Milk Collection',
    SALES: '🛒 Sales',
    EXPENSE: '💰 Expense',
    PAYMENT: '💳 Payment',
    CUSTOMER_LIST: '🏪 Customer List',
    CUSTOMERS: '🏪 Customer List',
    FARMER_LIST: '👨‍🌾 Farmer List',
    FARMERS: '👨‍🌾 Farmer List',
    UNKNOWN: '📄 Document'
  }[document_type] || '📄 Document';

  const validCount = entries.filter(e => e.validation?.valid).length;
  const totalCount = entries.length;
  const confPercent = Math.round((confidence || 0) * 100);

  const matchedLabel = (document_type === 'CUSTOMER_LIST' || document_type === 'CUSTOMERS' || document_type === 'FARMER_LIST' || document_type === 'FARMERS') ? 'valid' : 'matched';

  let msg = `**${typeLabel} Data Extracted** (${confPercent}% confidence)\n\n`;
  msg += `Found **${totalCount} entries** — ${validCount} ${matchedLabel}, ${totalCount - validCount} need review.\n\n`;
  msg += `Please review the data below and confirm to save.`;

  return msg;
}

// ─── RESPONSE PARSER ────────────────────────────────────────────────

/**
 * Parse AI response to extract message text and optional action blocks.
 */
function parseAIResponse(rawResponse) {
  const result = {
    type: 'message',
    message: rawResponse,
    action: null
  };

  // Check for action JSON block
  const actionMatch = rawResponse.match(/```action\s*([\s\S]*?)```/);
  if (actionMatch) {
    try {
      const action = JSON.parse(actionMatch[1]);
      result.action = action;
      // Remove action block from display message
      result.message = rawResponse.replace(/```action\s*[\s\S]*?```/, '').trim();
      result.type = 'action';
    } catch {
      // JSON parse failed — keep as plain message
    }
  }

  return result;
}

// ─── ACTION EXECUTOR ────────────────────────────────────────────────

/**
 * Execute a confirmed action through the appStore.
 * Called after user clicks "Confirm" on a DataPreviewCard.
 */
export async function executeAction(action, appStore) {
  const { type, data } = action;

  try {
    switch (type) {
      case 'ADD_COLLECTION': {
        const settings = appStore.getState().settings;
        const fat = parseFloat(data.fat) || 0;
        const qty = parseFloat(data.quantity) || 0;
        const rate = fat * (settings.baseRate || 8.5);
        const totalAmount = rate * qty;
        const paidAmount = parseFloat(data.paid_amount) || 0;
        const dueAmount = Math.max(0, totalAmount - paidAmount);

        const success = await appStore.getState().addMilkCollection({
          farmer_id: data.farmer_id,
          date: data.date || new Date().toISOString().split('T')[0],
          milk_type: data.milk_type || 'Cow',
          quantity: qty,
          fat: fat,
          snf: parseFloat(data.snf) || 8.5,
          calculated_rate: rate,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          due_amount: dueAmount
        });
        return {
          success,
          message: success
            ? `✅ Milk collection saved! ${data.farmer_name || ''} — ${qty}L ${data.milk_type || ''}, Total: ₹${totalAmount.toFixed(2)}`
            : '❌ Failed to save milk collection. Please try again.'
        };
      }

      case 'ADD_EXPENSE': {
        const expenseReason = data.reason || data.description || 'Expense';
        const expenseAmount = parseFloat(data.amount || data.price || 0) || 0;
        const success = await appStore.getState().addExpense({
          date: data.date || new Date().toISOString().split('T')[0],
          reason: expenseReason,
          amount: expenseAmount,
          category: data.category || 'Other',
          payment_method: data.payment_method || 'Cash',
          notes: data.notes || data.comment || ''
        });
        return {
          success,
          message: success
            ? `✅ Expense recorded! ${expenseReason} — ₹${expenseAmount.toLocaleString('en-IN')}`
            : '❌ Failed to save expense. Please try again.'
        };
      }

      case 'ADD_SALE': {
        const totalAmt = parseFloat(data.total_amount || data.total || 0) || 0;
        const paidAmt = parseFloat(data.paid_amount || data.paid || 0) || 0;
        const dueAmt = parseFloat(data.due_amount || data.due || (totalAmt - paidAmt)) || 0;
        const success = await appStore.getState().addSale({
          customer_id: data.customer_id,
          date: data.date || new Date().toISOString().split('T')[0],
          items: data.items || [],
          total_amount: totalAmt,
          paid_amount: paidAmt,
          due_amount: dueAmt
        });
        return {
          success,
          message: success
            ? `✅ Sale recorded! Bill Total: ₹${totalAmt.toLocaleString('en-IN')}`
            : '❌ Failed to save sale. Please try again.'
        };
      }

      case 'RECORD_PAYMENT': {
        const state = appStore.getState();
        const customer = state.customers.find(c => c.customer_id === data.customer_id);
        let amount = parseFloat(data.amount);
        if (isNaN(amount) || data.amount === 'all' || !data.amount) {
          amount = customer ? (customer.current_due || 0) : 0;
        }

        const success = await state.recordCustomerPayment(
          data.customer_id,
          amount
        );
        return {
          success,
          message: success
            ? `✅ Payment of ₹${amount.toLocaleString('en-IN')} recorded for ${data.customer_name || data.customer_id}`
            : '❌ Failed to record payment. Please try again.'
        };
      }

      case 'MARK_FARMER_PAID': {
        const state = appStore.getState();
        let entryId = data.entry_id;
        let amount = parseFloat(data.amount);

        // If entry_id is missing but we have farmer_id, find the oldest collection entry for this farmer with pending due
        if (!entryId && data.farmer_id) {
          const unpaid = (state.collections || [])
            .filter(c => c.farmer_id === data.farmer_id && (c.due_amount || 0) > 0)
            .sort((a, b) => a.date.localeCompare(b.date)); // Oldest first
          if (unpaid.length > 0) {
            entryId = unpaid[0].entry_id;
            if (isNaN(amount) || data.amount === 'all' || !data.amount) {
              amount = unpaid[0].due_amount || 0;
            }
          }
        }

        if (isNaN(amount)) {
          amount = 0;
        }

        if (!entryId) {
          return { success: false, message: '❌ Error: No pending due collection found for this farmer.' };
        }

        const success = await state.markFarmerPaid(entryId, amount);
        return {
          success,
          message: success
            ? `✅ Farmer payment of ₹${amount.toLocaleString('en-IN')} recorded`
            : '❌ Failed to record farmer payment. Please try again.'
        };
      }

      case 'REGISTER_FARMER': {
        const success = await appStore.getState().registerFarmer({
          name: data.name,
          mobile: data.mobile || '',
          address: data.address || '',
          milk_type: data.milk_type || 'Cow'
        });
        return {
          success,
          message: success
            ? `✅ New farmer registered: ${data.name}`
            : '❌ Failed to register farmer. Please try again.'
        };
      }

      case 'ADD_CUSTOMER': {
        const success = await appStore.getState().addCustomer({
          shop_name: data.shop_name,
          owner_name: data.owner_name,
          mobile: data.mobile || '',
          address: data.address || ''
        });
        return {
          success,
          message: success
            ? `✅ New customer added: ${data.shop_name}`
            : '❌ Failed to add customer. Please try again.'
        };
      }

      case 'OCR_CONFIRM': {
        // Batch process OCR entries
        const results = [];
        const entries = data.entries || [];

        for (const entry of entries) {
          if (!entry.validation?.valid) continue;

          if (data.document_type === 'COLLECTION') {
            const settings = appStore.getState().settings;
            const fat = parseFloat(entry.fields?.fat) || 0;
            const qty = parseFloat(entry.fields?.quantity) || 0;
            const rate = fat * (settings.baseRate || 8.5);
            const totalAmount = rate * qty;

            const success = await appStore.getState().addMilkCollection({
              farmer_id: entry.matched_id,
              date: entry.parsed_date || data.extracted_date || new Date().toISOString().split('T')[0],
              milk_type: entry.fields?.milk_type || 'Cow',
              quantity: qty,
              fat: fat,
              snf: parseFloat(entry.fields?.snf) || 8.5,
              calculated_rate: rate,
              total_amount: totalAmount,
              paid_amount: 0,
              due_amount: totalAmount
            });
            results.push({ name: entry.matched_name || entry.name, success });
          } else if (data.document_type === 'EXPENSE') {
            const success = await appStore.getState().addExpense({
              date: entry.parsed_date || data.extracted_date || new Date().toISOString().split('T')[0],
              reason: entry.fields?.reason || entry.name,
              amount: parseFloat(entry.fields?.amount) || 0,
              category: entry.fields?.category || 'Other',
              payment_method: 'Cash',
              notes: 'Added via OCR scan'
            });
            results.push({ name: entry.name, success });
          } else if (data.document_type === 'SALES') {
            const total = parseFloat(entry.fields?.total || entry.fields?.amount || 0);
            const quantity = parseFloat(entry.fields?.quantity || 1);
            const price = parseFloat(entry.fields?.price || total);
            const product = entry.fields?.product || 'Milk';
            const items = [{
              product_id: 'prod_milk',
              product_name: product,
              quantity: quantity,
              price: price,
              total: total || (quantity * price)
            }];
            const success = await appStore.getState().addSale({
              customer_id: entry.matched_id,
              date: entry.parsed_date || data.extracted_date || new Date().toISOString().split('T')[0],
              items: items,
              total_amount: total || (quantity * price),
              paid_amount: 0,
              due_amount: total || (quantity * price)
            });
            results.push({ name: entry.matched_name || entry.name, success });
          } else if (data.document_type === 'PAYMENT') {
            const amount = parseFloat(entry.fields?.amount || 0);
            const isCustomer = entry.matched_id?.startsWith('C-') || entry.matched_id?.startsWith('cust_') || !entry.matched_id?.startsWith('F-');
            let success = false;
            if (isCustomer) {
              success = await appStore.getState().recordCustomerPayment(
                entry.matched_id,
                amount
              );
            } else {
              const state = appStore.getState();
              const unpaid = (state.collections || [])
                .filter(c => c.farmer_id === entry.matched_id && (c.due_amount || 0) > 0)
                .sort((a, b) => a.date.localeCompare(b.date));
              if (unpaid.length > 0) {
                success = await state.markFarmerPaid(unpaid[0].entry_id, amount);
              }
            }
            results.push({ name: entry.matched_name || entry.name, success });
          } else if (data.document_type === 'CUSTOMER_LIST' || data.document_type === 'CUSTOMERS') {
            const shopName = entry.fields?.shop_name || entry.name;
            const ownerName = entry.fields?.owner_name || entry.name;
            const success = await appStore.getState().addCustomer({
              shop_name: shopName,
              owner_name: ownerName,
              mobile: entry.fields?.mobile || '',
              address: entry.fields?.address || ''
            });
            results.push({ name: shopName, success });
          } else if (data.document_type === 'FARMER_LIST' || data.document_type === 'FARMERS') {
            const farmerName = entry.fields?.name || entry.name;
            const success = await appStore.getState().registerFarmer({
              name: farmerName,
              mobile: entry.fields?.mobile || '',
              address: entry.fields?.address || '',
              milk_type: entry.fields?.milk_type || 'Cow'
            });
            results.push({ name: farmerName, success });
          }
        }

        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          message: successCount > 0 
            ? `✅ Saved ${successCount}/${results.length} entries from scanned document.`
            : `❌ Failed to save ${results.length} entries from scanned document.`
        };
      }

      default:
        return { success: false, message: `Unknown action type: ${type}` };
    }
  } catch (err) {
    console.error('executeAction error:', err);
    return { success: false, message: `❌ Error: ${err.message}` };
  }
}

// ─── REPORT GENERATOR ───────────────────────────────────────────────

/**
 * Generate a report from store data.
 */
export function generateLocalReport(reportType, storeSnapshot) {
  const { collections = [], sales = [], expenses = [], farmers = [], customers = [] } = storeSnapshot;
  const today = new Date().toLocaleDateString('en-CA');

  switch (reportType) {
    case 'daily_collection': {
      const todayEntries = collections.filter(c => c.date === today);
      const totalQty = todayEntries.reduce((s, c) => s + (c.quantity || 0), 0);
      const totalAmt = todayEntries.reduce((s, c) => s + (c.total_amount || 0), 0);
      const totalDue = todayEntries.reduce((s, c) => s + (c.due_amount || 0), 0);

      let report = `📊 **Daily Collection Report — ${today}**\n\n`;
      report += `| # | Farmer | Milk | Qty (L) | Fat | Rate | Total |\n`;
      report += `|---|--------|------|---------|-----|------|-------|\n`;
      todayEntries.forEach((e, i) => {
        const farmer = farmers.find(f => f.farmer_id === e.farmer_id);
        report += `| ${i + 1} | ${farmer?.name || e.farmer_id} | ${e.milk_type} | ${e.quantity} | ${e.fat} | ₹${(e.calculated_rate || 0).toFixed(1)} | ₹${(e.total_amount || 0).toFixed(0)} |\n`;
      });
      report += `\n**Totals:** ${totalQty}L collected | ₹${totalAmt.toFixed(0)} value | ₹${totalDue.toFixed(0)} pending`;
      return report;
    }

    case 'daily_sales': {
      const todaySales = sales.filter(s => s.date === today && !s.is_payment_record);
      const totalRevenue = todaySales.reduce((s, c) => s + (c.total_amount || 0), 0);
      const totalPaid = todaySales.reduce((s, c) => s + (c.paid_amount || 0), 0);

      let report = `📊 **Daily Sales Report — ${today}**\n\n`;
      report += `| # | Customer | Amount | Paid | Due | Status |\n`;
      report += `|---|----------|--------|------|-----|--------|\n`;
      todaySales.forEach((s, i) => {
        const customer = customers.find(c => c.customer_id === s.customer_id);
        report += `| ${i + 1} | ${customer?.shop_name || s.customer_id} | ₹${s.total_amount} | ₹${s.paid_amount} | ₹${s.due_amount} | ${s.status} |\n`;
      });
      report += `\n**Totals:** ₹${totalRevenue.toFixed(0)} revenue | ₹${totalPaid.toFixed(0)} collected`;
      return report;
    }

    case 'daily_expense': {
      const todayExp = expenses.filter(e => e.date === today);
      const totalAmt = todayExp.reduce((s, e) => s + (e.amount || 0), 0);

      let report = `📊 **Daily Expense Report — ${today}**\n\n`;
      report += `| # | Reason | Category | Amount |\n`;
      report += `|---|--------|----------|--------|\n`;
      todayExp.forEach((e, i) => {
        report += `| ${i + 1} | ${e.reason} | ${e.category} | ₹${e.amount} |\n`;
      });
      report += `\n**Total Expenses:** ₹${totalAmt.toLocaleString('en-IN')}`;
      return report;
    }

    case 'pending_dues': {
      const farmersWithDues = farmers.filter(f => (f.current_due || 0) > 0);
      const customersWithDues = customers.filter(c => (c.current_due || 0) > 0);

      let report = `📊 **Pending Dues Report**\n\n`;

      if (farmersWithDues.length > 0) {
        report += `**Farmer Dues:**\n`;
        report += `| # | Farmer | Pending |\n|---|--------|---------|\n`;
        farmersWithDues.forEach((f, i) => {
          report += `| ${i + 1} | ${f.name} | ₹${(f.current_due || 0).toLocaleString('en-IN')} |\n`;
        });
        report += `\n`;
      }

      if (customersWithDues.length > 0) {
        report += `**Customer Dues:**\n`;
        report += `| # | Customer | Pending |\n|---|----------|---------|\n`;
        customersWithDues.forEach((c, i) => {
          report += `| ${i + 1} | ${c.shop_name} | ₹${(c.current_due || 0).toLocaleString('en-IN')} |\n`;
        });
      }

      const totalFarmerDues = farmersWithDues.reduce((s, f) => s + (f.current_due || 0), 0);
      const totalCustomerDues = customersWithDues.reduce((s, c) => s + (c.current_due || 0), 0);
      report += `\n**Total Pending:** Farmers ₹${totalFarmerDues.toLocaleString('en-IN')} + Customers ₹${totalCustomerDues.toLocaleString('en-IN')} = ₹${(totalFarmerDues + totalCustomerDues).toLocaleString('en-IN')}`;
      return report;
    }

    case 'profit_loss': {
      const totalRevenue = sales.reduce((s, c) => s + (c.total_amount || 0), 0);
      const totalFarmerPayments = collections.reduce((s, c) => s + (c.paid_amount || 0), 0);
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalFarmerPayments - totalExpenses;

      let report = `📊 **Profit & Loss Summary**\n\n`;
      report += `| Item | Amount |\n|------|--------|\n`;
      report += `| Total Revenue | ₹${totalRevenue.toLocaleString('en-IN')} |\n`;
      report += `| Farmer Payments | ₹${totalFarmerPayments.toLocaleString('en-IN')} |\n`;
      report += `| Operating Expenses | ₹${totalExpenses.toLocaleString('en-IN')} |\n`;
      report += `| **Net Profit** | **₹${netProfit.toLocaleString('en-IN')}** |\n`;
      return report;
    }

    default:
      return null;
  }
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────

/**
 * Fuzzy-match a name against a list of records.
 * Returns the best matching record or null.
 */
function fuzzyMatchName(input, records, nameField) {
  if (!input || !records.length) return null;

  const normalized = input.toLowerCase().trim();

  // Exact match first
  const exact = records.find(r => (r[nameField] || '').toLowerCase().trim() === normalized);
  if (exact) return exact;

  // Partial / contains match
  const partial = records.find(r => {
    const name = (r[nameField] || '').toLowerCase().trim();
    return name.includes(normalized) || normalized.includes(name);
  });
  if (partial) return partial;

  // Word-level match (any word matches)
  const inputWords = normalized.split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const record of records) {
    const name = (record[nameField] || '').toLowerCase().trim();
    const nameWords = name.split(/\s+/);

    let matchCount = 0;
    for (const word of inputWords) {
      if (word.length >= 3 && nameWords.some(nw => nw.includes(word) || word.includes(nw))) {
        matchCount++;
      }
    }

    const score = matchCount / Math.max(inputWords.length, nameWords.length);
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = record;
    }
  }

  return bestMatch;
}

/**
 * Parse flexible date formats into YYYY-MM-DD.
 */
function parseFlexibleDate(dateStr) {
  if (!dateStr) return null;

  const str = dateStr.toLowerCase().trim();
  const today = new Date();

  // Relative dates
  if (str === 'today' || str === 'आज') {
    return today.toLocaleDateString('en-CA');
  }
  if (str === 'yesterday' || str === 'काल') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  }

  // Try standard formats
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // Try native Date parsing as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-CA');
  }

  return null;
}
