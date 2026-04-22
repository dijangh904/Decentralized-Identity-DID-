const { v4: uuidv4 } = require('uuid');
const logger = require('./logger').correlationNamespace;

/**
 * Middleware to add correlation ID and request context to each request
 */
const correlationMiddleware = (req, res, next) => {
  // Generate or extract correlation ID
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       uuidv4();
  
  // Generate request ID for this specific request
  const requestId = uuidv4();
  
  // Extract user ID from JWT if available
  let userId = null;
  if (req.user && req.user.id) {
    userId = req.user.id;
  } else if (req.headers['x-user-id']) {
    userId = req.headers['x-user-id'];
  }
  
  // Set correlation context for this request
  logger.run(() => {
    logger.set('correlationId', correlationId);
    logger.set('requestId', requestId);
    logger.set('userId', userId);
    logger.set('service', 'stellar-did-backend');
    logger.set('version', process.env.APP_VERSION || '1.0.0');
    logger.set('ip', req.ip || req.connection.remoteAddress);
    logger.set('userAgent', req.get('User-Agent'));
    logger.set('method', req.method);
    logger.set('url', req.originalUrl);
    
    // Add correlation info to request object for easy access
    req.correlationId = correlationId;
    req.requestId = requestId;
    
    // Add correlation headers to response
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);
    
    // Log request start
    logger.logInfo('Request started', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    // Override res.end to log request completion
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      // Log request completion
      logger.logInfo('Request completed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: Date.now() - req.startTime,
        timestamp: new Date().toISOString()
      });
      
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  });
};

/**
 * Middleware to add performance timing
 */
const performanceMiddleware = (req, res, next) => {
  req.startTime = Date.now();
  
  // Add performance monitoring for slow requests
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - req.startTime;
    
    if (duration > 1000) { // Log slow requests (> 1s)
      logger.logPerformance('slow_request', duration, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode
      });
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Middleware to add security event logging
 */
const securityMiddleware = (req, res, next) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection attempts
    /javascript:/i,  // JavaScript protocol
  ];
  
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || '';
  
  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(url) || pattern.test(userAgent)) {
      logger.logSecurity('suspicious_request', {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        pattern: pattern.toString()
      });
    }
  });
  
  // Log authentication attempts
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    logger.logSecurity('auth_attempt', {
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress
    });
  }
  
  next();
};

/**
 * Middleware to add business context logging
 */
const businessContextMiddleware = (req, res, next) => {
  // Log business-relevant events
  const businessPaths = [
    '/did/create',
    '/did/verify',
    '/credentials/issue',
    '/credentials/verify',
    '/qr/generate'
  ];
  
  if (businessPaths.some(path => req.path.startsWith(path))) {
    logger.logBusiness('api_call', {
      operation: req.path.replace('/', ''),
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Error handler with structured logging
 */
const structuredErrorHandler = (err, req, res, next) => {
  logger.logError('Request error', err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = {
    error: {
      message: isDevelopment ? err.message : 'Internal Server Error',
      correlationId: req.correlationId,
      requestId: req.requestId,
      ...(isDevelopment && { stack: err.stack })
    }
  };
  
  res.status(err.status || 500).json(errorResponse);
};

/**
 * Async error wrapper for better error handling
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  correlationMiddleware,
  performanceMiddleware,
  securityMiddleware,
  businessContextMiddleware,
  structuredErrorHandler,
  asyncHandler
};
