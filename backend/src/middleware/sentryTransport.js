const winston = require('winston');
const Sentry = require('@sentry/node');

/**
 * Custom Winston transport for Sentry integration
 */
class SentryTransport extends winston.Transport {
  constructor(options = {}) {
    super(options);
    
    // Initialize Sentry if not already done
    if (!Sentry.getCurrentHub().getClient()) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.APP_VERSION || '1.0.0',
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
        maxBreadcrumbs: 50,
        debug: process.env.NODE_ENV === 'development',
      });
    }
    
    this.name = 'sentry';
    this.level = options.level || 'error';
  }
  
  log(info, callback) {
    const { level, message, correlationId, userId, requestId, error, ...metadata } = info;
    
    // Only log error level and above
    if (level !== 'error' && level !== 'warn') {
      return callback();
    }
    
    // Add correlation context to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('correlationId', correlationId);
      scope.setTag('requestId', requestId);
      scope.setTag('service', metadata.service || 'stellar-did-backend');
      scope.setTag('environment', metadata.environment || 'development');
      scope.setTag('hostname', metadata.hostname);
      scope.setTag('pid', metadata.pid);
      
      if (userId) {
        scope.setUser({ id: userId });
      }
      
      // Add extra context
      scope.setExtras({
        ...metadata,
        timestamp: new Date().toISOString()
      });
      
      // Send to Sentry
      if (level === 'error') {
        if (error && error instanceof Error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(message, 'error');
        }
      } else if (level === 'warn') {
        Sentry.captureMessage(message, 'warning');
      }
    });
    
    callback();
  }
}

module.exports = SentryTransport;
