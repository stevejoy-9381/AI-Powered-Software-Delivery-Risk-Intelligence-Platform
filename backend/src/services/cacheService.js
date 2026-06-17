/**
 * Cache Service
 * Simple in-memory cache (Map-based) with TTL (Time-To-Live) support.
 */
class CacheService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get item from cache.
   * @param {string} key
   * @returns {*} value or null if expired/not found
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set item in cache with TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlSeconds - default is 10 minutes (600 seconds)
   */
  set(key, value, ttlSeconds = 600) {
    const expiry = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Delete item from cache.
   * @param {string} key
   */
  del(key) {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache.
   */
  clear() {
    this.cache.clear();
  }
}

module.exports = new CacheService();
