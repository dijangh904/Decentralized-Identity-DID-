const winston = require('winston');
const https = require('https');

/**
 * Custom Winston transport for Datadog integration
 */
class DatadogTransport extends winston.Transport {
  constructor(options = {}) {
    super(options);
    
    this.name = 'datadog';
    this.level = options.level || 'info';
    this.apiKey = process.env.DATADOG_API_KEY;
    this.site = process.env.DATADOG_SITE || 'datadoghq.com';
    this.hostname = process.env.DATADOG_HOSTNAME || require('os').hostname();
    this.service = process.env.DATADOG_SERVICE || 'stellar-did-backend';
    
    if (!this.apiKey) {
      console.warn('DATADOG_API_KEY not configured, Datadog transport will be disabled');
    }
  }
  
  log(info, callback) {
    if (!this.apiKey) {
      return callback();
    }
    
    const { level, message, correlationId, userId, requestId, error, ...metadata } = info;
    
    // Prepare log data for Datadog
    const logData = {
      '@timestamp': new Date().toISOString(),
      message: message,
      level: level.toUpperCase(),
      service: this.service,
      hostname: this.hostname,
      ddsource: 'nodejs',
      ddtags: [
        `env:${process.env.NODE_ENV || 'development'}`,
        `service:${this.service}`,
        correlationId ? `correlation_id:${correlationId}` : null,
        requestId ? `request_id:${requestId}` : null,
        userId ? `user_id:${userId}` : null
      ].filter(Boolean).join(','),
      correlation_id: correlationId,
      request_id: requestId,
      user_id: userId,
      ...metadata
    };
    
    // Add error details if present
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    }
    
    // Send to Datadog
    this.sendToDatadog(logData, callback);
  }
  
  sendToDatadog(logData, callback) {
    const data = JSON.stringify(logData);
    const options = {
      hostname: 'http-intake.logs.' + this.site,
      port: 443,
      path: '/api/v2/logs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'DD-API-KEY': this.apiKey
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          callback();
        } else {
          console.error(`Failed to send log to Datadog: ${res.statusCode} ${body}`);
          callback();
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('Error sending log to Datadog:', err);
      callback();
    });
    
    req.write(data);
    req.end();
  }
}

module.exports = DatadogTransport;
