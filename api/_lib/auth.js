import { getAdminAuth, getAdminDb } from './firebaseAdmin.js';

/**
 * Verify Firebase ID Token and resolve authoritative role from Firestore.
 *
 * @param {import('http').IncomingMessage} req
 * @param {Object} [options]
 * @param {string[]} [options.requiredRoles] - Allowlist of acceptable roles
 * @param {Object} [deps] - Dependency injection for testing (auth, db)
 * @returns {Promise<{ user?: Object, error?: { status: number, message: string } }>}
 */
export async function authenticateRequest(req, options = {}, deps = {}) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return {
      error: {
        status: 401,
        message: 'Missing or malformed Authorization header. Expected Bearer <token>'
      }
    };
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return {
      error: {
        status: 401,
        message: 'Authentication token missing from Bearer header'
      }
    };
  }

  const adminAuth = deps.auth || getAdminAuth();
  const adminDb = deps.db || getAdminDb();

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    const isExpired = err?.code === 'auth/id-token-expired';
    return {
      error: {
        status: 401,
        message: isExpired ? 'Authentication token has expired' : 'Invalid authentication token'
      }
    };
  }

  // Authoritatively fetch user profile and role from Firestore server-side
  let userSnap;
  try {
    userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
  } catch (err) {
    console.error('Error fetching user profile in auth helper:', err);
    return {
      error: {
        status: 500,
        message: 'Failed to retrieve authorization profile from directory'
      }
    };
  }

  if (!userSnap || !userSnap.exists) {
    return {
      error: {
        status: 403,
        message: 'User profile not found in authorization directory'
      }
    };
  }

  const userData = userSnap.data() || {};

  // Check active status
  if (userData.active === false) {
    return {
      error: {
        status: 403,
        message: 'User account has been deactivated'
      }
    };
  }

  const userRole = userData.role;
  if (!userRole) {
    return {
      error: {
        status: 403,
        message: 'User account has no assigned role'
      }
    };
  }

  // Enforce role requirements if specified
  if (options.requiredRoles && Array.isArray(options.requiredRoles) && options.requiredRoles.length > 0) {
    if (!options.requiredRoles.includes(userRole)) {
      return {
        error: {
          status: 403,
          message: `Insufficient role permissions. Required: ${options.requiredRoles.join(', ')}`
        }
      };
    }
  }

  return {
    user: {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userRole,
      name: userData.name || '',
      active: true,
      data: userData
    },
    token: decodedToken
  };
}
