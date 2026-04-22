const redis = require('../utils/redis');
const { logger } = require('../middleware');

/**
 * Enhanced Cache Service with intelligent TTL and invalidation strategies
 */
class EnhancedCacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes
    this.keyPrefix = 'stellar-did:';
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      invalidations: 0
    };
    
    // TTL strategies for different data types
    this.ttlStrategies = {
      // DID documents - longer TTL as they change infrequently
      'did': {
        default: 3600, // 1 hour
        active: 1800,  // 30 minutes for active DIDs
        inactive: 7200 // 2 hours for inactive DIDs
      },
      
      // Credentials - medium TTL with expiration awareness
      'credential': {
        default: 900,  // 15 minutes
        active: 600,   // 10 minutes for active credentials
        expired: 300,  // 5 minutes for expired credentials
        revoked: 60    // 1 minute for revoked credentials
      },
      
      // Verification methods - shorter TTL as they can change
      'verification': {
        default: 600, // 10 minutes
        active: 300,  // 5 minutes
        inactive: 900  // 15 minutes
      },
      
      // Services - medium TTL
      'service': {
        default: 1200, // 20 minutes
        active: 600,   // 10 minutes
        inactive: 1800  // 30 minutes
      },
      
      // Search results - short TTL to ensure freshness
      'search': {
        default: 300,  // 5 minutes
        popular: 600,  // 10 minutes for popular searches
        recent: 180   // 3 minutes for recent searches
      },
      
      // User sessions - short TTL for security
      'session': {
        default: 900,  // 15 minutes
        active: 600,   // 10 minutes for active sessions
        admin: 300    // 5 minutes for admin sessions
      },
      
      // Rate limiting - very short TTL
      'rate_limit': {
        default: 60,   // 1 minute
        strict: 30,   // 30 seconds for strict limits
        relaxed: 120  // 2 minutes for relaxed limits
      },
      
      // API responses - medium TTL
      'api': {
        default: 300,  // 5 minutes
        public: 600,   // 10 minutes for public data
        private: 180   // 3 minutes for private data
      }
    };
    
    // Cache invalidation patterns
    this.invalidationPatterns = {
      'did': [
        'did:*',           // All DID-related keys
        'verification:*',    // All verification methods
        'service:*'         // All services
      ],
      'credential': [
        'credential:*',      // All credentials
        'verification:*'     // Credential verifications
      ],
      'user': [
        'session:*',         // User sessions
        'profile:*',         // User profiles
        'preferences:*'      // User preferences
      ]
    };
  }

  /**
   * Generate cache key with namespace
   */
  generateKey(namespace, identifier) {
    return `${this.keyPrefix}${namespace}:${identifier}`;
  }

  /**
   * Get TTL based on data type and status
   */
  getTTLForType(dataType, status = 'default') {
    const strategy = this.ttlStrategies[dataType];
    return strategy ? strategy[status] || strategy.default : this.defaultTTL;
  }

  /**
   * Intelligent cache wrapper with TTL strategy
   */
  async wrap(namespace, identifier, fetchFunction, options = {}) {
    try {
      const { ttl, dataType, status, forceRefresh = false } = options;
      
      // Calculate optimal TTL
      const optimalTTL = ttl || this.getTTLForType(dataType || namespace, status);
      
      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await this.get(namespace, identifier);
        if (cached !== null) {
          // Check if cached data is still valid based on business rules
          if (await this.isDataValid(cached, dataType)) {
            this.stats.hits++;
            logger.debug(`Cache hit with valid data: ${namespace}:${identifier}`);
            return cached;
          } else {
            logger.debug(`Cache hit but data invalid, refreshing: ${namespace}:${identifier}`);
            await this.delete(namespace, identifier);
          }
        }
      }

      // Fetch fresh data
      const data = await fetchFunction();
      
      // Cache the result with intelligent TTL
      if (data !== null && data !== undefined) {
        await this.set(namespace, identifier, data, optimalTTL);
        
        // Add metadata for cache management
        await this.setCacheMetadata(namespace, identifier, {
          cachedAt: new Date().toISOString(),
          ttl: optimalTTL,
          dataType,
          status: status || this.inferDataStatus(data)
        });
      }

      return data;
    } catch (error) {
      this.stats.errors++;
      logger.error('Enhanced cache wrapper error:', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      const value = await redis.get(key);
      
      if (value) {
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
   * Check if cached data is still valid
   */
  async isDataValid(cachedData, dataType) {
    try {
      switch (dataType) {
        case 'credential':
          // Check if credential is expired or revoked
          if (cachedData.expires && new Date(cachedData.expires) < new Date()) {
            return false;
          }
          if (cachedData.revoked) {
            return false;
          }
          break;
          
        case 'did':
          // Check if DID is active
          if (cachedData.active === false) {
            // Inactive DIDs can be cached longer
            return true;
          }
          break;
          
        case 'session':
          // Check session validity
          if (cachedData.expiresAt && new Date(cachedData.expiresAt) < new Date()) {
            return false;
          }
          break;
          
        default:
          // Default: assume valid
          return true;
      }
      
      return true;
    } catch (error) {
      logger.error('Error validating cached data:', error);
      return false;
    }
  }

  /**
   * Infer data status from data properties
   */
  inferDataStatus(data) {
    if (!data) return 'default';
    
    // Credential status
    if (data.revoked) return 'revoked';
    if (data.expires && new Date(data.expires) < new Date()) return 'expired';
    if (data.issued || data.created) return 'active';
    
    // DID status
    if (data.active === false) return 'inactive';
    if (data.active === true) return 'active';
    
    // Session status
    if (data.isAdmin) return 'admin';
    if (data.lastActivity && Date.now() - new Date(data.lastActivity).getTime() < 300000) return 'active';
    
    return 'default';
  }

  /**
   * Set cache metadata
   */
  async setCacheMetadata(namespace, identifier, metadata) {
    try {
      const metaKey = this.generateKey(`${namespace}:meta`, identifier);
      await redis.setex(metaKey, 3600, JSON.stringify(metadata)); // Metadata cached for 1 hour
    } catch (error) {
      logger.error('Error setting cache metadata:', error);
    }
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(namespace, identifier) {
    try {
      const metaKey = this.generateKey(`${namespace}:meta`, identifier);
      const metadata = await redis.get(metaKey);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      logger.error('Error getting cache metadata:', error);
      return null;
    }
  }

  /**
   * Smart cache invalidation based on patterns
   */
  async invalidateByPattern(pattern) {
    try {
      const fullPattern = `${this.keyPrefix}${pattern}`;
      const keys = await redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        this.stats.invalidations += keys.length;
        logger.debug(`Cache invalidation: ${keys.length} keys deleted for pattern: ${pattern}`);
      }
      
      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache for specific entity type
   */
  async invalidateEntityType(entityType, identifier = null) {
    try {
      const patterns = this.invalidationPatterns[entityType];
      if (!patterns) {
        logger.warn(`No invalidation patterns found for entity type: ${entityType}`);
        return 0;
      }

      let totalDeleted = 0;
      
      for (const pattern of patterns) {
        if (identifier) {
          // Specific invalidation
          const fullPattern = pattern.replace('*', identifier);
          const deleted = await this.invalidateByPattern(fullPattern);
          totalDeleted += deleted;
        } else {
          // General invalidation
          const deleted = await this.invalidateByPattern(pattern);
          totalDeleted += deleted;
        }
      }
      
      return totalDeleted;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache entity invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate related cache entries intelligently
   */
  async invalidateRelated(identifiers) {
    try {
      const pipeline = redis.pipeline();
      const keysToDelete = new Set();
      
      for (const { namespace, id, relationType = 'direct' } of identifiers) {
        const baseKey = this.generateKey(namespace, id);
        keysToDelete.add(baseKey);
        
        // Add related keys based on relation type
        switch (relationType) {
          case 'did':
            // Invalidate all DID-related data
            keysToDelete.add(this.generateKey('verification', id));
            keysToDelete.add(this.generateKey('service', id));
            // Invalidate credentials issued by this DID
            keysToDelete.add(this.generateKey('credential:issuer', id));
            keysToDelete.add(this.generateKey('credential:subject', id));
            break;
            
          case 'credential':
            // Invalidate credential and related data
            keysToDelete.add(this.generateKey('verification', id));
            // Invalidate searches that might include this credential
            keysToDelete.add(this.generateKey('search:credential', id));
            break;
            
          case 'user':
            // Invalidate user-related data
            keysToDelete.add(this.generateKey('session', id));
            keysToDelete.add(this.generateKey('profile', id));
            keysToDelete.add(this.generateKey('preferences', id));
            // Invalidate user's DIDs
            keysToDelete.add(this.generateKey('did:owner', id));
            break;
        }
        
        // Add metadata key
        keysToDelete.add(this.generateKey(`${namespace}:meta`, id));
      }
      
      // Delete all keys in pipeline
      for (const key of keysToDelete) {
        pipeline.del(key);
      }
      
      const results = await pipeline.exec();
      const deletedCount = results.filter(([err, result]) => !err && result > 0).length;
      
      this.stats.invalidations += deletedCount;
      logger.debug(`Smart cache invalidation: ${deletedCount} entries deleted`);
      
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache smart invalidation error:', error);
      return 0;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache(dataLoaders = []) {
    try {
      logger.info('Starting cache warmup...');
      
      for (const loader of dataLoaders) {
        const { namespace, identifier, fetchFunction, ttl, dataType, status } = loader;
        
        try {
          // Check if already cached
          const exists = await this.exists(namespace, identifier);
          if (!exists) {
            const data = await fetchFunction();
            if (data !== null && data !== undefined) {
              const optimalTTL = ttl || this.getTTLForType(dataType || namespace, status);
              await this.set(namespace, identifier, data, optimalTTL);
              
              await this.setCacheMetadata(namespace, identifier, {
                cachedAt: new Date().toISOString(),
                ttl: optimalTTL,
                dataType,
                status: status || 'default',
                warmedUp: true
              });
              
              logger.debug(`Cache warmed up: ${namespace}:${identifier}`);
            }
          }
        } catch (error) {
          logger.error(`Error warming up cache for ${namespace}:${identifier}:`, error);
        }
      }
      
      logger.info('Cache warmup completed');
    } catch (error) {
      logger.error('Cache warmup error:', error);
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
   * Get cache performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const info = await redis.info('memory');
      const memoryInfo = this.parseRedisMemoryInfo(info);
      
      return {
        stats: this.getStats(),
        memory: memoryInfo,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting cache performance metrics:', error);
      return {
        stats: this.getStats(),
        memory: {},
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse Redis memory info
   */
  parseRedisMemoryInfo(info) {
    const lines = info.split('\r\n');
    const memoryInfo = {};
    
    for (const line of lines) {
      if (line.includes('used_memory:')) {
        memoryInfo.usedMemory = parseInt(line.split(':')[1]);
      }
      if (line.includes('used_memory_human:')) {
        memoryInfo.usedMemoryHuman = line.split(':')[1].trim();
      }
      if (line.includes('used_memory_peak:')) {
        memoryInfo.peakMemory = parseInt(line.split(':')[1]);
      }
      if (line.includes('used_memory_peak_human:')) {
        memoryInfo.peakMemoryHuman = line.split(':')[1].trim();
      }
      if (line.includes('keyspace_hits:')) {
        memoryInfo.keyspaceHits = parseInt(line.split(':')[1]);
      }
      if (line.includes('keyspace_misses:')) {
        memoryInfo.keyspaceMisses = parseInt(line.split(':')[1]);
      }
    }
    
    return memoryInfo;
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
      errors: 0,
      invalidations: 0
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
const enhancedCacheService = new EnhancedCacheService();

module.exports = enhancedCacheService;
