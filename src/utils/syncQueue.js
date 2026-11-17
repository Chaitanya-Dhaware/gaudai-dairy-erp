/**
 * Sync Queue – Background Google Sheets Synchronization via Serverless Proxy
 * 
 * Architecture:
 *   User Action → Firestore Write (immediate source of truth) → Success to user
 *   → Queue sync job → Background POST via callGasProxy (/api/gas-proxy) → Google Sheets updated
 * 
 * Security & Reliability Features:
 *   - Fresh Firebase ID token on every retry via apiClient.
 *   - Permanent 4xx errors (401, 403, 400) do NOT retry forever; marked as failed and recorded in Firestore sync_failures.
 *   - Network errors and 5xx errors retry with exponential backoff up to MAX_RETRIES.
 *   - Unique idempotency key per operation ensures no lost or duplicate transactions.
 *   - LocalStorage persistence for crash recovery.
 */

import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { saveDailySpreadsheetMapping } from './firestoreService';
import { callGasProxy } from './apiClient';

const STORAGE_KEY = 'GAUDAI_SYNC_QUEUE';
const FAILED_STORAGE_KEY = 'GAUDAI_SYNC_FAILED';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MAX_FAILED_HISTORY = 50;

let queue = [];
let failedJobs = [];
let isProcessing = false;

/**
 * Initialize queue from localStorage on app start.
 */
export function initSyncQueue() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        queue = parsed;
        if (queue.length > 0) {
          processQueue();
        }
      }
    }
  } catch (e) {
    console.error('Failed to restore sync queue:', e);
    queue = [];
  }

  try {
    const savedFailed = localStorage.getItem(FAILED_STORAGE_KEY);
    if (savedFailed) {
      const parsedFailed = JSON.parse(savedFailed);
      if (Array.isArray(parsedFailed)) {
        failedJobs = parsedFailed;
      }
    }
  } catch (e) {
    console.error('Failed to restore failed sync jobs:', e);
    failedJobs = [];
  }
}

/**
 * Reset in-memory queue state (for testing).
 */
export function _resetQueueForTesting() {
  queue = [];
  failedJobs = [];
  isProcessing = false;
}

/**
 * Add a sync job to the queue with idempotency key.
 * @param {string} action - GAS action name (e.g., 'addMilkCollection')
 * @param {object} payload - Data to send to GAS (sheet IDs are omitted)
 * @param {string} [operationId] - Unique ID for deduplication and idempotency
 */
export function enqueueSyncJob(action, payload, operationId) {
  const id = operationId || `${action}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Deduplication: skip if same operation is already queued
  if (queue.some(job => job.id === id)) {
    return;
  }

  // Remove any legacy spreadsheet IDs from payload before enqueueing
  const cleanPayload = { ...payload };
  delete cleanPayload.sheetsIdMaster;
  delete cleanPayload.sheetsIdCollection;
  delete cleanPayload.sheetsIdCustomer;
  delete cleanPayload.sheetsIdExpense;

  const job = {
    id,
    action,
    payload: cleanPayload,
    idempotencyKey: id,
    retries: 0,
    createdAt: Date.now()
  };

  queue.push(job);
  persistQueue();
  processQueue();
}

/**
 * Persist queue to localStorage for crash recovery.
 */
function persistQueue() {
  if (failedJobs.length > MAX_FAILED_HISTORY) {
    failedJobs = failedJobs.slice(-MAX_FAILED_HISTORY);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(failedJobs));
  } catch (e) {
    console.warn('Storage quota or access error while persisting queue. Attempting recovery...', e);
    // Quota recovery: evict failed jobs history first to protect pending queue writes
    try {
      failedJobs = failedJobs.slice(-10);
      localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(failedJobs));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      try {
        localStorage.removeItem(FAILED_STORAGE_KEY);
        failedJobs = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      } catch (fatal) {
        console.error('Critical: Failed to persist pending sync queue even after evicting history:', fatal);
      }
    }
  }
}

/**
 * Process the queue sequentially.
 */
export async function processQueue(deps = {}) {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const proxyCall = deps.callGasProxy || callGasProxy;

  while (queue.length > 0) {
    const job = queue[0];
    
    try {
      // Every attempt requests with a fresh token through callGasProxy
      const result = await proxyCall(job.action, {
        ...job.payload,
        idempotencyKey: job.idempotencyKey
      });
      
      if (result && result.success) {
        // If GAS returned daily spreadsheet metadata, persist to Firestore
        if (result.dailySpreadsheet && result.dailySpreadsheet.date) {
          try {
            await saveDailySpreadsheetMapping(result.dailySpreadsheet);
          } catch (mappingErr) {
            console.warn('Failed to save daily spreadsheet mapping:', mappingErr);
          }
        }
        // Remove completed job
        queue.shift();
        persistQueue();
      } else {
        const statusCode = result?.code || (result?.status ? Number(result.status) : 0);
        const RETRYABLE_4XX = new Set([408, 425, 429]);
        const isClientAuthError = statusCode >= 400 && statusCode < 500 && !RETRYABLE_4XX.has(statusCode);

        if (isClientAuthError) {
          // Non-retryable 4xx client/auth/authorization error
          console.error(`Sync job ${job.id} failed with permanent client error ${statusCode}. Not retrying.`);
          job.failedReason = result?.error || `Permanent error (${statusCode})`;
          failedJobs.push(job);
          await logSyncFailure(job, job.failedReason);
          queue.shift();
          persistQueue();
        } else {
          // Transient failure (network error or 5xx): retry with exponential backoff
          job.retries++;
          if (job.retries >= MAX_RETRIES) {
            console.error(`Sync job ${job.id} failed after ${MAX_RETRIES} retries. Logging failure.`);
            job.failedReason = result?.error || 'Max retries exceeded';
            failedJobs.push(job);
            await logSyncFailure(job, job.failedReason);
            queue.shift();
            persistQueue();
          } else {
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, job.retries), MAX_DELAY_MS);
            persistQueue();
            await sleep(delay);
          }
        }
      }
    } catch (err) {
      console.error(`Sync job ${job.id} unexpected error:`, err);
      job.retries++;
      if (job.retries >= MAX_RETRIES) {
        job.failedReason = err.message || 'Max retries exceeded';
        failedJobs.push(job);
        await logSyncFailure(job, job.failedReason);
        queue.shift();
        persistQueue();
      } else {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, job.retries), MAX_DELAY_MS);
        persistQueue();
        await sleep(delay);
      }
    }
  }

  isProcessing = false;
}

/**
 * Log a persistent sync failure to Firestore for admin review.
 */
async function logSyncFailure(job, errorMessage) {
  try {
    const failureId = `sync_fail_${Date.now()}`;
    await setDoc(doc(db, 'sync_failures', failureId), {
      id: failureId,
      jobId: job.id,
      action: job.action,
      payload: JSON.stringify(job.payload).substring(0, 2000), // Truncate large payloads
      retries: job.retries,
      error: errorMessage || 'Permanent sync error',
      createdAt: new Date(job.createdAt).toISOString(),
      failedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log sync failure to Firestore:', err);
  }
}

/**
 * Get current queue status (for dashboard / admin sync UI).
 */
export function getSyncQueueStatus() {
  return {
    pending: queue.length,
    failed: failedJobs.length,
    isProcessing,
    jobs: queue.map(j => ({
      id: j.id,
      action: j.action,
      retries: j.retries,
      age: Date.now() - j.createdAt
    })),
    failedJobs: failedJobs.map(j => ({
      id: j.id,
      action: j.action,
      retries: j.retries,
      reason: j.failedReason,
      age: Date.now() - j.createdAt
    }))
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
