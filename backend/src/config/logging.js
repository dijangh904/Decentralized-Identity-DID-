/**
 * Logging configuration for different environments
 */

const loggingConfig = {
  // Development configuration
  development: {
    level: 'debug',
    format: 'development',
    transports: ['console'],
    colors: true,
    prettyPrint: true,
    maxFiles: 3,
    maxSize: '10MB',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    showLevel: true,
    showTimestamp: true,
    showMetadata: true,
  },

  // Production configuration
  production: {
    level: 'info',
    format: 'json',
    transports: ['console', 'file'],
    colors: false,
    prettyPrint: false,
    maxFiles: 10,
    maxSize: '20MB',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    showLevel: true,
    showTimestamp: true,
    showMetadata: true,
    // Production-specific settings
    handleExceptions: true,
    handleRejections: true,
    exitOnError: false,
    // File rotation settings
    rotationInterval: '1d',
    rotationMaxSize: '100M',
    rotationMaxFiles: '14d',
  },

  // Test configuration
  test: {
    level: 'error',
    format: 'json',
    transports: ['console'],
    colors: false,
    prettyPrint: false,
    silent: true, // Suppress logs during tests unless VERBOSE_TESTS is true
    handleExceptions: false,
    handleRejections: false,
    exitOnError: false,
  },

  // Staging configuration
  staging: {
    level: 'debug',
    format: 'json',
    transports: ['console', 'file'],
    colors: false,
    prettyPrint: false,
    maxFiles: 5,
    maxSize: '10MB',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    showLevel: true,
    showTimestamp: true,
    showMetadata: true,
    handleExceptions: true,
    handleRejections: true,
    exitOnError: false,
  },
};

/**
 * Get logging configuration for current environment
 */
const getLoggingConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const config = loggingConfig[env] || loggingConfig.development;
  
  // Override with environment variables if provided
  return {
    ...config,
    level: process.env.LOG_LEVEL || config.level,
    format: process.env.LOG_FORMAT || config.format,
    // Override silent flag for tests
    silent: env === 'test' && process.env.VERBOSE_TESTS !== 'true',
  };
};

/**
 * Log file paths configuration
 */
const logPaths = {
  error: 'logs/error.log',
  combined: 'logs/combined.log',
  access: 'logs/access.log',
  security: 'logs/security.log',
  performance: 'logs/performance.log',
  business: 'logs/business.log',
  exceptions: 'logs/exceptions.log',
  rejections: 'logs/rejections.log',
};

/**
 * Monitoring integration configuration
 */
const monitoringConfig = {
  sentry: {
    enabled: !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    maxBreadcrumbs: 50,
    debug: process.env.NODE_ENV === 'development',
  },
  datadog: {
    enabled: !!process.env.DATADOG_API_KEY,
    apiKey: process.env.DATADOG_API_KEY,
    site: process.env.DATADOG_SITE || 'datadoghq.com',
    hostname: process.env.DATADOG_HOSTNAME || require('os').hostname(),
    service: process.env.DATADOG_SERVICE || 'stellar-did-backend',
  },
  // Add more monitoring integrations as needed
  cloudwatch: {
    enabled: !!process.env.AWS_CLOUDWATCH_LOG_GROUP,
    logGroup: process.env.AWS_CLOUDWATCH_LOG_GROUP,
    logStream: process.env.AWS_CLOUDWATCH_LOG_STREAM,
    region: process.env.AWS_REGION || 'us-east-1',
  },
};

/**
 * Performance logging configuration
 */
const performanceConfig = {
  slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 1000, // ms
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 500, // ms
  memoryUsageInterval: parseInt(process.env.MEMORY_USAGE_INTERVAL) || 300000, // 5 minutes
  enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
  enableMemoryLogging: process.env.ENABLE_MEMORY_LOGGING !== 'false',
  enableCpuLogging: process.env.ENABLE_CPU_LOGGING !== 'false',
};

/**
 * Security logging configuration
 */
const securityConfig = {
  enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',
  logFailedAuthAttempts: process.env.LOG_FAILED_AUTH_ATTEMPTS !== 'false',
  logSuspiciousRequests: process.env.LOG_SUSPICIOUS_REQUESTS !== 'false',
  logRateLimitHits: process.env.LOG_RATE_LIMIT_HITS !== 'false',
  suspiciousPatterns: [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection attempts
    /javascript:/i,  // JavaScript protocol
    /document\.cookie/i,  // Cookie theft attempts
    /eval\(/i,  // Code injection
    /exec\(/i,  // Command injection
  ],
};

/**
 * Business event logging configuration
 */
const businessConfig = {
  enableBusinessLogging: process.env.ENABLE_BUSINESS_LOGGING !== 'false',
  businessEvents: [
    'did_created',
    'did_verified',
    'credential_issued',
    'credential_verified',
    'qr_generated',
    'user_registered',
    'user_authenticated',
    'transaction_completed',
    'contract_deployed',
  ],
};

module.exports = {
  loggingConfig,
  getLoggingConfig,
  logPaths,
  monitoringConfig,
  performanceConfig,
  securityConfig,
  businessConfig,
};
