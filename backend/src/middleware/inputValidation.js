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
 * Enhanced validation schemas for comprehensive input validation
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

  // Email validation
  email: Joi.string()
    .required()
    .email()
    .max(254)
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
      'string.max': 'Email address is too long'
    }),

  // Password validation
  password: Joi.string()
    .required()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),

  // Username validation
  username: Joi.string()
    .required()
    .alphanum()
    .min(3)
    .max(30)
    .messages({
      'string.alphanum': 'Username can only contain letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters',
      'any.required': 'Username is required'
    }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().optional().valid('createdAt', 'updatedAt', 'name', 'email'),
    order: Joi.string().optional().valid('asc', 'desc').default('desc')
  }),

  // ID validation (MongoDB ObjectId)
  objectId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid ID format',
      'any.required': 'ID is required'
    }),

  // Text field validation
  text: Joi.string()
    .optional()
    .max(1000)
    .custom((value, helpers) => {
      const sanitized = sanitizeText(value);
      if (sanitized.length !== value.length) {
        return helpers.error('custom.containsInvalidChars');
      }
      return sanitized;
    })
    .messages({
      'string.max': 'Text is too long (max 1000 characters)',
      'custom.containsInvalidChars': 'Text contains invalid characters'
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
    .max(50) // Maximum 50 claims
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
          if (val.length > 100) {
            return helpers.error('custom.claimArrayTooLong');
          }
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
      'custom.claimArrayTooLong': 'Claim array has too many items',
      'custom.invalidClaimValueType': 'Invalid claim value type',
      'object.max': 'Too many claims provided (max 50)'
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
    }),

  // QR Token validation
  qrToken: Joi.string()
    .required()
    .min(10)
    .max(1000)
    .pattern(/^[A-Za-z0-9+\/=]+$/)
    .messages({
      'string.pattern.base': 'Invalid token format',
      'string.min': 'Token is too short',
      'string.max': 'Token is too long',
      'any.required': 'Token is required'
    }),

  // Stellar amount validation
  amount: Joi.number()
    .required()
    .positive()
    .max(1000000000) // Max 1 billion XLM
    .precision(7) // Stellar precision
    .messages({
      'number.positive': 'Amount must be positive',
      'number.max': 'Amount exceeds maximum limit',
      'any.required': 'Amount is required'
    }),

  // Date range validation
  dateRange: Joi.object({
    startDate: Joi.date().optional().iso(),
    endDate: Joi.date().optional().iso().greater(Joi.ref('startDate')),
    limit: Joi.number().integer().min(1).max(1000).default(100)
  }).messages({
    'date.greater': 'End date must be after start date'
  }),

  // Search query validation
  searchQuery: Joi.string()
    .optional()
    .min(1)
    .max(100)
    .custom((value, helpers) => {
      const sanitized = sanitizeText(value);
      if (sanitized.length !== value.length) {
        return helpers.error('custom.containsInvalidChars');
      }
      return sanitized;
    })
    .messages({
      'string.min': 'Search query cannot be empty',
      'string.max': 'Search query is too long',
      'custom.containsInvalidChars': 'Search query contains invalid characters'
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
 * Comprehensive validation schemas for all API endpoints
 */
const customSchemas = {
  // Authentication endpoints
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
  }).xor('password', 'walletAddress'), // Either password or wallet address required

  loginUser: Joi.object({
    identifier: Joi.string().required().min(1).max(254), // Email or username or wallet address
    password: schemas.password.optional(),
    walletAuth: Joi.boolean().default(false)
  }).when('walletAuth', {
    is: true,
    then: Joi.object({
      identifier: Joi.string().required(),
      password: Joi.optional(),
      walletAuth: Joi.boolean().required()
    }),
    otherwise: Joi.object({
      identifier: Joi.string().required(),
      password: schemas.password.required(),
      walletAuth: Joi.boolean().optional()
    })
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().min(10)
  }),

  changePassword: Joi.object({
    currentPassword: schemas.password.required(),
    newPassword: schemas.password.required()
  }),

  // DID endpoints
  registerDID: Joi.object({
    did: schemas.did,
    publicKey: schemas.publicKey,
    serviceEndpoint: schemas.url.optional(),
    signerSecret: schemas.secretKey,
    verificationMethod: Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('Ed25519VerificationKey2018').required(),
      controller: schemas.did.required(),
      publicKeyPem: Joi.string().required()
    }).optional()
  }),

  updateDID: Joi.object({
    did: schemas.did,
    updates: Joi.object({
      publicKey: schemas.publicKey.optional(),
      serviceEndpoint: schemas.url.optional(),
      verificationMethod: Joi.object({
        id: Joi.string().required(),
        type: Joi.string().valid('Ed25519VerificationKey2018').required(),
        controller: schemas.did.required(),
        publicKeyPem: Joi.string().required()
      }).optional(),
      alsoKnownAs: Joi.array().items(schemas.text.max(100)).max(10).optional()
    }).min(1).required(),
    signerSecret: schemas.secretKey
  }),

  getDID: Joi.object({
    did: schemas.did
  }),

  resolveDID: Joi.object({
    did: schemas.did
  }),

  // Credential endpoints
  issueCredential: Joi.object({
    issuerDID: schemas.did,
    subjectDID: schemas.did,
    credentialType: schemas.credentialType,
    claims: schemas.claims,
    signerSecret: schemas.secretKey,
    issuanceDate: Joi.date().iso().optional().default(() => new Date().toISOString()),
    expirationDate: Joi.date().iso().greater('now').optional()
  }),

  verifyCredential: Joi.object({
    credentialId: schemas.credentialId
  }),

  revokeCredential: Joi.object({
    credentialId: schemas.credentialId,
    signerSecret: schemas.secretKey,
    reason: schemas.text.max(500).optional()
  }),

  getCredential: Joi.object({
    credentialId: schemas.credentialId
  }),

  listCredentials: Joi.object({
    issuerDID: schemas.did.optional(),
    subjectDID: schemas.did.optional(),
    credentialType: schemas.credentialType.optional(),
    status: Joi.string().valid('active', 'revoked', 'expired').optional(),
    ...schemas.pagination
  }),

  // QR Code endpoints
  generateQR: Joi.object({
    type: Joi.string().required().valid('did', 'credential', 'connection'),
    did: schemas.did.when('type', {
      is: 'did',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    credentialId: schemas.credentialId.when('type', {
      is: 'credential',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    publicKey: schemas.publicKey.when('type', {
      is: 'connection',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    metadata: Joi.object().max(10).optional()
  }).xor('did', 'credentialId', 'publicKey'), // Only one of these should be provided based on type

  validateQR: Joi.object({
    token: schemas.qrToken
  }),

  // Contract endpoints
  deployContract: Joi.object({
    contractType: Joi.string().required().valid('DIDRegistry', 'CredentialRegistry', 'StellarBridge'),
    parameters: Joi.object().max(20).optional(),
    signerSecret: schemas.secretKey,
    network: Joi.string().valid('testnet', 'mainnet').default('testnet')
  }),

  interactWithContract: Joi.object({
    contractAddress: Joi.string().required().pattern(/^0x[a-fA-F0-9]{40}$/),
    method: Joi.string().required().max(100),
    parameters: Joi.array().max(10).optional(),
    signerSecret: schemas.secretKey,
    value: schemas.amount.optional()
  }),

  getContractInfo: Joi.object({
    contractAddress: Joi.string().required().pattern(/^0x[a-fA-F0-9]{40}$/)
  }),

  // Stellar operations
  fundAccount: Joi.object({
    publicKey: schemas.publicKey,
    amount: schemas.amount.optional().default(1),
    memo: schemas.text.max(28).optional()
  }),

  createPayment: Joi.object({
    fromPublicKey: schemas.publicKey,
    toPublicKey: schemas.publicKey,
    amount: schemas.amount,
    asset: Joi.string().optional().default('XLM'),
    memo: schemas.text.max(28).optional(),
    signerSecret: schemas.secretKey
  }),

  getAccountInfo: Joi.object({
    publicKey: schemas.publicKey
  }),

  getTransactionHistory: Joi.object({
    publicKey: schemas.publicKey,
    ...schemas.pagination,
    ...schemas.dateRange
  }),

  // Search and filtering
  searchDIDs: Joi.object({
    query: schemas.searchQuery.optional(),
    owner: schemas.publicKey.optional(),
    network: Joi.string().valid('testnet', 'mainnet').optional(),
    ...schemas.pagination
  }),

  searchCredentials: Joi.object({
    query: schemas.searchQuery.optional(),
    issuerDID: schemas.did.optional(),
    subjectDID: schemas.did.optional(),
    credentialType: schemas.credentialType.optional(),
    ...schemas.pagination,
    ...schemas.dateRange
  }),

  // Admin endpoints
  updateUserStatus: Joi.object({
    userId: schemas.objectId,
    status: Joi.string().required().valid('active', 'inactive', 'suspended'),
    reason: schemas.text.max(500).optional()
  }),

  getSystemStats: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day')
  }),

  // Profile management
  updateProfile: Joi.object({
    firstName: schemas.text.max(50).optional(),
    lastName: schemas.text.max(50).optional(),
    bio: schemas.text.max(500).optional(),
    avatar: schemas.url.optional(),
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark').optional(),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'ja', 'zh').optional(),
      notifications: Joi.object({
        email: Joi.boolean().optional(),
        push: Joi.boolean().optional(),
        sms: Joi.boolean().optional()
      }).optional()
    }).optional()
  }).min(1),

  // Session management
  revokeSession: Joi.object({
    sessionId: schemas.objectId.required()
  }),

  // Bulk operations
  bulkVerifyCredentials: Joi.object({
    credentialIds: Joi.array().items(schemas.credentialId).max(100).required().min(1)
  }),

  bulkRevokeCredentials: Joi.object({
    credentialIds: Joi.array().items(schemas.credentialId).max(100).required().min(1),
    signerSecret: schemas.secretKey,
    reason: schemas.text.max(500).optional()
  }),

  // Webhook endpoints
  createWebhook: Joi.object({
    url: schemas.url.required(),
    events: Joi.array().items(
      Joi.string().valid('did.created', 'did.updated', 'credential.issued', 'credential.revoked', 'user.registered')
    ).min(1).max(10).required(),
    secret: Joi.string().min(16).max(64).optional(),
    active: Joi.boolean().default(true)
  }),

  updateWebhook: Joi.object({
    webhookId: schemas.objectId.required(),
    url: schemas.url.optional(),
    events: Joi.array().items(
      Joi.string().valid('did.created', 'did.updated', 'credential.issued', 'credential.revoked', 'user.registered')
    ).min(1).max(10).optional(),
    secret: Joi.string().min(16).max(64).optional(),
    active: Joi.boolean().optional()
  }).min(2),

  // Notification endpoints
  sendNotification: Joi.object({
    userId: schemas.objectId.required(),
    type: Joi.string().required().valid('info', 'warning', 'error', 'success'),
    title: schemas.text.max(100).required(),
    message: schemas.text.max(1000).required(),
    channels: Joi.array().items(Joi.string().valid('email', 'push', 'sms', 'in_app')).optional(),
    metadata: Joi.object().max(10).optional()
  })
};

/**
 * Advanced security validation functions
 */
const securityValidation = {
  /**
   * Detect SQL injection patterns
   */
  detectSQLInjection: (input) => {
    const sqlPatterns = [
      /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
      /(exec(\s|\+)+(s|x)p\w+)/i,
      /(union(\s|\+)+(all|select|distinct))/i,
      /(insert(\s|\+)into)/i,
      /(delete(\s|\+)from)/i,
      /(update(\s|\+)\w+(\s|\+)set)/i,
      /(create(\s|+)(table|database))/i,
      /(drop(\s|+)(table|database))/i,
      /(select(\s|+)(\*|\w+)(\s|+)from)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Detect XSS patterns
   */
  detectXSS: (input) => {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*javascript:/gi,
      /<\s*script/gi,
      /expression\s*\(/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Detect command injection patterns
   */
  detectCommandInjection: (input) => {
    const cmdPatterns = [
      /;\s*(rm|del|format|fdisk|mkfs)/i,
      /[|&;`$(){}[\]]/,
      /\$\(/,
      /`[^`]*`/,
      /\${[^}]*}/,
      />>/g,
      /<</g,
      /&&/g,
      /\|\|/g
    ];

    return cmdPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Detect path traversal patterns
   */
  detectPathTraversal: (input) => {
    const pathPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /%2e%2e\//i,
      /%2e%2e\\/i,
      /\.\.\//,
      /\.\.\\/
    ];

    return pathPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Detect LDAP injection patterns
   */
  detectLDAPInjection: (input) => {
    const ldapPatterns = [
      /[\*\(\)\\&\|!<>\=]/,
      /\(\(/,
      /\)\)/,
      /\*\*/,
      /\)/,
      /\(/,
      /\\/,
      /\|/,
      /&/,
      /!/,
      /</,
      />/,
      /=/
    ];

    return ldapPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Detect NoSQL injection patterns
   */
  detectNoSQLInjection: (input) => {
    const nosqlPatterns = [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$in/i,
      /\$nin/i,
      /\$regex/i,
      /\$exists/i,
      /\$or/i,
      /\$and/i,
      /\$not/i,
      /\{\s*\$\w+/,
      /\$\w+\s*:/,
      /\(/,
      /\)/,
      /;/,
      /\"/,
      /\'/
    ];

    return nosqlPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Comprehensive security validation
   */
  validateSecurity: (input) => {
    if (typeof input !== 'string') return false;

    const threats = {
      sql: securityValidation.detectSQLInjection(input),
      xss: securityValidation.detectXSS(input),
      command: securityValidation.detectCommandInjection(input),
      pathTraversal: securityValidation.detectPathTraversal(input),
      ldap: securityValidation.detectLDAPInjection(input),
      nosql: securityValidation.detectNoSQLInjection(input)
    };

    const hasThreats = Object.values(threats).some(detected => detected);

    return {
      safe: !hasThreats,
      threats: Object.keys(threats).filter(key => threats[key])
    };
  }
};

/**
 * Enhanced validation middleware with security checks
 */
const validateWithSecurity = (schemaName, source = 'body') => {
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

    // Perform security validation on all string inputs
    const securityCheck = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          const validation = securityValidation.validateSecurity(value);
          if (!validation.safe) {
            return {
              malicious: true,
              field: path ? `${path}.${key}` : key,
              threats: validation.threats
            };
          }
        } else if (typeof value === 'object' && value !== null) {
          const result = securityCheck(value, path ? `${path}.${key}` : key);
          if (result.malicious) return result;
        }
      }
      return { malicious: false };
    };

    const securityResult = securityCheck(data);
    if (securityResult.malicious) {
      return res.status(400).json({
        success: false,
        error: 'Security Violation',
        message: `Malicious input detected in field: ${securityResult.field}`,
        threats: securityResult.threats
      });
    }

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
          message: detail.message,
          code: detail.code
        }))
      });
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Rate limiting validation middleware
 */
const validateRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // 100 requests per window
    message = 'Too many requests, please try again later'
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old requests
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart);
      requests.set(key, userRequests);
    } else {
      requests.set(key, []);
    }

    // Check current request count
    const userRequests = requests.get(key);
    if (userRequests.length >= max) {
      return res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(key, userRequests);

    next();
  };
};

/**
 * Content-Type validation middleware
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    const contentType = req.get('Content-Type');

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          success: false,
          error: 'Unsupported Media Type',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
          received: contentType
        });
      }
    }

    next();
  };
};

/**
 * Request size validation middleware
 */
const validateRequestSize = (maxSize = 10 * 1024 * 1024) => { // 10MB default
  return (req, res, next) => {
    const contentLength = req.get('Content-Length');

    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        success: false,
        error: 'Payload Too Large',
        message: `Request body too large. Maximum size is ${maxSize / 1024 / 1024}MB`
      });
    }

    next();
  };
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

    // Perform security validation first
    const securityResult = securityCheck(req.body);
    if (securityResult.malicious) {
      return res.status(400).json({
        success: false,
        error: 'Security Violation',
        message: `Malicious input detected in field: ${securityResult.field}`,
        threats: securityResult.threats
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
          message: detail.message,
          code: detail.code
        }))
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Helper function for security checking
 */
const securityCheck = (obj, path = '') => {
  for (const [key, value] of Object.entries(obj || {})) {
    if (typeof value === 'string') {
      const validation = securityValidation.validateSecurity(value);
      if (!validation.safe) {
        return {
          malicious: true,
          field: path ? `${path}.${key}` : key,
          threats: validation.threats
        };
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = securityCheck(value, path ? `${path}.${key}` : key);
      if (result.malicious) return result;
    }
  }
  return { malicious: false };
};

module.exports = {
  validateInput,
  validateWithSecurity,
  sanitizeQuery,
  sanitizeParams,
  validateEndpoint,
  validateRateLimit,
  validateContentType,
  validateRequestSize,
  schemas,
  customSchemas,
  securityValidation,
  sanitizeHtml,
  sanitizeText
};
