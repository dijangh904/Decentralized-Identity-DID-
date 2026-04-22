const request = require('supertest');
const express = require('express');
const Joi = require('joi');
const {
  validateInput,
  validateWithSecurity,
  validateEndpoint,
  validateRateLimit,
  validateContentType,
  validateRequestSize,
  securityValidation,
  schemas,
  customSchemas
} = require('../middleware/inputValidation');

describe('Comprehensive Input Validation System', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Basic Schema Validation', () => {
    test('should validate DID format correctly', async () => {
      app.post('/test-did', validateInput('did', 'body'), (req, res) => {
        res.json({ success: true, did: req.body.did });
      });

      // Valid DID
      const validResponse = await request(app)
        .post('/test-did')
        .send({ did: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI' })
        .expect(200);

      expect(validResponse.body.success).toBe(true);
      expect(validResponse.body.did).toBe('did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI');

      // Invalid DID format
      const invalidResponse = await request(app)
        .post('/test-did')
        .send({ did: 'invalid-did-format' })
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.error).toBe('Validation error');
    });

    test('should validate Stellar public key', async () => {
      app.post('/test-public-key', validateInput('publicKey', 'body'), (req, res) => {
        res.json({ success: true, publicKey: req.body.publicKey });
      });

      // Valid public key
      await request(app)
        .post('/test-public-key')
        .send({ publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI' })
        .expect(200);

      // Invalid public key
      await request(app)
        .post('/test-public-key')
        .send({ publicKey: 'invalid-key' })
        .expect(400);
    });

    test('should validate email format', async () => {
      app.post('/test-email', validateInput('email', 'body'), (req, res) => {
        res.json({ success: true, email: req.body.email });
      });

      // Valid email
      await request(app)
        .post('/test-email')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Invalid email
      await request(app)
        .post('/test-email')
        .send({ email: 'invalid-email' })
        .expect(400);
    });

    test('should validate password complexity', async () => {
      app.post('/test-password', validateInput('password', 'body'), (req, res) => {
        res.json({ success: true });
      });

      // Valid password
      await request(app)
        .post('/test-password')
        .send({ password: 'SecurePass123!' })
        .expect(200);

      // Invalid password - no special character
      await request(app)
        .post('/test-password')
        .send({ password: 'weakpassword' })
        .expect(400);

      // Invalid password - too short
      await request(app)
        .post('/test-password')
        .send({ password: 'Ab1!' })
        .expect(400);
    });

    test('should validate URL format', async () => {
      app.post('/test-url', validateInput('url', 'body'), (req, res) => {
        res.json({ success: true, url: req.body.url });
      });

      // Valid HTTPS URL
      await request(app)
        .post('/test-url')
        .send({ url: 'https://example.com' })
        .expect(200);

      // Invalid protocol
      await request(app)
        .post('/test-url')
        .send({ url: 'ftp://example.com' })
        .expect(400);

      // Invalid URL format
      await request(app)
        .post('/test-url')
        .send({ url: 'not-a-url' })
        .expect(400);
    });
  });

  describe('Security Validation', () => {
    test('should detect SQL injection attempts', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; INSERT INTO users VALUES('hacker', 'password'); --"
      ];

      maliciousInputs.forEach(input => {
        const result = securityValidation.detectSQLInjection(input);
        expect(result).toBe(true);
      });

      // Clean input should pass
      const cleanInput = "John Doe";
      expect(securityValidation.detectSQLInjection(cleanInput)).toBe(false);
    });

    test('should detect XSS attempts', () => {
      const maliciousInputs = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<iframe src='javascript:alert(\"xss\")'></iframe>"
      ];

      maliciousInputs.forEach(input => {
        const result = securityValidation.detectXSS(input);
        expect(result).toBe(true);
      });

      // Clean input should pass
      const cleanInput = "John Doe";
      expect(securityValidation.detectXSS(cleanInput)).toBe(false);
    });

    test('should detect command injection attempts', () => {
      const maliciousInputs = [
        "; rm -rf /",
        "&& cat /etc/passwd",
        "`whoami`",
        "$(ls -la)"
      ];

      maliciousInputs.forEach(input => {
        const result = securityValidation.detectCommandInjection(input);
        expect(result).toBe(true);
      });

      // Clean input should pass
      const cleanInput = "John Doe";
      expect(securityValidation.detectCommandInjection(cleanInput)).toBe(false);
    });

    test('should detect path traversal attempts', () => {
      const maliciousInputs = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32",
        "%2e%2e%2f%2e%2e%2f",
        "....//....//"
      ];

      maliciousInputs.forEach(input => {
        const result = securityValidation.detectPathTraversal(input);
        expect(result).toBe(true);
      });

      // Clean input should pass
      const cleanInput = "documents/file.txt";
      expect(securityValidation.detectPathTraversal(cleanInput)).toBe(false);
    });

    test('should detect NoSQL injection attempts', () => {
      const maliciousInputs = [
        "{$where: {username: 'admin'}}",
        "{$ne: null}",
        "{$gt: ''}",
        "{$or: [{field: 'value'}, {field2: 'value2'}]}"
      ];

      maliciousInputs.forEach(input => {
        const result = securityValidation.detectNoSQLInjection(input);
        expect(result).toBe(true);
      });

      // Clean input should pass
      const cleanInput = "John Doe";
      expect(securityValidation.detectNoSQLInjection(cleanInput)).toBe(false);
    });

    test('should perform comprehensive security validation', () => {
      const testCases = [
        { input: "'; DROP TABLE users; --", threats: ['sql'] },
        { input: "<script>alert('xss')</script>", threats: ['xss'] },
        { input: "; rm -rf /", threats: ['command'] },
        { input: "../../../etc/passwd", threats: ['pathTraversal'] },
        { input: "{$where: {username: 'admin'}}", threats: ['nosql'] }
      ];

      testCases.forEach(({ input, threats }) => {
        const result = securityValidation.validateSecurity(input);
        expect(result.safe).toBe(false);
        expect(result.threats).toEqual(expect.arrayContaining(threats));
      });

      // Clean input should pass
      const cleanResult = securityValidation.validateSecurity("John Doe");
      expect(cleanResult.safe).toBe(true);
      expect(cleanResult.threats).toEqual([]);
    });
  });

  describe('Endpoint Validation', () => {
    test('should validate QR generation endpoint', async () => {
      app.post('/qr/generate', validateEndpoint('generateQR'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      // Valid DID QR generation
      const validResponse = await request(app)
        .post('/qr/generate')
        .send({
          type: 'did',
          did: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI'
        })
        .expect(200);

      expect(validResponse.body.success).toBe(true);

      // Invalid type
      await request(app)
        .post('/qr/generate')
        .send({
          type: 'invalid',
          did: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI'
        })
        .expect(400);

      // Missing required field for type
      await request(app)
        .post('/qr/generate')
        .send({
          type: 'did'
          // Missing did
        })
        .expect(400);
    });

    test('should validate user registration endpoint', async () => {
      app.post('/auth/register', validateEndpoint('registerUser'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      // Valid registration with password
      await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          username: 'testuser'
        })
        .expect(200);

      // Valid registration with wallet
      await request(app)
        .post('/auth/register')
        .send({
          email: 'wallet@example.com',
          walletAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI'
        })
        .expect(200);

      // Both password and wallet (should fail)
      await request(app)
        .post('/auth/register')
        .send({
          email: 'both@example.com',
          password: 'SecurePass123!',
          walletAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI'
        })
        .expect(400);

      // Neither password nor wallet (should fail)
      await request(app)
        .post('/auth/register')
        .send({
          email: 'neither@example.com'
        })
        .expect(400);
    });

    test('should validate credential issuance endpoint', async () => {
      app.post('/credentials/issue', validateEndpoint('issueCredential'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      // Valid credential issuance
      const validCredential = {
        issuerDID: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI',
        subjectDID: 'did:stellar:GBCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
        credentialType: 'identity-verification',
        claims: {
          name: 'John Doe',
          age: 30,
          verified: true,
          documents: ['passport', 'license']
        },
        signerSecret: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI'
      };

      await request(app)
        .post('/credentials/issue')
        .send(validCredential)
        .expect(200);

      // Invalid claims (too many)
      const tooManyClaims = {};
      for (let i = 0; i < 60; i++) {
        tooManyClaims[`field${i}`] = `value${i}`;
      }

      await request(app)
        .post('/credentials/issue')
        .send({
          ...validCredential,
          claims: tooManyClaims
        })
        .expect(400);
    });
  });

  describe('Security Middleware', () => {
    test('should block requests with malicious content', async () => {
      app.post('/secure-endpoint', validateWithSecurity('text', 'body'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      // Clean input should pass
      await request(app)
        .post('/secure-endpoint')
        .send({ text: 'This is clean text' })
        .expect(200);

      // Malicious input should be blocked
      await request(app)
        .post('/secure-endpoint')
        .send({ text: "<script>alert('xss')</script>" })
        .expect(400);
    });

    test('should validate content-type', async () => {
      app.post('/content-type-test', validateContentType(['application/json']), (req, res) => {
        res.json({ success: true });
      });

      // Valid content-type
      await request(app)
        .post('/content-type-test')
        .set('Content-Type', 'application/json')
        .send({ data: 'test' })
        .expect(200);

      // Invalid content-type
      await request(app)
        .post('/content-type-test')
        .set('Content-Type', 'text/plain')
        .send('plain text')
        .expect(415);
    });

    test('should validate request size', async () => {
      app.post('/size-test', validateRequestSize(100), (req, res) => {
        res.json({ success: true });
      });

      // Small request should pass
      await request(app)
        .post('/size-test')
        .set('Content-Length', '50')
        .send({ data: 'small' })
        .expect(200);

      // Large request should be blocked
      await request(app)
        .post('/size-test')
        .set('Content-Length', '200')
        .send({ data: 'this is too large'.repeat(10) })
        .expect(413);
    });

    test('should enforce rate limiting', async () => {
      const rateLimiter = validateRateLimit({
        windowMs: 1000, // 1 second
        max: 2, // 2 requests per window
        message: 'Rate limit exceeded'
      });

      app.post('/rate-limit-test', rateLimiter, (req, res) => {
        res.json({ success: true });
      });

      // First two requests should pass
      await request(app)
        .post('/rate-limit-test')
        .send({})
        .expect(200);

      await request(app)
        .post('/rate-limit-test')
        .send({})
        .expect(200);

      // Third request should be rate limited
      await request(app)
        .post('/rate-limit-test')
        .send({})
        .expect(429);
    });
  });

  describe('Pagination and Query Validation', () => {
    test('should validate pagination parameters', async () => {
      app.get('/paginated', validateInput('pagination', 'query'), (req, res) => {
        res.json({ success: true, pagination: req.query });
      });

      // Valid pagination
      await request(app)
        .get('/paginated?page=1&limit=10&sort=createdAt&order=desc')
        .expect(200);

      // Invalid page number
      await request(app)
        .get('/paginated?page=0')
        .expect(400);

      // Invalid limit
      await request(app)
        .get('/paginated?limit=0')
        .expect(400);

      // Invalid sort field
      await request(app)
        .get('/paginated?sort=invalid')
        .expect(400);
    });

    test('should validate search queries', async () => {
      app.get('/search', validateInput('searchQuery', 'query'), (req, res) => {
        res.json({ success: true, query: req.query });
      });

      // Valid search query
      await request(app)
        .get('/search?query=test')
        .expect(200);

      // Empty search query
      await request(app)
        .get('/search?query=')
        .expect(400);

      // Search query too long
      await request(app)
        .get('/search?query=' + 'a'.repeat(101))
        .expect(400);
    });
  });

  describe('Complex Validation Scenarios', () => {
    test('should handle nested object validation with security', async () => {
      app.post('/complex', validateEndpoint('updateProfile'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      // Valid nested object
      const validProfile = {
        firstName: 'John',
        lastName: 'Doe',
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            push: false
          }
        }
      };

      await request(app)
        .post('/complex')
        .send(validProfile)
        .expect(200);

      // Invalid nested object with malicious content
      const maliciousProfile = {
        firstName: '<script>alert("xss")</script>',
        preferences: {
          theme: 'dark',
          language: 'en'
        }
      };

      await request(app)
        .post('/complex')
        .send(maliciousProfile)
        .expect(400);
    });

    test('should validate array inputs', async () => {
      app.post('/array-test', (req, res) => {
        // Custom array validation
        const schema = Joi.object({
          items: Joi.array().items(Joi.string().max(50)).max(10).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: error.details
          });
        }

        res.json({ success: true, data: value });
      });

      // Valid array
      await request(app)
        .post('/array-test')
        .send({ items: ['item1', 'item2', 'item3'] })
        .expect(200);

      // Array too long
      await request(app)
        .post('/array-test')
        .send({ items: Array(15).fill('item') })
        .expect(400);

      // Item too long
      await request(app)
        .post('/array-test')
        .send({ items: ['a'.repeat(51)] })
        .expect(400);
    });

    test('should handle conditional validation', async () => {
      app.post('/conditional', validateEndpoint('loginUser'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      // Valid login with password
      await request(app)
        .post('/conditional')
        .send({
          identifier: 'test@example.com',
          password: 'SecurePass123!',
          walletAuth: false
        })
        .expect(200);

      // Valid wallet auth
      await request(app)
        .post('/conditional')
        .send({
          identifier: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI',
          walletAuth: true
        })
        .expect(200);

      // Invalid - wallet auth without wallet address
      await request(app)
        .post('/conditional')
        .send({
          identifier: 'test@example.com',
          walletAuth: true
        })
        .expect(400);
    });
  });

  describe('Error Handling and Response Format', () => {
    test('should return structured error responses', async () => {
      app.post('/error-test', validateEndpoint('registerUser'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/error-test')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0]).toHaveProperty('field');
      expect(response.body.details[0]).toHaveProperty('message');
    });

    test('should handle multiple validation errors', async () => {
      app.post('/multiple-errors', validateEndpoint('registerUser'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/multiple-errors')
        .send({
          email: 'invalid-email',
          password: 'weak',
          username: 'ab' // too short
        })
        .expect(400);

      expect(response.body.details).toHaveLength(3);
      expect(response.body.details.map(d => d.field)).toEqual(
        expect.arrayContaining(['email', 'password', 'username'])
      );
    });
  });
});
