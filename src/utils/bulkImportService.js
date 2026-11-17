/**
 * Bulk Import Service for Gaudai Dairy ERP
 * Provides robust, batched, idempotent, and fault-tolerant imports
 * for Customers, Farmers, Collections, and other ERP entities.
 */

import { db, auth } from './firebase.js';
import { collection, doc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { invalidateCache } from './cache.js';

/**
 * Standardize Indian mobile numbers.
 * Cleans formatting, handles +91/0 prefixes, and detects invalid lengths.
 */
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return { phone: '', isValid: false, isAmbiguous: false };
  const cleaned = String(rawPhone).trim().replace(/[^\d+]/g, '');
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return { phone: digitsOnly, isValid: true, isAmbiguous: false };
  }
  // 11 digits starting with 0 (e.g. 09876543210) -> extract last 10
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return { phone: digitsOnly.slice(1), isValid: true, isAmbiguous: false };
  }
  // 12 digits starting with 91 (e.g. 919876543210) -> extract last 10
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return { phone: digitsOnly.slice(2), isValid: true, isAmbiguous: false };
  }
  // 11 digits without leading 0 (e.g. typo in sheet like 94218368056) -> keep original digits with flag
  if (digitsOnly.length > 0) {
    return { phone: digitsOnly, isValid: true, isAmbiguous: digitsOnly.length !== 10 };
  }
  return { phone: '', isValid: false, isAmbiguous: false };
}

/**
 * Normalize whitespace and Unicode text.
 */
export function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\u00A0/g, ' ') // replace non-breaking spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Execute a function with bounded exponential backoff retries.
 */
async function withRetry(fn, maxRetries = 3, initialDelay = 500) {
  let attempt = 0;
  let delay = initialDelay;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

/**
 * Bulk import customer records into Firestore.
 *
 * @param {Array<Object>} records - Array of raw or OCR customer entries
 * @param {Object} options
 * @param {boolean} [options.skipDuplicates=true] - Skip records matching existing phone/shop name
 * @param {boolean} [options.updateExisting=false] - Update matching records instead of skipping
 * @param {boolean} [options.dryRun=false] - Only validate and preview without writing
 * @param {Object} [options.user] - Authenticated user object for permission check
 * @returns {Promise<Object>} Detailed execution report
 */
export async function bulkImportCustomers(records, options = {}) {
  const {
    skipDuplicates = true,
    updateExisting = false,
    dryRun = false,
    user = null
  } = options;

  const jobId = `import_cust_${Date.now()}`;
  const startTime = Date.now();

  // 1. Authorization Check
  // Check either passed user object or current Firebase Auth
  const currentUser = user || auth.currentUser;
  const isAuthValid = currentUser && (
    ['superadmin', 'admin', 'staff', 'accountant'].includes(currentUser.role) ||
    Boolean(auth.currentUser)
  );

  if (!isAuthValid && !dryRun) {
    return {
      jobId,
      success: false,
      stage: 'authorization',
      totalAttempted: records?.length || 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: records?.length || 0,
      error: 'Unauthorized: Administrative or staff session required to write customer records.',
      canRetry: true,
      records: []
    };
  }

  if (!records || records.length === 0) {
    return {
      jobId,
      success: true,
      stage: 'complete',
      totalAttempted: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      records: []
    };
  }

  // 2. Fetch existing customers to identify existing IDs & duplicates
  let existingCustomers = [];
  let maxIdNum = 0;

  try {
    const snap = await getDocs(collection(db, 'customers'));
    snap.forEach(d => {
      const data = d.data();
      existingCustomers.push({ ...data, id: d.id });
      const cid = data.customer_id || d.id;
      if (cid) {
        const num = parseInt(cid.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxIdNum) {
          maxIdNum = num;
        }
      }
    });
  } catch (err) {
    console.warn('Failed to pre-fetch existing customers from Firestore:', err.message);
    // If permission or offline, we will attempt write or report
    if (!dryRun) {
      return {
        jobId,
        success: false,
        stage: 'database_query',
        totalAttempted: records.length,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: records.length,
        error: `Database access error: ${err.message}`,
        canRetry: true,
        records: []
      };
    }
  }

  const existingPhoneMap = new Map();
  const existingNameMap = new Map();

  existingCustomers.forEach(c => {
    if (c.mobile) {
      const norm = normalizePhoneNumber(c.mobile).phone;
      if (norm) existingPhoneMap.set(norm, c);
    }
    if (c.shop_name) {
      existingNameMap.set(normalizeText(c.shop_name).toLowerCase(), c);
    }
  });

  // 3. Process, Validate, and Prepare Records
  const processedRecords = [];
  const filePhoneMap = new Map();
  const fileNameMap = new Map();

  let nextIdCounter = maxIdNum;

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 1;

    // Field mapping from various sources (Excel, PDF OCR, API)
    const rawShop = raw.shop_name || raw.shop || raw.name || raw['Company name'] || raw['Company'] || raw.fields?.shop_name || '';
    const rawOwner = raw.owner_name || raw.owner || raw['Owner'] || raw.fields?.owner_name || rawShop;
    const rawAddr = raw.address || raw['Address'] || raw.fields?.address || '';
    const rawPhone = raw.mobile || raw.phone || raw['Phone'] || raw.fields?.mobile || '';

    const shopName = normalizeText(rawShop);
    const ownerName = normalizeText(rawOwner) || shopName;
    const address = normalizeText(rawAddr);
    const phoneNorm = normalizePhoneNumber(rawPhone);

    const recordStatus = {
      index: i,
      rowNum,
      shop_name: shopName,
      owner_name: ownerName,
      address,
      mobile: phoneNorm.phone,
      isPhoneAmbiguous: phoneNorm.isAmbiguous,
      status: 'pending', // 'created', 'updated', 'skipped_duplicate', 'failed'
      reason: ''
    };

    // Validation
    if (!shopName && !ownerName) {
      recordStatus.status = 'failed';
      recordStatus.reason = 'Missing shop name and owner name';
      processedRecords.push(recordStatus);
      continue;
    }

    // Check duplicate within the uploaded file
    const lowerName = (shopName || ownerName).toLowerCase();
    if (phoneNorm.phone && filePhoneMap.has(phoneNorm.phone)) {
      recordStatus.status = 'skipped_duplicate';
      recordStatus.reason = `Duplicate phone (${phoneNorm.phone}) matches row ${filePhoneMap.get(phoneNorm.phone)}`;
      processedRecords.push(recordStatus);
      continue;
    }
    if (lowerName && fileNameMap.has(lowerName)) {
      recordStatus.status = 'skipped_duplicate';
      recordStatus.reason = `Duplicate name ("${shopName}") matches row ${fileNameMap.get(lowerName)}`;
      processedRecords.push(recordStatus);
      continue;
    }

    if (phoneNorm.phone) filePhoneMap.set(phoneNorm.phone, rowNum);
    if (lowerName) fileNameMap.set(lowerName, rowNum);

    // Check duplicate against existing database records
    const existingByPhone = phoneNorm.phone ? existingPhoneMap.get(phoneNorm.phone) : null;
    const existingByName = lowerName ? existingNameMap.get(lowerName) : null;
    const existingMatch = existingByPhone || existingByName;

    if (existingMatch) {
      if (skipDuplicates && !updateExisting) {
        recordStatus.status = 'skipped_duplicate';
        recordStatus.matchedId = existingMatch.customer_id;
        recordStatus.reason = `Matches existing database customer "${existingMatch.shop_name}" (${existingMatch.customer_id})`;
        processedRecords.push(recordStatus);
        continue;
      } else if (updateExisting) {
        recordStatus.status = 'to_update';
        recordStatus.customer_id = existingMatch.customer_id;
        processedRecords.push(recordStatus);
        continue;
      }
    }

    // Assign new sequential customer ID
    nextIdCounter++;
    recordStatus.customer_id = `c-${String(nextIdCounter).padStart(2, '0')}`;
    recordStatus.status = 'to_create';
    processedRecords.push(recordStatus);
  }

  // If dry run, return preview calculation without database writes
  if (dryRun) {
    return {
      jobId,
      success: true,
      stage: 'preview',
      totalAttempted: processedRecords.length,
      createdCount: processedRecords.filter(r => r.status === 'to_create').length,
      updatedCount: processedRecords.filter(r => r.status === 'to_update').length,
      skippedCount: processedRecords.filter(r => r.status === 'skipped_duplicate').length,
      failedCount: processedRecords.filter(r => r.status === 'failed').length,
      records: processedRecords
    };
  }

  // 4. Batch Writes to Firestore (Chunk size: 50 records per batch)
  const toCreate = processedRecords.filter(r => r.status === 'to_create');
  const toUpdate = processedRecords.filter(r => r.status === 'to_update');

  const operationsToExecute = [
    ...toCreate.map(r => ({ op: 'create', record: r })),
    ...toUpdate.map(r => ({ op: 'update', record: r }))
  ];

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = processedRecords.filter(r => r.status === 'failed').length;
  const skippedCount = processedRecords.filter(r => r.status === 'skipped_duplicate').length;

  const BATCH_SIZE = 50;
  for (let b = 0; b < operationsToExecute.length; b += BATCH_SIZE) {
    const chunk = operationsToExecute.slice(b, b + BATCH_SIZE);
    const batch = writeBatch(db);

    const chunkItems = [];

    for (const item of chunk) {
      const rec = item.record;
      const custDocRef = doc(db, 'customers', rec.customer_id);

      if (item.op === 'create') {
        const payload = {
          customer_id: rec.customer_id,
          shop_name: rec.shop_name,
          owner_name: rec.owner_name,
          mobile: rec.mobile,
          address: rec.address,
          current_due: 0,
          created_at: new Date().toISOString(),
          source: 'bulk_import',
          import_job_id: jobId
        };
        batch.set(custDocRef, payload);
        chunkItems.push({ item, payload });
      } else if (item.op === 'update') {
        const updatePayload = {
          shop_name: rec.shop_name,
          owner_name: rec.owner_name,
          mobile: rec.mobile,
          address: rec.address,
          updated_at: new Date().toISOString()
        };
        batch.set(custDocRef, updatePayload, { merge: true });
        chunkItems.push({ item, payload: updatePayload });
      }
    }

    try {
      await withRetry(() => batch.commit());
      chunkItems.forEach(({ item }) => {
        if (item.op === 'create') {
          item.record.status = 'created';
          createdCount++;
        } else {
          item.record.status = 'updated';
          updatedCount++;
        }
      });
    } catch (batchErr) {
      console.error(`Batch commit failed for chunk ${b / BATCH_SIZE + 1}:`, batchErr);
      // Fallback: Attempt individual writes for this chunk to isolate the failing record
      for (const { item, payload } of chunkItems) {
        try {
          const singleRef = doc(db, 'customers', item.record.customer_id);
          if (item.op === 'create') {
            await setDoc(singleRef, payload);
            item.record.status = 'created';
            createdCount++;
          } else {
            await setDoc(singleRef, payload, { merge: true });
            item.record.status = 'updated';
            updatedCount++;
          }
        } catch (singleErr) {
          item.record.status = 'failed';
          item.record.reason = singleErr.message || 'Write operation failed';
          failedCount++;
        }
      }
    }
  }

  // Invalidate cache so store and UI pick up the freshly imported customers
  invalidateCache('customers');

  const durationMs = Date.now() - startTime;

  return {
    jobId,
    success: createdCount > 0 || updatedCount > 0 || (records.length === skippedCount),
    stage: 'complete',
    durationMs,
    totalAttempted: records.length,
    createdCount,
    updatedCount,
    skippedCount,
    failedCount,
    records: processedRecords
  };
}
