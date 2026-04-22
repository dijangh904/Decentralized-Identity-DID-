const winston = require('winston');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cls = require('cls-hooked');

// Create namespace for correlation context
const correlationNamespace = cls.createNamespace('correlation');

// Define log levels with structured logging support
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Log color setup
winston.addColors(colors);

// Structured log format for development (human-readable)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.printf((info) => {
    const correlationId = correlationNamespace.get('correlationId') || 'N/A';
    const userId = correlationNamespace.get('userId') || 'N/A';
    const requestId = correlationNamespace.get('requestId') || 'N/A';
    
    let msg = `${info.timestamp} [${correlationId}] [${userId}] [${requestId}] ${info.level}: ${info.message}`;
    
    // Add metadata if present
    if (Object.keys(info.metadata || {}).length > 0) {
      msg += ` ${JSON.stringify(info.metadata)}`;
    }
    
    // Add stack trace for errors
    if (info.stack) {
      msg += `\n${info.stack}`;
    }
    
    return msg;
  })
);

// Structured log format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.json()
);

// Custom format to add correlation context
const correlationFormat = winston.format((info) => {
  const correlationId = correlationNamespace.get('correlationId');
  const userId = correlationNamespace.get('userId');
  const requestId = correlationNamespace.get('requestId');
  const service = correlationNamespace.get('service') || 'stellar-did-backend';
  const version = correlationNamespace.get('version') || process.env.APP_VERSION || '1.0.0';
  
  return {
    ...info,
    correlationId: correlationId || uuidv4(),
    userId: userId || null,
    requestId: requestId || null,
    service,
    version,
    environment: process.env.NODE_ENV || 'development',
    hostname: require('os').hostname(),
    pid: process.pid,
  };
});

// Define transports
const createTransports = () => {
  const transports = [];
  
  // Console transport with different formats based on environment
  transports.push(
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    })
  );
  
  // File transports for production
  if (process.env.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }
  
  // Add monitoring integration if configured
  if (process.env.SENTRY_DSN) {
    const SentryTransport = require('./sentryTransport');
    transports.push(new SentryTransport({ level: 'error' }));
  }
  
  if (process.env.DATADOG_API_KEY) {
    const DatadogTransport = require('./datadogTransport');
    transports.push(new DatadogTransport({ level: 'info' }));
  }
  
  return transports;
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels,
  format: winston.format.combine(
    correlationFormat(),
    process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat
  ),
  transports: createTransports(),
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ],
  exitOnError: false,
});

// Enhanced logging methods with structured data
logger.logStructured = (level, message, metadata = {}) => {
  logger.log(level, message, metadata);
};

// Convenience methods for structured logging
logger.logError = (message, error = null, metadata = {}) => {
  const errorData = {
    ...metadata,
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
      }
    })
  };
  logger.error(message, errorData);
};

logger.logInfo = (message, metadata = {}) => {
  logger.info(message, metadata);
};

logger.logWarning = (message, metadata = {}) => {
  logger.warn(message, metadata);
};

logger.logDebug = (message, metadata = {}) => {
  logger.debug(message, metadata);
};

// Performance logging
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};

// Security event logging
logger.logSecurity = (event, metadata = {}) => {
  logger.warn(`Security Event: ${event}`, {
    securityEvent: event,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Business event logging
logger.logBusiness = (event, metadata = {}) => {
  logger.info(`Business Event: ${event}`, {
    businessEvent: event,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Correlation context management
logger.setCorrelationContext = (context) => {
  correlationNamespace.run(() => {
    Object.keys(context).forEach(key => {
      correlationNamespace.set(key, context[key]);
    });
  });
};

logger.getCorrelationId = () => {
  return correlationNamespace.get('correlationId');
};

// Create child logger with additional context
logger.child = (context) => {
  const childLogger = logger.child(context);
  childLogger.setCorrelationContext = (newContext) => {
    logger.setCorrelationContext({ ...context, ...newContext });
  };
  return childLogger;
};

module.exports = logger;
module.exports.correlationNamespace = correlationNamespace;
