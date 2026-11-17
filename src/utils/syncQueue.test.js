import { describe, it, expect, vi, beforeEach } from 'vitest';

const localStorageStore = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key) => localStorageStore[key] || null,
    setItem: (key, value) => { localStorageStore[key] = String(value); },
    removeItem: (key) => { delete localStorageStore[key]; },
    clear: () => {
      for (const key in localStorageStore) {
        delete localStorageStore[key];
      }
    }
  },
  writable: true
});

vi.mock('./firebase', () => ({
  db: {},
  auth: { currentUser: null }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue()
}));

vi.mock('./firestoreService', () => ({
  saveDailySpreadsheetMapping: vi.fn().mockResolvedValue()
}));

const mockCallGasProxy = vi.fn();
vi.mock('./apiClient', () => ({
  callGasProxy: (...args) => mockCallGasProxy(...args)
}));

import { enqueueSyncJob, getSyncQueueStatus, _resetQueueForTesting } from './syncQueue';

describe('syncQueue background processor', () => {
  beforeEach(() => {
    localStorage.clear();
    mockCallGasProxy.mockReset();
    _resetQueueForTesting();
  });

  it('strips legacy sheet IDs from payload before enqueueing and sending to proxy', async () => {
    mockCallGasProxy.mockResolvedValue({ success: true });

    enqueueSyncJob('addMilkCollection', {
      farmer_id: 'F001',
      liters: 10,
      sheetsIdMaster: 'legacy-master',
      sheetsIdCollection: 'legacy-col',
      sheetsIdCustomer: 'legacy-cust',
      sheetsIdExpense: 'legacy-exp'
    }, 'op_strip_test');

    await new Promise(r => setTimeout(r, 20));

    expect(mockCallGasProxy).toHaveBeenCalledTimes(1);
    const [action, sentPayload] = mockCallGasProxy.mock.calls[0];
    expect(action).toBe('addMilkCollection');
    expect(sentPayload.farmer_id).toBe('F001');
    expect(sentPayload.liters).toBe(10);
    expect(sentPayload.sheetsIdMaster).toBeUndefined();
    expect(sentPayload.sheetsIdCollection).toBeUndefined();
    expect(sentPayload.sheetsIdCustomer).toBeUndefined();
    expect(sentPayload.sheetsIdExpense).toBeUndefined();
    expect(sentPayload.idempotencyKey).toBe('op_strip_test');
  });

  it('deduplicates jobs with identical operation IDs', async () => {
    let resolver;
    const delayedPromise = new Promise(resolve => { resolver = resolve; });
    mockCallGasProxy.mockReturnValue(delayedPromise);

    enqueueSyncJob('addSale', { sale_id: 'S1' }, 'dedup_op_1');
    enqueueSyncJob('addSale', { sale_id: 'S1_duplicate' }, 'dedup_op_1');

    const status = getSyncQueueStatus();
    expect(status.pending).toBe(1);

    resolver({ success: true });
    await new Promise(r => setTimeout(r, 10));
  });

  it('drops permanent 403 authorization errors immediately without infinite retry loops', async () => {
    mockCallGasProxy.mockResolvedValue({
      success: false,
      code: 403,
      error: 'Access denied: role accountant cannot call addMilkCollection'
    });

    enqueueSyncJob('addMilkCollection', { farmer_id: 'F002' }, 'perm_fail_403');

    await new Promise(r => setTimeout(r, 20));

    expect(mockCallGasProxy).toHaveBeenCalledTimes(1);
    const status = getSyncQueueStatus();
    expect(status.pending).toBe(0);
    expect(status.failed).toBe(1);
    expect(status.failedJobs[0].id).toBe('perm_fail_403');
    expect(status.failedJobs[0].reason).toContain('Access denied');
  });

  it('drops 400 bad request errors immediately without retrying', async () => {
    mockCallGasProxy.mockResolvedValue({
      success: false,
      code: 400,
      error: 'Invalid action payload'
    });

    enqueueSyncJob('unknownAction', {}, 'perm_fail_400');

    await new Promise(r => setTimeout(r, 20));

    expect(mockCallGasProxy).toHaveBeenCalledTimes(1);
    const status = getSyncQueueStatus();
    expect(status.pending).toBe(0);
    expect(status.failed).toBe(1);
  });
});
