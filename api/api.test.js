/* global process */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authenticateRequest } from './_lib/auth.js';
import gasProxyHandler from './gas-proxy.js';
import geminiHandler, { resetRateLimits } from './gemini.js';
import usersHandler from './users.js';

// Helper to create mock res object
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

describe('Serverless API Proxy & Security Gateway', () => {
  let mockAuth;
  let mockDb;
  let usersCollection;
  let auditLogsCollection;

  beforeEach(() => {
    resetRateLimits();
    usersCollection = new Map();
    auditLogsCollection = new Map();

    mockDb = {
      collection: (colName) => {
        if (colName === 'users') {
          return {
            doc: (id) => ({
              get: vi.fn(async () => {
                const data = usersCollection.get(id);
                return {
                  exists: Boolean(data),
                  data: () => data
                };
              }),
              set: vi.fn(async (docData) => {
                usersCollection.set(id, docData);
              }),
              update: vi.fn(async (updates) => {
                const current = usersCollection.get(id) || {};
                usersCollection.set(id, { ...current, ...updates });
              })
            }),
            where: vi.fn((field, op, val) => ({
              where: vi.fn((f2, op2, val2) => ({
                get: vi.fn(async () => {
                  const matches = [];
                  for (const [docId, docData] of usersCollection.entries()) {
                    if (docData[field] === val && docData[f2] === val2) {
                      matches.push({ id: docId, data: () => docData });
                    }
                  }
                  return { size: matches.length, docs: matches };
                })
              }))
            })),
            get: vi.fn(async () => {
              const docs = [];
              for (const [docId, docData] of usersCollection.entries()) {
                docs.push({ id: docId, data: () => docData });
              }
              return { size: docs.length, docs };
            })
          };
        }
        if (colName === 'audit_logs') {
          return {
            doc: (id) => ({
              set: vi.fn(async (logData) => {
                auditLogsCollection.set(id, logData);
              })
            })
          };
        }
        return {};
      }
    };

    mockAuth = {
      verifyIdToken: vi.fn(async (token) => {
        if (token === 'expired_token') {
          const err = new Error('Token expired');
          err.code = 'auth/id-token-expired';
          throw err;
        }
        if (token === 'bad_token') {
          throw new Error('Decoding error');
        }
        if (token.startsWith('user_token_')) {
          const uid = token.replace('user_token_', '');
          return { uid, email: `${uid}@gaudai.com` };
        }
        throw new Error('Unknown token');
      }),
      createUser: vi.fn(async ({ email, displayName }) => ({
        uid: 'new_uid_' + Math.random().toString(36).substring(2, 6),
        email,
        displayName
      })),
      generatePasswordResetLink: vi.fn(async (email) => `https://auth.gaudai.com/reset?email=${email}`)
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. SHARED AUTH HELPER (_lib/auth.js) ──────────────────────────
  describe('Shared Auth Helper (authenticateRequest)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = { headers: {} };
      const result = await authenticateRequest(req, {}, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(401);
      expect(result.error.message).toContain('Missing or malformed');
    });

    it('returns 401 when token is invalid or corrupted (bad token)', async () => {
      const req = { headers: { authorization: 'Bearer bad_token' } };
      const result = await authenticateRequest(req, {}, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(401);
      expect(result.error.message).toContain('Invalid authentication token');
    });

    it('returns 401 when token is expired', async () => {
      const req = { headers: { authorization: 'Bearer expired_token' } };
      const result = await authenticateRequest(req, {}, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(401);
      expect(result.error.message).toContain('expired');
    });

    it('returns 403 when user record does not exist in Firestore directory', async () => {
      const req = { headers: { authorization: 'Bearer user_token_ghost' } };
      const result = await authenticateRequest(req, {}, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(403);
      expect(result.error.message).toContain('not found in authorization directory');
    });

    it('returns 403 when user is marked inactive (active === false)', async () => {
      usersCollection.set('deactivated_user', {
        uid: 'deactivated_user',
        role: 'staff',
        active: false
      });

      const req = { headers: { authorization: 'Bearer user_token_deactivated_user' } };
      const result = await authenticateRequest(req, {}, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(403);
      expect(result.error.message).toContain('deactivated');
    });

    it('returns 403 when user role is insufficient for requiredRoles', async () => {
      usersCollection.set('normal_staff', {
        uid: 'normal_staff',
        role: 'staff',
        active: true
      });

      const req = { headers: { authorization: 'Bearer user_token_normal_staff' } };
      const result = await authenticateRequest(req, { requiredRoles: ['admin', 'superadmin'] }, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(403);
      expect(result.error.message).toContain('Insufficient role permissions');
    });

    it('returns 200 with verified user profile for valid credentials', async () => {
      usersCollection.set('valid_staff', {
        uid: 'valid_staff',
        name: 'Ramesh',
        role: 'staff',
        active: true
      });

      const req = { headers: { authorization: 'Bearer user_token_valid_staff' } };
      const result = await authenticateRequest(req, { requiredRoles: ['staff'] }, { auth: mockAuth, db: mockDb });
      expect(result.error).toBeUndefined();
      expect(result.user).toBeDefined();
      expect(result.user.uid).toBe('valid_staff');
      expect(result.user.role).toBe('staff');
    });
  });

  // ─── 2. APPS SCRIPT PROXY (gas-proxy.js) ───────────────────────────
  describe('Apps Script Proxy Endpoint (/api/gas-proxy)', () => {
    beforeEach(() => {
      process.env.APPS_SCRIPT_URL = 'https://mock-apps-script.local/exec';
      process.env.APPS_SCRIPT_SECRET = 'TEST_SERVER_SECRET_32CHARS';

      usersCollection.set('staff_1', { uid: 'staff_1', role: 'staff', active: true });
      usersCollection.set('admin_1', { uid: 'admin_1', role: 'admin', active: true });
      usersCollection.set('superadmin_1', { uid: 'superadmin_1', role: 'superadmin', active: true });
    });

    it('returns 401 when no token is provided', async () => {
      const req = { method: 'POST', headers: {}, body: { action: 'batchLoadData' } };
      const res = createMockRes();

      await gasProxyHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(401);
    });

    it('returns 413 when body size exceeds 512KB', async () => {
      const req = {
        method: 'POST',
        headers: {
          authorization: 'Bearer user_token_staff_1',
          'content-length': String(1024 * 600) // 600 KB
        },
        body: { action: 'batchLoadData' }
      };
      const res = createMockRes();

      await gasProxyHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(413);
    });

    it('returns 400 when an unknown action is sent', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_staff_1' },
        body: { action: 'hackDatabase' }
      };
      const res = createMockRes();

      await gasProxyHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Unknown action');
    });

    it('returns 400 when forbidden spreadsheet IDs are provided in body', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_admin_1' },
        body: {
          action: 'getSettings',
          sheetsIdMaster: 'attacker_sheet_id'
        }
      };
      const res = createMockRes();

      await gasProxyHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('forbidden');
    });

    it('blocks role with insufficient permissions from privileged actions (staff attempting clearTransactions)', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_staff_1' },
        body: { action: 'clearTransactions' }
      };
      const res = createMockRes();

      await gasProxyHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('not permitted');
    });

    it('forwards valid staff request to upstream Apps Script injecting secret and stripping whatsappToken', async () => {
      // Mock global fetch for upstream Apps Script
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            businessName: 'Gaudai AI Dairy',
            whatsappToken: 'LEAKED_META_TOKEN'
          }
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_staff_1' },
        body: { action: 'getSettings' }
      };
      const res = createMockRes();

      await gasProxyHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Ensure whatsappToken was stripped
      expect(res.body.data.whatsappToken).toBeUndefined();

      // Ensure secret was injected into upstream call
      expect(mockFetch).toHaveBeenCalled();
      const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentPayload.secret).toBe('TEST_SERVER_SECRET_32CHARS');
      expect(sentPayload.action).toBe('getSettings');
    });
  });

  // ─── 3. GEMINI AI PROXY (gemini.js) ───────────────────────────────
  describe('Gemini AI Endpoint (/api/gemini)', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'TEST_SERVER_GEMINI_KEY';
      process.env.GEMINI_MODEL = 'gemini-2.0-flash';
      usersCollection.set('staff_1', { uid: 'staff_1', role: 'staff', active: true });
    });

    it('returns 401 when no token is provided', async () => {
      const req = { method: 'POST', headers: {}, body: { contents: [{ parts: [{ text: 'hi' }] }] } };
      const res = createMockRes();

      await geminiHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(401);
    });

    it('forwards valid prompt to Gemini with server API key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }]
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_staff_1' },
        body: { contents: [{ parts: [{ text: 'Calculate fat rate' }] }] }
      };
      const res = createMockRes();

      await geminiHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('models/gemini-2.0-flash:generateContent');
      expect(calledUrl).toContain('key=TEST_SERVER_GEMINI_KEY');
    });

    it('enforces rate limit when user exceeds quota in window', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] })
      });
      vi.stubGlobal('fetch', mockFetch);

      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_staff_1' },
        body: { contents: [{ parts: [{ text: 'prompt' }] }] }
      };

      // Send 30 requests (allowed)
      for (let i = 0; i < 30; i++) {
        const res = createMockRes();
        await geminiHandler(req, res, { auth: mockAuth, db: mockDb });
        expect(res.statusCode).toBe(200);
      }

      // 31st request should be rate limited (429)
      const res429 = createMockRes();
      await geminiHandler(req, res429, { auth: mockAuth, db: mockDb });
      expect(res429.statusCode).toBe(429);
      expect(res429.body.error).toContain('Too many requests');
    });
  });

  // ─── 4. USER MANAGEMENT ENDPOINT (users.js) ───────────────────────
  describe('User Management Endpoint (/api/users)', () => {
    beforeEach(() => {
      usersCollection.set('sa_1', { uid: 'sa_1', role: 'superadmin', active: true });
      usersCollection.set('admin_1', { uid: 'admin_1', role: 'admin', active: true });
    });

    it('blocks non-superadmins from accessing user management', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_admin_1' },
        body: { action: 'list' }
      };
      const res = createMockRes();

      await usersHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(403);
    });

    it('allows superadmin to create a new user with password reset link and server audit log', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_sa_1' },
        body: {
          action: 'create',
          email: 'newoperator@gaudai.com',
          name: 'Sunil Gavaskar',
          role: 'staff'
        }
      };
      const res = createMockRes();

      await usersHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('staff');
      expect(res.body.resetLink).toBeDefined();

      // Check audit log was written
      expect(auditLogsCollection.size).toBe(1);
      const log = Array.from(auditLogsCollection.values())[0];
      expect(log.userId).toBe('sa_1');
      expect(log.actor).toBe('sa_1');
      expect(log.action).toBe('CREATE_USER');
    });

    it('blocks deactivating or demoting the last active superadmin', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer user_token_sa_1' },
        body: {
          action: 'update',
          uid: 'sa_1',
          updates: { role: 'staff' }
        }
      };
      const res = createMockRes();

      await usersHandler(req, res, { auth: mockAuth, db: mockDb });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Cannot demote or deactivate the last active Super Admin');
    });
  });
});
