/**
 * Cache – localStorage cache with TTL for frequently accessed data.
 * 
 * Cached items:
 *   - Settings: 1 hour TTL
 *   - Farmers/Products/Customers: 5 minute TTL
 *   - Dashboard summary: 2 minute TTL
 * 
 * Safe invalidation: any write operation clears the relevant cache.
 */

const CACHE_PREFIX = 'GAUDAI_CACHE_';

const TTL = {
  settings: 60 * 60 * 1000,       // 1 hour
  farmers: 5 * 60 * 1000,         // 5 minutes
  products: 5 * 60 * 1000,        // 5 minutes
  customers: 5 * 60 * 1000,       // 5 minutes
  collections: 2 * 60 * 1000,     // 2 minutes
  sales: 2 * 60 * 1000,           // 2 minutes
  expenses: 2 * 60 * 1000,        // 2 minutes
  summary: 2 * 60 * 1000,         // 2 minutes
};

/**
 * Get a cached value. Returns null if expired or missing.
 * @param {string} key - Cache key (e.g., 'farmers', 'settings')
 * @returns {any|null}
 */
export function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    
    const { data, timestamp } = JSON.parse(raw);
    const ttl = TTL[key] || 5 * 60 * 1000;
    
    if (Date.now() - timestamp > ttl) {
      // Expired
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with automatic TTL.
 * @param {string} key - Cache key
 * @param {any} data - Data to cache (must be JSON-serializable)
 */
export function setCached(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // localStorage full or quota exceeded — silently fail
    console.warn('Cache write failed for', key, e);
  }
}

/**
 * Invalidate (clear) a specific cache entry.
 * Call this after any write operation that modifies the cached data.
 * @param {string} key - Cache key to invalidate
 */
export function invalidateCache(key) {
  localStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * Invalidate multiple cache entries at once.
 * @param {string[]} keys - Array of cache keys to invalidate
 */
export function invalidateCaches(keys) {
  keys.forEach(key => localStorage.removeItem(CACHE_PREFIX + key));
}

/**
 * Clear all cached data.
 */
export function clearAllCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
