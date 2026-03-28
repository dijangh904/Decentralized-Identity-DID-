/**
 * Input Validation Middleware
 * Provides server-side input validation and sanitization to prevent XSS and injection attacks
 */

const Joi = require('joi');

/**
 * Basic HTML sanitization function
 * @param {string} content - The content to sanitize
 * @returns {string} - The sanitized content
 */
const sanitizeHtml = (content) => {
  if (typeof content !== 'string') {
    return '';
  }
  
  return content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form[^>]*>.*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<textarea[^>]*>.*?<\/textarea>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '');
};

/**
 * Sanitize text content
 * @param {string} content - The content to sanitize
 * @returns {string} - The sanitized content
 */
const sanitizeText = (content) => {
  if (typeof content !== 'string') {
    return '';
  }
  
  return content
    .trim()
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
};

/**
 * Validation schemas for different input types
 */
const schemas = {
  // DID validation schema
  did: Joi.string()
    .required()
    .pattern(/^did:stellar:G[A-Z0-7]{55}$/)
    .messages({
      'string.pattern.base': 'Invalid DID format. Expected format: did:stellar:G...',
      'any.required': 'DID is required'
    }),

  // Stellar public key validation
  publicKey: Joi.string()
    .required()
    .pattern(/^G[A-Z0-7]{55}$/)
    .messages({
      'string.pattern.base': 'Invalid Stellar public key format',
      'any.required': 'Public key is required'
    }),

  // Stellar secret key validation
  secretKey: Joi.string()
    .required()
    .pattern(/^S[A-Z0-7]{55}$/)
    .messages({
      'string.pattern.base': 'Invalid Stellar secret key format',
      'any.required': 'Secret key is required'
    }),

  // URL validation
  url: Joi.string()
    .optional()
    .uri()
    .custom((value, helpers) => {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return helpers.error('custom.invalidProtocol');
        }
        return value;
      } catch (error) {
        return helpers.error('custom.invalidUrl');
      }
    })
    .messages({
      'string.uri': 'Invalid URL format',
      'custom.invalidProtocol': 'Only HTTP and HTTPS URLs are allowed',
      'custom.invalidUrl': 'Invalid URL format'
    }),

  // Credential type validation
  credentialType: Joi.string()
    .required()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z0-9\-_\.]+$/)
    .messages({
      'string.pattern.base': 'Credential type can only contain letters, numbers, hyphens, underscores, and dots',
      'any.required': 'Credential type is required'
    }),

  // Claims validation (object with sanitized keys and values)
  claims: Joi.object()
    .required()
    .custom((value, helpers) => {
      const sanitizedClaims = {};
      
      for (const [key, val] of Object.entries(value)) {
        // Sanitize keys
        const sanitizedKey = sanitizeText(key);
        if (!sanitizedKey || sanitizedKey.length > 100) {
          return helpers.error('custom.invalidClaimKey');
        }
        
        // Sanitize values based on type
        let sanitizedValue;
        if (typeof val === 'string') {
          sanitizedValue = sanitizeText(val);
          if (sanitizedValue.length > 1000) {
            return helpers.error('custom.claimValueTooLong');
          }
        } else if (typeof val === 'number' && Number.isFinite(val)) {
          sanitizedValue = val;
        } else if (typeof val === 'boolean') {
          sanitizedValue = val;
        } else if (Array.isArray(val)) {
          sanitizedValue = val.map(item => 
            typeof item === 'string' ? sanitizeText(item) : item
          ).filter(item => typeof item === 'string' && item.length <= 500);
        } else {
          return helpers.error('custom.invalidClaimValueType');
        }
        
        sanitizedClaims[sanitizedKey] = sanitizedValue;
      }
      
      return sanitizedClaims;
    })
    .messages({
      'custom.invalidClaimKey': 'Invalid claim key format',
      'custom.claimValueTooLong': 'Claim value is too long',
      'custom.invalidClaimValueType': 'Invalid claim value type'
    }),

  // Credential ID validation
  credentialId: Joi.string()
    .required()
    .min(1)
    .max(200)
    .pattern(/^[a-zA-Z0-9\-_\.]+$/)
    .messages({
      'string.pattern.base': 'Credential ID can only contain letters, numbers, hyphens, underscores, and dots',
      'any.required': 'Credential ID is required'
    })
};

/**
 * Middleware factory for input validation
 * @param {string} schemaName - The schema name to use for validation
 * @param {string} source - The source of input ('body', 'query', 'params')
 * @returns {Function} - Express middleware function
 */
const validateInput = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        message: `Invalid schema: ${schemaName}`
      });
    }

    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Middleware for sanitizing query parameters
 */
const sanitizeQuery = (req, res, next) => {
  if (req.query) {
    const sanitizedQuery = {};
    
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        sanitizedQuery[sanitizeText(key)] = sanitizeText(value);
      } else {
        sanitizedQuery[sanitizeText(key)] = value;
      }
    }
    
    req.query = sanitizedQuery;
  }
  
  next();
};

/**
 * Middleware for sanitizing URL parameters
 */
const sanitizeParams = (req, res, next) => {
  if (req.params) {
    const sanitizedParams = {};
    
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        sanitizedParams[sanitizeText(key)] = sanitizeText(value);
      } else {
        sanitizedParams[sanitizeText(key)] = value;
      }
    }
    
    req.params = sanitizedParams;
  }
  
  next();
};

/**
 * Custom validation schemas for specific endpoints
 */
const customSchemas = {
  // Register DID endpoint
  registerDID: Joi.object({
    did: schemas.did,
    publicKey: schemas.publicKey,
    serviceEndpoint: schemas.url.optional(),
    signerSecret: schemas.secretKey
  }),

  // Update DID endpoint
  updateDID: Joi.object({
    did: schemas.did,
    updates: Joi.object({
      publicKey: schemas.publicKey.optional(),
      serviceEndpoint: schemas.url.optional()
    }).min(1).required(),
    signerSecret: schemas.secretKey
  }),

  // Issue credential endpoint
  issueCredential: Joi.object({
    issuerDID: schemas.did,
    subjectDID: schemas.did,
    credentialType: schemas.credentialType,
    claims: schemas.claims,
    signerSecret: schemas.secretKey
  }),

  // Revoke credential endpoint
  revokeCredential: Joi.object({
    credentialId: schemas.credentialId,
    signerSecret: schemas.secretKey
  }),

  // Verify credential endpoint
  verifyCredential: Joi.object({
    credentialId: schemas.credentialId
  }),

  // Fund account endpoint
  fundAccount: Joi.object({
    publicKey: schemas.publicKey
  })
};

/**
 * Middleware factory for custom validation
 * @param {string} endpointName - The endpoint name for custom validation
 * @returns {Function} - Express middleware function
 */
const validateEndpoint = (endpointName) => {
  return (req, res, next) => {
    const schema = customSchemas[endpointName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        message: `Invalid endpoint schema: ${endpointName}`
      });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  validateInput,
  sanitizeQuery,
  sanitizeParams,
  validateEndpoint,
  schemas,
  sanitizeHtml,
  sanitizeText
};
