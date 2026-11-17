import { describe, it, expect, vi } from 'vitest';
import { apiRequest, callGasProxy, callGemini, callUsersApi } from './apiClient';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('apiClient', () => {
  it('returns 401 and sign-in error when no user is signed in', async () => {
    const mockAuth = { currentUser: null };
    const res = await apiRequest('/api/test', {}, { auth: mockAuth });
    expect(res.success).toBe(false);
    expect(res.code).toBe(401);
    expect(res.error).toContain('लॉगिन करा');
  });

  it('retries with forced token refresh on 401 and succeeds if retry returns 200', async () => {
    let callCount = 0;
    const getIdToken = vi.fn().mockImplementation((force) => {
      if (force) return Promise.resolve('refreshed-token');
      return Promise.resolve('initial-token');
    });

    const mockAuth = {
      currentUser: { getIdToken }
    };

    const mockFetch = vi.fn().mockImplementation((url, opts) => {
      callCount++;
      if (callCount === 1) {
        expect(opts.headers.Authorization).toBe('Bearer initial-token');
        return Promise.resolve({
          status: 401,
          ok: false,
          json: async () => ({ error: 'Token expired' })
        });
      }
      expect(opts.headers.Authorization).toBe('Bearer refreshed-token');
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: 'all-good' })
      });
    });

    const onSignOut = vi.fn();
    const res = await apiRequest('/api/gas-proxy', {}, {
      auth: mockAuth,
      fetch: mockFetch,
      onSignOut
    });

    expect(callCount).toBe(2);
    expect(getIdToken).toHaveBeenCalledWith(false);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(onSignOut).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.data).toBe('all-good');
  });

  it('signs user out and returns bilingual unauthorized error when 401 persists after token refresh', async () => {
    const getIdToken = vi.fn().mockImplementation((force) => {
      if (force) return Promise.resolve('refreshed-token');
      return Promise.resolve('initial-token');
    });

    const mockAuth = {
      currentUser: { getIdToken }
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Invalid token' })
    });

    const onSignOut = vi.fn();
    const res = await apiRequest('/api/gas-proxy', {}, {
      auth: mockAuth,
      fetch: mockFetch,
      onSignOut
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
    expect(res.code).toBe(401);
    expect(res.error).toContain('सत्र संपले आहे');
    expect(res.error).toContain('Session expired');
  });

  it('signs user out and returns bilingual unauthorized error when getIdToken(true) rejects', async () => {
    const getIdToken = vi.fn().mockImplementation((force) => {
      if (force) return Promise.reject(new Error('User disabled or deleted'));
      return Promise.resolve('initial-token');
    });

    const mockAuth = {
      currentUser: { getIdToken }
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Unauthorized' })
    });

    const onSignOut = vi.fn();
    const res = await apiRequest('/api/gas-proxy', {}, {
      auth: mockAuth,
      fetch: mockFetch,
      onSignOut
    });

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
    expect(res.code).toBe(401);
    expect(res.error).toContain('सत्र संपले आहे');
  });

  it('returns bilingual forbidden error on 403 status without signing out', async () => {
    const mockAuth = {
      currentUser: { getIdToken: vi.fn().mockResolvedValue('valid-token') }
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      json: async () => ({ error: 'Access denied: role accountant cannot call clearTransactions' })
    });

    const onSignOut = vi.fn();
    const res = await apiRequest('/api/gas-proxy', {}, {
      auth: mockAuth,
      fetch: mockFetch,
      onSignOut
    });

    expect(onSignOut).not.toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.code).toBe(403);
    expect(res.error).toContain('परवानगी नाही');
    expect(res.error).toContain('permission');
  });

  it('shields internal 500 error details with generic bilingual server error message', async () => {
    const mockAuth = {
      currentUser: { getIdToken: vi.fn().mockResolvedValue('valid-token') }
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ error: 'Internal Database Connection Crash: raw stack trace' })
    });

    const res = await apiRequest('/api/gemini', {}, {
      auth: mockAuth,
      fetch: mockFetch
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe(500);
    expect(res.error).toContain('सर्व्हर त्रुटी आली');
    expect(res.error).toContain('server error occurred');
    expect(res.error).not.toContain('Database Connection Crash');
  });

  it('catches network fetch failure and marks isNetworkError true', async () => {
    const mockAuth = {
      currentUser: { getIdToken: vi.fn().mockResolvedValue('valid-token') }
    };

    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const res = await apiRequest('/api/gemini', {}, {
      auth: mockAuth,
      fetch: mockFetch
    });

    expect(res.success).toBe(false);
    expect(res.isNetworkError).toBe(true);
    expect(res.error).toContain('नेटवर्क त्रुटी');
  });

  it('callGasProxy invokes /api/gas-proxy with action and data payload', async () => {
    const mockAuth = {
      currentUser: { getIdToken: vi.fn().mockResolvedValue('token-abc') }
    };

    let requestedUrl = '';
    let requestedOptions = {};

    const mockFetch = vi.fn().mockImplementation((url, opts) => {
      requestedUrl = url;
      requestedOptions = opts;
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: { count: 42 } })
      });
    });

    const res = await callGasProxy('batchLoadData', { type: 'summary' }, {
      auth: mockAuth,
      fetch: mockFetch
    });

    expect(res.success).toBe(true);
    expect(requestedUrl).toBe('/api/gas-proxy');
    expect(requestedOptions.method).toBe('POST');
    const parsedBody = JSON.parse(requestedOptions.body);
    expect(parsedBody.action).toBe('batchLoadData');
    expect(parsedBody.data).toEqual({ type: 'summary' });
  });

  it('callGemini invokes /api/gemini with prompt payload', async () => {
    const mockAuth = {
      currentUser: { getIdToken: vi.fn().mockResolvedValue('token-abc') }
    };

    let requestedUrl = '';
    let requestedOptions = {};

    const mockFetch = vi.fn().mockImplementation((url, opts) => {
      requestedUrl = url;
      requestedOptions = opts;
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => ({ success: true, text: 'AI response' })
      });
    });

    const res = await callGemini({ prompt: 'Hello', model: 'gemini-2.0-flash' }, {
      auth: mockAuth,
      fetch: mockFetch
    });

    expect(res.success).toBe(true);
    expect(requestedUrl).toBe('/api/gemini');
    const parsedBody = JSON.parse(requestedOptions.body);
    expect(parsedBody.prompt).toBe('Hello');
  });

  it('callUsersApi invokes /api/users with action and user parameters', async () => {
    const mockAuth = {
      currentUser: { getIdToken: vi.fn().mockResolvedValue('token-sa') }
    };

    let requestedUrl = '';
    let requestedOptions = {};

    const mockFetch = vi.fn().mockImplementation((url, opts) => {
      requestedUrl = url;
      requestedOptions = opts;
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => ({ success: true, uid: 'new-uid' })
      });
    });

    const res = await callUsersApi('createUser', { email: 'staff@test.local', role: 'staff' }, {
      auth: mockAuth,
      fetch: mockFetch
    });

    expect(res.success).toBe(true);
    expect(requestedUrl).toBe('/api/users');
    const parsedBody = JSON.parse(requestedOptions.body);
    expect(parsedBody.action).toBe('createUser');
    expect(parsedBody.email).toBe('staff@test.local');
  });
});

describe('Security Guard: Zero Frontend Secret References', () => {
  it('ensures no file under src/ reads VITE_GEMINI_API_KEY or VITE_APPS_SCRIPT_URL', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = [];

    function scan(dir) {
      for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (/\.(jsx?|tsx?)$/.test(item)) {
          files.push(fullPath);
        }
      }
    }

    scan(srcDir);

    const forbiddenPatterns = [
      'VITE_GEMINI_API_KEY',
      'VITE_APPS_SCRIPT_URL'
    ];

    const violations = [];

    for (const file of files) {
      // Skip the test file itself
      if (file.includes('apiClient.test.js') || file.includes('bundleLeaks.test.js')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          violations.push(`${path.relative(srcDir, file)} contains forbidden pattern: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
