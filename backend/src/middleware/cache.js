const cacheManager = require('../utils/cache');
const { logger } = require('./');

/**
 * Response caching middleware
 */
const cacheResponse = (options = {}) => {
  const {
    namespace = 'api',
    ttl = 300,
    keyGenerator = (req) => req.originalUrl,
    condition = () => true,
    skipCache = false
  } = options;

  return async (req, res, next) => {
    // Skip caching for specific conditions
    if (skipCache || !condition(req)) {
      return next();
    }

    // Don't cache error responses
    const originalSend = res.send;
    let responseData = null;

    res.send = function(data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    // Generate cache key
    const cacheKey = keyGenerator(req);

    try {
      // Try to get from cache
      const cached = await cacheManager.get(namespace, cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for: ${cacheKey}`);
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-TTL', await cacheManager.ttl(namespace, cacheKey));
        
        return res.json(cached);
      }

      // Continue to next middleware
      res.on('finish', async () => {
        // Only cache successful responses
        if (res.statusCode === 200 && responseData) {
          await cacheManager.set(namespace, cacheKey, responseData, ttl);
          logger.debug(`Cache set for: ${cacheKey}`);
        }
      });

      res.set('X-Cache', 'MISS');
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Query result caching for database operations
 */
const cacheQuery = (namespace, ttl = 300) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const cacheKey = JSON.stringify(args);
      
      return await cacheManager.wrap(namespace, cacheKey, () => {
        return originalMethod.apply(this, args);
      }, ttl);
    };

    return descriptor;
  };
};

/**
 * Cache invalidation middleware
 */
const invalidateCache = (options = {}) => {
  const {
    namespaces = [],
    keyGenerator = (req) => req.params.id,
    condition = () => true
  } = options;

  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json;

    res.json = function(data) {
      // Invalidate cache on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300 && condition(req)) {
        const identifiers = namespaces.map(namespace => ({
          namespace,
          id: keyGenerator(req)
        }));

        cacheManager.invalidateRelated(identifiers).catch(error => {
          logger.error('Cache invalidation error:', error);
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Smart caching with ETags
 */
const etagCache = (options = {}) => {
  const {
    namespace = 'etag',
    ttl = 300,
    generateETag = (data) => require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex')
  } = options;

  return async (req, res, next) => {
    const cacheKey = req.originalUrl;

    try {
      // Check for If-None-Match header
      const ifNoneMatch = req.headers['if-none-match'];
      
      if (ifNoneMatch) {
        const cached = await cacheManager.get(namespace, cacheKey);
        
        if (cached) {
          const cachedETag = generateETag(cached);
          
          if (ifNoneMatch === cachedETag) {
            res.status(304).end();
            return;
          }
        }
      }

      // Continue processing
      const originalJson = res.json;

      res.json = function(data) {
        if (res.statusCode === 200) {
          const etag = generateETag(data);
          
          // Set ETag header
          res.set('ETag', etag);
          
          // Cache with ETag
          const cacheData = { data, etag };
          cacheManager.set(namespace, cacheKey, cacheData, ttl);
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('ETag cache error:', error);
      next();
    }
  };
};

/**
 * Rate limiting with cache
 */
const rateLimitCache = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 100,
    namespace = 'rate-limit'
  } = options;

  return async (req, res, next) => {
    const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const cacheKey = `${clientId}:${Math.floor(Date.now() / windowMs)}`;

    try {
      const currentCount = await cacheManager.increment(namespace, cacheKey, 1);
      
      if (currentCount === 1) {
        // Set expiration for the first request in window
        await cacheManager.expire(namespace, cacheKey, Math.ceil(windowMs / 1000));
      }

      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTime = Math.ceil((Math.floor(Date.now() / windowMs) + 1) * windowMs / 1000);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': resetTime
      });

      if (currentCount > maxRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: resetTime
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit cache error:', error);
      next();
    }
  };
};

/**
 * Cache warming middleware
 */
const warmCache = (warmerFunctions = []) => {
  return async (req, res, next) => {
    // Only run on first request after server start
    if (global.cacheWarmed) {
      return next();
    }

    try {
      logger.info('Starting cache warming...');
      
      const warmPromises = warmerFunctions.map(async ({ namespace, key, fetchFunction, ttl }) => {
        try {
          await cacheManager.wrap(namespace, key, fetchFunction, ttl);
          logger.debug(`Cache warmed: ${namespace}:${key}`);
        } catch (error) {
          logger.error(`Cache warming failed for ${namespace}:${key}:`, error);
        }
      });

      await Promise.all(warmPromises);
      
      global.cacheWarmed = true;
      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming error:', error);
    }

    next();
  };
};

/**
 * Cache statistics middleware
 */
const cacheStats = () => {
  return (req, res, next) => {
    if (req.path === '/cache-stats') {
      return res.json({
        stats: cacheManager.getStats(),
        timestamp: new Date().toISOString()
      });
    }

    if (req.path === '/cache-health') {
      return cacheManager.healthCheck()
        .then(health => res.json(health))
        .catch(error => {
          logger.error('Cache health check error:', error);
          res.status(500).json({ error: 'Cache health check failed' });
        });
    }

    next();
  };
};

/**
 * Adaptive caching based on request patterns
 */
const adaptiveCache = (options = {}) => {
  const {
    namespace = 'adaptive',
    baseTTL = 300,
    maxTTL = 3600,
    minTTL = 60,
    hitRateThreshold = 0.8
  } = options;

  const requestPatterns = new Map();

  return async (req, res, next) => {
    const pattern = req.route?.path || req.path;
    
    // Initialize pattern tracking
    if (!requestPatterns.has(pattern)) {
      requestPatterns.set(pattern, {
        requests: 0,
        hits: 0,
        ttl: baseTTL
      });
    }

    const patternStats = requestPatterns.get(pattern);
    patternStats.requests++;

    // Check cache first
    const cacheKey = req.originalUrl;
    const cached = await cacheManager.get(namespace, cacheKey);

    if (cached) {
      patternStats.hits++;
      
      // Adjust TTL based on hit rate
      const hitRate = patternStats.hits / patternStats.requests;
      
      if (hitRate > hitRateThreshold && patternStats.ttl < maxTTL) {
        patternStats.ttl = Math.min(patternStats.ttl * 1.2, maxTTL);
      } else if (hitRate < hitRateThreshold / 2 && patternStats.ttl > minTTL) {
        patternStats.ttl = Math.max(patternStats.ttl * 0.8, minTTL);
      }

      res.set('X-Cache', 'HIT');
      res.set('X-Adaptive-TTL', patternStats.ttl);
      return res.json(cached);
    }

    // Cache the response
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 200) {
        cacheManager.set(namespace, cacheKey, data, patternStats.ttl);
      }
      return originalJson.call(this, data);
    };

    res.set('X-Cache', 'MISS');
    res.set('X-Adaptive-TTL', patternStats.ttl);
    next();
  };
};

/**
 * Cache invalidation strategies
 */
const cacheInvalidation = {
  /**
   * Invalidate by pattern
   */
  byPattern: async (namespace, pattern) => {
    try {
      const keys = await cacheManager.redis.keys(`${cacheManager.keyPrefix}${namespace}:${pattern}`);
      if (keys.length > 0) {
        await cacheManager.redis.del(...keys);
        logger.info(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
      return keys.length;
    } catch (error) {
      logger.error('Pattern-based cache invalidation error:', error);
      return 0;
    }
  },

  /**
   * Invalidate by tags
   */
  byTags: async (tags) => {
    try {
      // This would require a tag-based cache implementation
      // For now, we'll use namespace-based invalidation
      const namespaces = Array.isArray(tags) ? tags : [tags];
      let totalInvalidated = 0;

      for (const namespace of namespaces) {
        const count = await cacheManager.clearNamespace(namespace);
        totalInvalidated += count;
      }

      logger.info(`Invalidated ${totalInvalidated} cache entries by tags: ${tags.join(', ')}`);
      return totalInvalidated;
    } catch (error) {
      logger.error('Tag-based cache invalidation error:', error);
      return 0;
    }
  },

  /**
   * Invalidate by time
   */
  byTime: async (namespace, olderThan) => {
    try {
      // This would require timestamp-based cache keys
      // For now, we'll clear the entire namespace
      const count = await cacheManager.clearNamespace(namespace);
      logger.info(`Invalidated ${count} cache entries older than: ${olderThan}`);
      return count;
    } catch (error) {
      logger.error('Time-based cache invalidation error:', error);
      return 0;
    }
  }
};

module.exports = {
  cacheResponse,
  cacheQuery,
  invalidateCache,
  etagCache,
  rateLimitCache,
  warmCache,
  cacheStats,
  adaptiveCache,
  cacheInvalidation,
  cacheManager
};
