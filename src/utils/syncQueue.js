/**
 * Sync Queue – Background Google Sheets Synchronization
 * 
 * Architecture:
 *   User Action → Firestore Write (immediate) → Success to user
 *   → Queue sync job → Background POST to GAS → Google Sheets updated
 * 
 * Features:
 *   - In-memory queue with localStorage persistence for crash recovery
 *   - Retry with exponential backoff (1s, 2s, 4s, max 30s)
 *   - Deduplication by operation ID
 *   - Failure logging to Firestore sync_failures collection
 *   - Processes queue items sequentially to avoid GAS rate limits
 */

import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { saveDailySpreadsheetMapping } from './firestoreService';

const STORAGE_KEY = 'GAUDAI_SYNC_QUEUE';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

let queue = [];
let isProcessing = false;

/**
 * Initialize queue from localStorage on app start.
 */
export function initSyncQueue() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      queue = JSON.parse(saved);
      // Start processing any pending items
      if (queue.length > 0) {
        processQueue();
      }
    }
  } catch (e) {
    console.error('Failed to restore sync queue:', e);
    queue = [];
  }
}

/**
 * Add a sync job to the queue.
 * @param {string} action - GAS action name (e.g., 'addMilkCollection')
 * @param {object} payload - Data to send to GAS
 * @param {string} [operationId] - Unique ID for deduplication
 */
export function enqueueSyncJob(action, payload, operationId) {
  const id = operationId || `${action}_${Date.now()}`;
  
  // Deduplication: skip if same operation is already queued
  if (queue.some(job => job.id === id)) {
    return;
  }

  const job = {
    id,
    action,
    payload,
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to persist sync queue:', e);
  }
}

/**
 * Process the queue sequentially.
 * GAS has rate limits, so we process one at a time.
 */
async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue[0];
    
    try {
      const result = await sendToGAS(job.action, job.payload);
      
      if (result) {
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
        // Retry logic
        job.retries++;
        if (job.retries >= MAX_RETRIES) {
          // Max retries exceeded — log failure and remove
          console.error(`Sync job ${job.id} failed after ${MAX_RETRIES} retries. Logging failure.`);
          await logSyncFailure(job);
          queue.shift();
          persistQueue();
        } else {
          // Exponential backoff
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, job.retries), MAX_DELAY_MS);
          persistQueue();
          await sleep(delay);
        }
      }
    } catch (err) {
      console.error(`Sync job ${job.id} error:`, err);
      job.retries++;
      if (job.retries >= MAX_RETRIES) {
        await logSyncFailure(job, err.message);
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
 * Send a single action to Google Apps Script.
 * Returns the parsed result object on success, null on failure.
 */
async function sendToGAS(action, payload) {
  const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('placeholder')) {
    // Mock mode — consider sync successful
    return { success: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`GAS sync failed for ${action}: HTTP ${res.status}`);
      return null;
    }

    const result = await res.json();
    return (result && result.success) ? result : null;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`GAS sync timeout for ${action}`);
    } else {
      console.error(`GAS sync error for ${action}:`, err);
    }
    return null;
  }
}

/**
 * Log a persistent sync failure to Firestore for admin review.
 */
async function logSyncFailure(job, errorMessage) {
  try {
    const failureId = `sync_fail_${Date.now()}`;
    await setDoc(doc(db, 'sync_failures', failureId), {
      id: failureId,
      action: job.action,
      payload: JSON.stringify(job.payload).substring(0, 2000), // Truncate large payloads
      retries: job.retries,
      error: errorMessage || 'Max retries exceeded',
      createdAt: new Date(job.createdAt).toISOString(),
      failedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log sync failure:', err);
  }
}

/**
 * Get current queue status (for debugging / admin UI).
 */
export function getSyncQueueStatus() {
  return {
    pending: queue.length,
    isProcessing,
    jobs: queue.map(j => ({
      id: j.id,
      action: j.action,
      retries: j.retries,
      age: Date.now() - j.createdAt
    }))
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
