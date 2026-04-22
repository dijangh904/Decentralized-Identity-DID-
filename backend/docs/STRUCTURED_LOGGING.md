# Structured Logging Implementation

This document describes the comprehensive structured logging system implemented for the Stellar DID Backend, designed to provide enhanced debugging capabilities for production issues.

## Overview

The structured logging system includes:
- **Correlation IDs**: Track requests across the entire system
- **Structured JSON logs**: Machine-readable logs for production
- **Monitoring integrations**: Sentry and DataDog support
- **Performance monitoring**: Automatic slow request detection
- **Security event logging**: Suspicious activity detection
- **Business event tracking**: Important domain events

## Features

### 1. Correlation IDs
Every request gets a unique correlation ID that propagates through all log entries, making it easy to trace a single request across multiple services and log entries.

```javascript
// Automatic correlation ID generation
app.use(correlationMiddleware);

// Manual correlation context setting
logger.setCorrelationContext({
  correlationId: 'custom-id',
  userId: 'user-123',
  service: 'auth-service'
});
```

### 2. Structured Logging Methods

#### Basic Logging
```javascript
logger.logInfo('User login successful', { userId: 'user-123', ip: '192.168.1.1' });
logger.logError('Database connection failed', error, { database: 'users' });
logger.logWarning('Rate limit approaching', { current: 95, limit: 100 });
logger.logDebug('Cache hit', { key: 'user:123', ttl: 300 });
```

#### Specialized Logging
```javascript
// Performance logging
logger.logPerformance('database_query', 150, { query: 'SELECT * FROM users' });

// Security events
logger.logSecurity('failed_login_attempt', { 
  userId: 'user-123', 
  ip: '192.168.1.1',
  reason: 'invalid_password'
});

// Business events
logger.logBusiness('did_created', { 
  did: 'did:stellar:123456',
  owner: 'user-123'
});
```

### 3. Environment-Specific Formats

#### Development (Human-readable)
```
2024-01-15 10:30:45:123 [abc123-def456] [user-789] [req-456] info: User login successful {"userId":"user-123","ip":"192.168.1.1"}
```

#### Production (JSON)
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User login successful",
  "correlationId": "abc123-def456",
  "userId": "user-789",
  "requestId": "req-456",
  "service": "stellar-did-backend",
  "version": "1.0.0",
  "environment": "production",
  "hostname": "server-01",
  "pid": 1234,
  "userId": "user-123",
  "ip": "192.168.1.1"
}
```

## Configuration

### Environment Variables

```bash
# Basic logging configuration
LOG_LEVEL=info                    # error, warn, info, http, debug
LOG_FORMAT=json                   # json, development
NODE_ENV=production               # development, production, test, staging

# Monitoring integrations
SENTRY_DSN=https://your-sentry-dsn
SENTRY_TRACES_SAMPLE_RATE=0.1
DATADOG_API_KEY=your-datadog-key
DATADOG_SITE=datadoghq.com
DATADOG_SERVICE=stellar-did-backend

# Performance settings
SLOW_REQUEST_THRESHOLD=1000       # milliseconds
SLOW_QUERY_THRESHOLD=500         # milliseconds
MEMORY_USAGE_INTERVAL=300000     # 5 minutes

# Feature flags
ENABLE_PERFORMANCE_LOGGING=true
ENABLE_SECURITY_LOGGING=true
ENABLE_BUSINESS_LOGGING=true
```

### Configuration Files

The logging configuration is centralized in `src/config/logging.js`:

```javascript
const { getLoggingConfig } = require('./config/logging');
const config = getLoggingConfig();
```

## Monitoring Integrations

### Sentry Integration
```javascript
// Automatic error reporting to Sentry
// Configure via SENTRY_DSN environment variable
SENTRY_DSN=https://your-project@sentry.io/123456
```

### DataDog Integration
```javascript
// Automatic log forwarding to DataDog
// Configure via DATADOG_API_KEY environment variable
DATADOG_API_KEY=your-datadog-api-key
```

## Middleware Stack

The logging middleware should be applied first in your Express app:

```javascript
app.use(correlationMiddleware);        // Must be first
app.use(performanceMiddleware);       // Performance tracking
app.use(securityMiddleware);          // Security monitoring
app.use(businessContextMiddleware);   // Business events
```

## Best Practices

### 1. Use Structured Data
```javascript
// Good
logger.logInfo('API request processed', {
  endpoint: '/api/v1/did',
  method: 'GET',
  duration: 150,
  statusCode: 200
});

// Avoid
logger.info('API request processed - GET /api/v1/did took 150ms and returned 200');
```

### 2. Include Context
```javascript
// Always include relevant context
logger.logError('Validation failed', error, {
  userId: req.user?.id,
  endpoint: req.path,
  method: req.method,
  body: req.body,
  correlationId: req.correlationId
});
```

### 3. Use Appropriate Log Levels
- **error**: System errors, exceptions, failed operations
- **warn**: Deprecated features, security events, performance issues
- **info**: Important business events, request lifecycle
- **debug**: Detailed debugging information (development only)

### 4. Performance Logging
```javascript
const startTime = Date.now();
try {
  // Your operation
  await someOperation();
} catch (error) {
  logger.logError('Operation failed', error);
  throw error;
} finally {
  logger.logPerformance('someOperation', Date.now() - startTime);
}
```

## Log Analysis

### Searching Logs by Correlation ID
```bash
# Find all logs for a specific request
grep "correlation-id:abc123-def456" logs/combined.log

# Using jq for JSON logs
jq 'select(.correlationId == "abc123-def456")' logs/combined.log
```

### Performance Analysis
```bash
# Find slow requests
jq 'select(.duration | tonumber > 1000)' logs/combined.log

# Average response time by endpoint
jq -s 'group_by(.endpoint) | map({endpoint: .[0].endpoint, avgDuration: (map(.duration | tonumber) | add / length)})' logs/combined.log
```

### Security Events
```bash
# Find security events
jq 'select(.securityEvent)' logs/security.log

# Failed login attempts
jq 'select(.securityEvent == "failed_login_attempt")' logs/security.log
```

## Troubleshooting

### Common Issues

1. **Missing correlation IDs**: Ensure `correlationMiddleware` is applied first
2. **Logs not appearing**: Check `LOG_LEVEL` configuration
3. **Monitoring not working**: Verify API keys and environment variables
4. **Performance impact**: Adjust logging levels and disable debug in production

### Debug Mode
```bash
# Enable verbose logging
LOG_LEVEL=debug npm run dev

# Test correlation ID propagation
curl -H "X-Correlation-ID: test-123" http://localhost:3001/health
```

## Migration Guide

### From Basic Winston Logging

**Before:**
```javascript
logger.error('Something went wrong', error);
logger.info('User logged in', userId);
```

**After:**
```javascript
logger.logError('Something went wrong', error, { context: 'additional' });
logger.logInfo('User logged in', { userId });
```

### Updating Existing Routes

1. Add correlation ID to error responses
2. Use structured logging methods
3. Add performance tracking for slow operations
4. Log business events for important operations

## Testing

Run the comprehensive test suite:

```bash
# Run logging tests
npm test -- tests/logging.test.js

# Test with verbose logging
VERBOSE_TESTS=true npm test -- tests/logging.test.js

# Test different environments
NODE_ENV=production npm test -- tests/logging.test.js
```

## Security Considerations

1. **Sensitive Data**: Never log passwords, tokens, or PII
2. **Log Access**: Secure log files and restrict access
3. **Log Retention**: Implement appropriate retention policies
4. **Monitoring**: Monitor log volume and storage usage

## Performance Impact

The structured logging system is designed for minimal performance impact:

- Async logging where possible
- Conditional logging based on environment
- Efficient JSON serialization
- Log rotation and compression in production

Estimated overhead: < 5ms per request in production

## Future Enhancements

1. **Distributed Tracing**: Integration with OpenTelemetry
2. **Log Aggregation**: ELK stack integration
3. **Real-time Monitoring**: WebSocket-based log streaming
4. **AI-powered Analysis**: Automated anomaly detection
5. **Custom Dashboards**: Grafana/Kibana integration

## Support

For issues or questions about the logging implementation:

1. Check this documentation
2. Review the test suite for examples
3. Check the configuration files
4. Enable debug mode for troubleshooting
