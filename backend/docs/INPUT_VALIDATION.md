# Comprehensive Input Validation System

This document describes the comprehensive Joi-based input validation system implemented for the Stellar DID Backend, providing robust security against common web vulnerabilities and ensuring data integrity.

## Overview

The validation system provides:
- **Schema-based validation** using Joi for type safety and format validation
- **Security threat detection** against SQL injection, XSS, command injection, etc.
- **Rate limiting** to prevent abuse and DoS attacks
- **Content validation** including file size and media type checks
- **Comprehensive error reporting** with detailed field-level feedback

## Architecture

### Core Components

1. **Base Schemas** (`schemas`) - Reusable validation patterns
2. **Endpoint Schemas** (`customSchemas`) - Specific endpoint validation rules
3. **Security Validation** (`securityValidation`) - Threat detection functions
4. **Middleware Functions** - Express middleware for request validation
5. **Sanitization Functions** - Input cleaning and XSS prevention

## Security Features

### Threat Detection

The system detects and blocks:

#### SQL Injection
```javascript
// Blocked patterns:
"'; DROP TABLE users; --"
"1' OR '1'='1"
"UNION SELECT * FROM users"
```

#### Cross-Site Scripting (XSS)
```javascript
// Blocked patterns:
"<script>alert('xss')</script>"
"<img src=x onerror=alert('xss')>"
"javascript:alert('xss')"
```

#### Command Injection
```javascript
// Blocked patterns:
"; rm -rf /"
"&& cat /etc/passwd"
"`whoami`"
```

#### Path Traversal
```javascript
// Blocked patterns:
"../../../etc/passwd"
"..\\..\\windows\\system32"
"%2e%2e%2f%2e%2e%2f"
```

#### NoSQL Injection
```javascript
// Blocked patterns:
"{$where: {username: 'admin'}}"
"{$ne: null}"
"{$gt: ''}"
```

## Validation Schemas

### Base Schemas

#### Authentication
```javascript
email: Joi.string().required().email().max(254)
password: Joi.string().required().min(8).max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
username: Joi.string().required().alphanum().min(3).max(30)
```

#### DID and Stellar
```javascript
did: Joi.string().required().pattern(/^did:stellar:G[A-Z0-7]{55}$/)
publicKey: Joi.string().required().pattern(/^G[A-Z0-7]{55}$/)
secretKey: Joi.string().required().pattern(/^S[A-Z0-7]{55}$/)
```

#### Data Types
```javascript
url: Joi.string().optional().uri()
objectId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/)
text: Joi.string().optional().max(1000)
amount: Joi.number().required().positive().max(1000000000).precision(7)
```

### Endpoint Schemas

#### User Registration
```javascript
registerUser: Joi.object({
  email: schemas.email,
  password: schemas.password,
  username: schemas.username.optional(),
  walletAddress: schemas.publicKey.optional(),
  profile: Joi.object({
    firstName: schemas.text.max(50),
    lastName: schemas.text.max(50),
    bio: schemas.text.max(500),
    avatar: schemas.url
  }).optional()
}).xor('password', 'walletAddress')
```

#### QR Code Generation
```javascript
generateQR: Joi.object({
  type: Joi.string().required().valid('did', 'credential', 'connection'),
  did: schemas.did.when('type', { is: 'did', then: Joi.required() }),
  credentialId: schemas.credentialId.when('type', { is: 'credential', then: Joi.required() }),
  publicKey: schemas.publicKey.when('type', { is: 'connection', then: Joi.required() }),
  metadata: Joi.object().max(10).optional()
}).xor('did', 'credentialId', 'publicKey')
```

## Middleware Usage

### Basic Validation
```javascript
const { validateInput } = require('./middleware/inputValidation');

// Validate specific schema
router.post('/endpoint', validateInput('email', 'body'), (req, res) => {
  // req.body is validated and sanitized
});
```

### Security-Enhanced Validation
```javascript
const { validateWithSecurity } = require('./middleware/inputValidation');

// Validate with security checks
router.post('/secure-endpoint', validateWithSecurity('text', 'body'), (req, res) => {
  // Blocks malicious content automatically
});
```

### Endpoint-Specific Validation
```javascript
const { validateEndpoint } = require('./middleware/inputValidation');

// Validate using custom schema
router.post('/register', validateEndpoint('registerUser'), (req, res) => {
  // Validates entire request body against registerUser schema
});
```

### Rate Limiting
```javascript
const { validateRateLimit } = require('./middleware/inputValidation');

const authRateLimit = validateRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts'
});

router.post('/login', authRateLimit, (req, res) => {
  // Rate limited endpoint
});
```

### Content-Type Validation
```javascript
const { validateContentType } = require('./middleware/inputValidation');

// Only accept JSON
router.use(validateContentType(['application/json']));
```

### Request Size Validation
```javascript
const { validateRequestSize } = require('./middleware/inputValidation');

// Limit to 10MB
router.use(validateRequestSize(10 * 1024 * 1024));
```

## Implementation Examples

### Adding Validation to Routes

```javascript
const express = require('express');
const { 
  validateEndpoint, 
  validateContentType, 
  validateRequestSize,
  validateRateLimit 
} = require('../middleware/inputValidation');

const router = express.Router();

// Global middleware
router.use(validateContentType(['application/json']));
router.use(validateRequestSize(1024 * 1024)); // 1MB max

// Rate limiting for sensitive endpoints
const authRateLimit = validateRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts'
});

// Protected endpoint with validation
router.post('/register', 
  authRateLimit, 
  validateEndpoint('registerUser'), 
  (req, res) => {
    // req.body is validated and sanitized
    res.json({ success: true, user: req.body });
  }
);
```

### Custom Validation Logic

```javascript
const Joi = require('joi');
const { securityValidation } = require('./middleware/inputValidation');

// Custom schema with security validation
const customSchema = Joi.object({
  name: Joi.string().required().custom((value, helpers) => {
    const securityCheck = securityValidation.validateSecurity(value);
    if (!securityCheck.safe) {
      return helpers.error('custom.securityViolation');
    }
    return value;
  }).messages({
      'custom.securityViolation': 'Input contains malicious content'
    })
});
```

## Error Handling

### Validation Error Response Format
```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "string.email"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters long",
      "code": "string.min"
    }
  ]
}
```

### Security Violation Response
```json
{
  "success": false,
  "error": "Security Violation",
  "message": "Malicious input detected in field: name",
  "threats": ["xss", "sql"]
}
```

### Rate Limit Response
```json
{
  "success": false,
  "error": "Rate Limit Exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": 900
}
```

## Configuration

### Environment Variables
```bash
# Validation settings
VALIDATION_STRICT_MODE=true
VALIDATION_SANITIZE_HTML=true
VALIDATION_LOG_VIOLATIONS=true

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Request limits
MAX_REQUEST_SIZE=10485760  # 10MB
MAX_FILE_SIZE=5242880      # 5MB
```

## Best Practices

### 1. Layered Validation
```javascript
// Apply validation at multiple levels
router.use(validateContentType(['application/json']));     // Global
router.use(validateRequestSize(10 * 1024 * 1024));         // Global
router.post('/sensitive', validateRateLimit(options));     // Endpoint-specific
router.post('/sensitive', validateEndpoint('schema'));     // Endpoint-specific
```

### 2. Security-First Approach
```javascript
// Always use security-enhanced validation for user input
router.post('/user-input', validateWithSecurity('text', 'body'), (req, res) => {
  // Automatically blocks malicious content
});
```

### 3. Comprehensive Error Handling
```javascript
try {
  const result = await someOperation(req.body);
  res.json({ success: true, data: result });
} catch (error) {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details
    });
  }
  
  // Handle other errors
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}
```

### 4. Input Sanitization
```javascript
const { sanitizeText, sanitizeHtml } = require('./middleware/inputValidation');

// Always sanitize user-generated content
const cleanContent = sanitizeHtml(userInput);
const cleanText = sanitizeText(userInput);
```

## Testing

### Validation Tests
```javascript
describe('Input Validation', () => {
  test('should reject SQL injection attempts', async () => {
    const response = await request(app)
      .post('/endpoint')
      .send({ input: "'; DROP TABLE users; --" })
      .expect(400);
      
    expect(response.body.error).toBe('Security Violation');
    expect(response.body.threats).toContain('sql');
  });
  
  test('should validate email format', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'invalid-email' })
      .expect(400);
  });
});
```

### Security Tests
```javascript
describe('Security Validation', () => {
  const maliciousInputs = [
    "<script>alert('xss')</script>",
    "'; DROP TABLE users; --",
    "../../../etc/passwd",
    "{$where: {username: 'admin'}}"
  ];
  
  maliciousInputs.forEach(input => {
    test(`should block malicious input: ${input}`, () => {
      const result = securityValidation.validateSecurity(input);
      expect(result.safe).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });
  });
});
```

## Performance Considerations

### Optimization Tips

1. **Schema Caching**: Joi schemas are cached automatically
2. **Early Validation**: Validate at the earliest possible middleware
3. **Selective Security**: Use security validation only for user input
4. **Rate Limiting**: Implement appropriate rate limits per endpoint
5. **Input Sanitization**: Sanitize once, validate once

### Monitoring
```javascript
// Log validation failures for monitoring
const validationLogger = (req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (data.error === 'Validation error' || data.error === 'Security Violation') {
      console.warn('Validation failure:', {
        ip: req.ip,
        endpoint: req.path,
        error: data.error,
        userAgent: req.get('User-Agent')
      });
    }
    return originalJson.call(this, data);
  };
  next();
};
```

## Migration Guide

### From Basic Validation
```javascript
// Before
router.post('/endpoint', (req, res) => {
  if (!req.body.email || !req.body.email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  // ... rest of logic
});

// After
router.post('/endpoint', validateEndpoint('someSchema'), (req, res) => {
  // req.body is already validated
  // ... rest of logic
});
```

### Adding Security to Existing Routes
```javascript
// Before
router.post('/user-input', (req, res) => {
  const userInput = req.body.text;
  // ... process userInput
});

// After
router.post('/user-input', validateWithSecurity('text', 'body'), (req, res) => {
  const userInput = req.body.text; // Already sanitized and validated
  // ... process userInput safely
});
```

## Troubleshooting

### Common Issues

1. **Validation Not Working**: Ensure middleware is applied before route handlers
2. **False Positives**: Adjust security patterns for your specific use case
3. **Performance Issues**: Reduce validation complexity or add caching
4. **Missing Fields**: Check schema requirements and conditional validation

### Debug Mode
```javascript
// Enable detailed validation logging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log('Request body:', req.body);
    next();
  });
}
```

## Future Enhancements

1. **AI-Powered Threat Detection**: Machine learning for anomaly detection
2. **Dynamic Schema Loading**: Load validation schemas from database
3. **Real-time Threat Intelligence**: Integrate with security feeds
4. **Advanced Rate Limiting**: User-based and IP-based rate limiting
5. **Input Transformation**: Automatic data normalization and enrichment

## Support

For issues or questions about the validation system:

1. Check this documentation
2. Review validation schemas in `src/middleware/inputValidation.js`
3. Run tests to verify functionality
4. Check application logs for validation errors
5. Contact the development team for custom validation requirements
