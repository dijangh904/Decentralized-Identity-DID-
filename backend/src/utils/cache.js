const redis = require('./redis');
const { logger } = require('../middleware');

class CacheManager {
  constructor() {
    this.defaultTTL = 300; // 5 minutes
    this.keyPrefix = 'stellar-did:';
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Generate cache key with namespace
   */
  generateKey(namespace, identifier) {
    return `${this.keyPrefix}${namespace}:${identifier}`;
  }

  /**
   * Get value from cache
   */
  async get(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      const value = await redis.get(key);
      
      if (value) {
        this.stats.hits++;
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        logger.debug(`Cache miss: ${key}`);
        return null;
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(namespace, identifier, value, ttl = this.defaultTTL) {
    try {
      const key = this.generateKey(namespace, identifier);
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await redis.setex(key, ttl, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
      
      this.stats.sets++;
      logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      const result = await redis.del(key);
      
      if (result > 0) {
        this.stats.deletes++;
        logger.debug(`Cache delete: ${key}`);
      }
      
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear cache namespace
   */
  async clearNamespace(namespace) {
    try {
      const pattern = `${this.keyPrefix}${namespace}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug(`Cache cleared namespace: ${namespace} (${keys.length} keys)`);
      }
      
      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear namespace error:', error);
      return 0;
    }
  }

  /**
   * Get multiple values
   */
  async mget(namespace, identifiers) {
    try {
      const keys = identifiers.map(id => this.generateKey(namespace, id));
      const values = await redis.mget(...keys);
      
      return values.map(value => {
        if (value) {
          this.stats.hits++;
          return JSON.parse(value);
        } else {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mget error:', error);
      return new Array(identifiers.length).fill(null);
    }
  }

  /**
   * Set multiple values
   */
  async mset(namespace, items, ttl = this.defaultTTL) {
    try {
      const pipeline = redis.pipeline();
      
      items.forEach(({ identifier, value }) => {
        const key = this.generateKey(namespace, identifier);
        const serializedValue = JSON.stringify(value);
        
        if (ttl > 0) {
          pipeline.setex(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      });
      
      await pipeline.exec();
      this.stats.sets += items.length;
      
      logger.debug(`Cache mset: ${namespace} (${items.length} items)`);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Atomic increment
   */
  async increment(namespace, identifier, amount = 1) {
    try {
      const key = this.generateKey(namespace, identifier);
      const result = await redis.incrby(key, amount);
      
      logger.debug(`Cache increment: ${key} by ${amount}`);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache increment error:', error);
      return null;
    }
  }

  /**
   * Check if key exists
   */
  async exists(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      const result = await redis.exists(key);
      
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(namespace, identifier, ttl) {
    try {
      const key = this.generateKey(namespace, identifier);
      const result = await redis.expire(key, ttl);
      
      if (result) {
        logger.debug(`Cache expire: ${key} (TTL: ${ttl}s)`);
      }
      
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get TTL of key
   */
  async ttl(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      return await redis.ttl(key);
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Cache wrapper with automatic fallback
   */
  async wrap(namespace, identifier, fetchFunction, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      const cached = await this.get(namespace, identifier);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      const data = await fetchFunction();
      
      // Cache the result
      if (data !== null && data !== undefined) {
        await this.set(namespace, identifier, data, ttl);
      }

      return data;
    } catch (error) {
      logger.error('Cache wrapper error:', error);
      throw error;
    }
  }

  /**
   * Invalidate related cache entries
   */
  async invalidateRelated(identifiers) {
    try {
      const pipeline = redis.pipeline();
      
      identifiers.forEach(({ namespace, id }) => {
        const key = this.generateKey(namespace, id);
        pipeline.del(key);
      });
      
      const results = await pipeline.exec();
      const deletedCount = results.filter(([err, result]) => !err && result > 0).length;
      
      logger.debug(`Cache invalidation: ${deletedCount} entries deleted`);
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const testKey = this.generateKey('health', 'test');
      await redis.set(testKey, 'ok', 'EX', 10);
      const value = await redis.get(testKey);
      await redis.del(testKey);
      
      return {
        status: value === 'ok' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      };
    } catch (error) {
      logger.error('Cache health check error:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      };
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;
