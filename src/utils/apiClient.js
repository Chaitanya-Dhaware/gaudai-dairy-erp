/**
 * Unified Client API Gateway
 *
 * Directs all client requests through secure serverless backend routes (/api/*).
 * Obtains fresh Firebase ID tokens, handles 401 refresh & auto-signout,
 * formats 403 authorization rejections bilingually, and shields client from 5xx server details.
 */
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

const BILINGUAL_ERRORS = {
  UNAUTHORIZED: 'तुमचे सत्र संपले आहे. कृपया पुन्हा लॉगिन करा / Session expired. Please log in again.',
  FORBIDDEN: 'तुम्हाला ही कृती करण्याची परवानगी नाही / You do not have permission to perform this action.',
  SERVER_ERROR: 'सर्व्हर त्रुटी आली. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा / A server error occurred. Please try again later.',
  NETWORK_ERROR: 'नेटवर्क त्रुटी आली. कृपया इंटरनेट कनेक्शन तपासा / Network error. Please check your internet connection.',
  NO_USER: 'कृपया आधी लॉगिन करा / Please sign in to proceed.'
};

/**
 * Low-level authenticated fetch wrapper with automatic token refresh on 401.
 *
 * @param {string} endpoint - Route path, e.g. '/api/gas-proxy'
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @param {object} deps - Dependency overrides for testing (auth, fetch, onSignOut)
 */
export async function apiRequest(endpoint, options = {}, deps = {}) {
  const authInstance = deps.auth || auth;
  const fetchImpl = deps.fetch || globalThis.fetch;
  const onSignOut = deps.onSignOut || (async () => {
    try {
      await signOut(authInstance);
    } catch {
      // Ignored
    }
  });

  const currentUser = authInstance?.currentUser;
  if (!currentUser) {
    return {
      success: false,
      error: BILINGUAL_ERRORS.NO_USER,
      code: 401
    };
  }

  // Helper to execute request with a given token
  const executeWithToken = async (token) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    };

    return await fetchImpl(endpoint, {
      ...options,
      headers
    });
  };

  try {
    // 1. Initial attempt with current token
    let token = await currentUser.getIdToken(false);
    let response = await executeWithToken(token);

    // 2. Handle 401 with one-time force refresh
    if (response.status === 401) {
      try {
        const refreshedToken = await currentUser.getIdToken(true);
        response = await executeWithToken(refreshedToken);
      } catch {
        // Token refresh failed; proceed to sign out
        await onSignOut();
        return {
          success: false,
          error: BILINGUAL_ERRORS.UNAUTHORIZED,
          code: 401
        };
      }

      // If still 401 after refreshing token, session is invalidated
      if (response.status === 401) {
        await onSignOut();
        return {
          success: false,
          error: BILINGUAL_ERRORS.UNAUTHORIZED,
          code: 401
        };
      }
    }

    // 3. Handle 403 Forbidden with clear bilingual message
    if (response.status === 403) {
      return {
        success: false,
        error: BILINGUAL_ERRORS.FORBIDDEN,
        code: 403
      };
    }

    // 4. Handle 5xx Server Errors: shield raw 500/502/504 crashes, but allow safe 503 diagnostics
    if (response.status >= 500 && response.status !== 503) {
      return {
        success: false,
        error: BILINGUAL_ERRORS.SERVER_ERROR,
        code: response.status
      };
    }

    // 5. Parse response body
    let jsonResult;
    try {
      jsonResult = await response.json();
    } catch {
      jsonResult = { success: response.ok, error: response.statusText };
    }

    if (response.status === 503) {
      return {
        success: false,
        error: jsonResult.error || BILINGUAL_ERRORS.SERVER_ERROR,
        code: 503
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: jsonResult.error || `HTTP error ${response.status}`,
        code: response.status
      };
    }

    return jsonResult;
  } catch (netErr) {
    console.error('apiRequest network error:', netErr.message);
    return {
      success: false,
      error: BILINGUAL_ERRORS.NETWORK_ERROR,
      isNetworkError: true,
      code: 0
    };
  }
}

/**
 * Proxy call to Google Apps Script via /api/gas-proxy
 */
export async function callGasProxy(action, data = {}, deps = {}) {
  return await apiRequest(
    '/api/gas-proxy',
    {
      method: 'POST',
      body: JSON.stringify({ action, data })
    },
    deps
  );
}

/**
 * Proxy call to Google Gemini AI via /api/gemini
 */
export async function callGemini(payload, deps = {}) {
  return await apiRequest(
    '/api/gemini',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    deps
  );
}

/**
 * Proxy call to User Management via /api/users
 */
export async function callUsersApi(action, data = {}, deps = {}) {
  return await apiRequest(
    '/api/users',
    {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    },
    deps
  );
}

export default {
  apiRequest,
  callGasProxy,
  callGemini,
  callUsersApi,
  BILINGUAL_ERRORS
};
