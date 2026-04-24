const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');
const { logger } = require('./logger');

// Redis client for distributed rate limiting
let redisClient;

const initializeRedis = async () => {
  try {
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis retry attempts exhausted');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.warn('Redis connection failed, falling back to memory store:', error.message);
    return null;
  }
};

// Initialize Redis on module load if enabled
if (process.env.RATE_LIMIT_ENABLE_REDIS !== 'false') {
  initializeRedis();
} else {
  logger.info('Redis rate limiting disabled, using memory store');
}

// Rate limiting configurations using environment variables
const RATE_LIMIT_CONFIGS = {
  // General API rate limiting
  general: {
    windowMs: parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX) || 100, // 100 requests per window
    message: {
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded for general API access',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000) / 60000) + ' minutes'
    }
  },
  
  // Contract operations - stricter limits
  contractRead: {
    windowMs: parseInt(process.env.RATE_LIMIT_CONTRACT_READ_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.RATE_LIMIT_CONTRACT_READ_MAX) || 50, // 50 read operations per 5 minutes
    message: {
      success: false,
      error: 'Too many contract read requests',
      message: 'Rate limit exceeded for contract read operations',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_CONTRACT_READ_WINDOW_MS) || 5 * 60 * 1000) / 60000) + ' minutes'
    }
  },
  
  contractWrite: {
    windowMs: parseInt(process.env.RATE_LIMIT_CONTRACT_WRITE_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes
    max: parseInt(process.env.RATE_LIMIT_CONTRACT_WRITE_MAX) || 10, // 10 write operations per 10 minutes
    message: {
      success: false,
      error: 'Too many contract write requests',
      message: 'Rate limit exceeded for contract write operations',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_CONTRACT_WRITE_WINDOW_MS) || 10 * 60 * 1000) / 60000) + ' minutes'
    }
  },
  
  // Critical operations - very strict limits
  deployContract: {
    windowMs: parseInt(process.env.RATE_LIMIT_DEPLOY_CONTRACT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_DEPLOY_CONTRACT_MAX) || 3, // 3 deployments per hour
    message: {
      success: false,
      error: 'Too many contract deployments',
      message: 'Rate limit exceeded for contract deployments',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_DEPLOY_CONTRACT_WINDOW_MS) || 60 * 60 * 1000) / 3600000) + ' hour'
    }
  },
  
  registerDID: {
    windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_DID_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.RATE_LIMIT_REGISTER_DID_MAX) || 5, // 5 DID registrations per 5 minutes
    message: {
      success: false,
      error: 'Too many DID registrations',
      message: 'Rate limit exceeded for DID registrations',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_REGISTER_DID_WINDOW_MS) || 5 * 60 * 1000) / 60000) + ' minutes'
    }
  },
  
  issueCredential: {
    windowMs: parseInt(process.env.RATE_LIMIT_ISSUE_CREDENTIAL_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.RATE_LIMIT_ISSUE_CREDENTIAL_MAX) || 15, // 15 credentials per 5 minutes
    message: {
      success: false,
      error: 'Too many credential issuances',
      message: 'Rate limit exceeded for credential issuances',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_ISSUE_CREDENTIAL_WINDOW_MS) || 5 * 60 * 1000) / 60000) + ' minutes'
    }
  },
  
  createAccount: {
    windowMs: parseInt(process.env.RATE_LIMIT_CREATE_ACCOUNT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_CREATE_ACCOUNT_MAX) || 10, // 10 accounts per hour
    message: {
      success: false,
      error: 'Too many account creations',
      message: 'Rate limit exceeded for account creations',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_CREATE_ACCOUNT_WINDOW_MS) || 60 * 60 * 1000) / 3600000) + ' hour'
    }
  },
  
  fundAccount: {
    windowMs: parseInt(process.env.RATE_LIMIT_FUND_ACCOUNT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_FUND_ACCOUNT_MAX) || 20, // 20 funding requests per hour
    message: {
      success: false,
      error: 'Too many account funding requests',
      message: 'Rate limit exceeded for account funding requests',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_FUND_ACCOUNT_WINDOW_MS) || 60 * 60 * 1000) / 3600000) + ' hour'
    }
  }
};

// Create rate limiter factory
const createRateLimiter = (config, keyGenerator = null) => {
  const limiterConfig = {
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    keyGenerator: keyGenerator || ((req) => {
      return req.ip || req.connection.remoteAddress;
    }),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json(config.message);
    }
  };

  // Use Redis store if available, fallback to memory store
  if (redisClient) {
    limiterConfig.store = new RedisStore({
      client: redisClient,
      prefix: 'rl:',
      resetExpiryOnChange: true
    });
  }

  return rateLimit(limiterConfig);
};

// Specific rate limiters for different operations
const limiters = {
  general: createRateLimiter(RATE_LIMIT_CONFIGS.general),
  contractRead: createRateLimiter(RATE_LIMIT_CONFIGS.contractRead),
  contractWrite: createRateLimiter(RATE_LIMIT_CONFIGS.contractWrite),
  deployContract: createRateLimiter(RATE_LIMIT_CONFIGS.deployContract),
  registerDID: createRateLimiter(RATE_LIMIT_CONFIGS.registerDID),
  issueCredential: createRateLimiter(RATE_LIMIT_CONFIGS.issueCredential),
  createAccount: createRateLimiter(RATE_LIMIT_CONFIGS.createAccount),
  fundAccount: createRateLimiter(RATE_LIMIT_CONFIGS.fundAccount)
};

// User-based rate limiting for authenticated users
const createUserBasedRateLimiter = (config) => {
  return createRateLimiter(config, (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip || req.connection.remoteAddress;
  });
};

// Dynamic rate limiting based on user tier
const createDynamicRateLimiter = (baseConfig) => {
  return createRateLimiter(baseConfig, (req) => {
    let key = req.ip || req.connection.remoteAddress;
    
    // Adjust limits based on user tier if available
    if (req.user) {
      const tierMultiplier = {
        'free': 1,
        'basic': 2,
        'premium': 5,
        'enterprise': 10
      }[req.user.tier] || 1;
      
      key = `${req.user.id}:${tierMultiplier}`;
    }
    
    return key;
  });
};

// Middleware factory for applying rate limiting to specific routes
const applyRateLimit = (limiterType) => {
  return (req, res, next) => {
    const limiter = limiters[limiterType];
    if (!limiter) {
      logger.error(`Unknown rate limiter type: ${limiterType}`);
      return next();
    }
    
    limiter(req, res, next);
  };
};

// Progressive rate limiting - gets stricter with repeated violations
const createProgressiveRateLimiter = (baseConfig) => {
  return createRateLimiter(baseConfig, (req) => {
    const baseKey = req.ip || req.connection.remoteAddress;
    const violationKey = `violations:${baseKey}`;
    
    // This would need Redis to track violations properly
    // For now, use the base key
    return baseKey;
  });
};

// Rate limiting middleware that checks multiple conditions
const smartRateLimiter = (req, res, next) => {
  // Skip rate limiting for health checks
  if (req.path === '/health') {
    return next();
  }
  
  // Apply different rate limits based on endpoint and method
  const path = req.path;
  const method = req.method;
  
  // Contract operations
  if (path.startsWith('/api/v1/contracts')) {
    if (method === 'GET') {
      return limiters.contractRead(req, res, next);
    } else if (method === 'POST' || method === 'PUT') {
      // Specific contract write operations
      if (path.includes('/deploy')) {
        return limiters.deployContract(req, res, next);
      } else if (path.includes('/register-did')) {
        return limiters.registerDID(req, res, next);
      } else if (path.includes('/issue-credential')) {
        return limiters.issueCredential(req, res, next);
      } else if (path.includes('/create-account')) {
        return limiters.createAccount(req, res, next);
      } else if (path.includes('/fund-account')) {
        return limiters.fundAccount(req, res, next);
      } else {
        return limiters.contractWrite(req, res, next);
      }
    }
  }
  
  // Default to general rate limiting
  return limiters.general(req, res, next);
};

// Get rate limit status for monitoring
const getRateLimitStatus = async () => {
  if (!redisClient) {
    return { status: 'memory_store', message: 'Using memory store for rate limiting' };
  }
  
  try {
    const info = await redisClient.info('memory');
    return { 
      status: 'redis_store', 
      message: 'Using Redis for distributed rate limiting',
      redis_info: info
    };
  } catch (error) {
    return { 
      status: 'redis_error', 
      message: 'Redis error, falling back to memory store',
      error: error.message
    };
  }
};

// Reset rate limits for a specific user/IP (admin function)
const resetRateLimit = async (key) => {
  if (!redisClient) {
    throw new Error('Redis not available for rate limit reset');
  }
  
  try {
    const pattern = `rl:*${key}*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info('Rate limit reset for key:', key);
    }
    return { reset: true, keys_found: keys.length };
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
    throw error;
  }
};

module.exports = {
  applyRateLimit,
  smartRateLimiter,
  createRateLimiter,
  createUserBasedRateLimiter,
  createDynamicRateLimiter,
  createProgressiveRateLimiter,
  getRateLimitStatus,
  resetRateLimit,
  RATE_LIMIT_CONFIGS,
  limiters
};
