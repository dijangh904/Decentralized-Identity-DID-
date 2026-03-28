/**
 * Input Validation Middleware Tests
 * Test suite for server-side input validation
 */

const request = require('supertest');
const express = require('express');
const { 
  validateInput, 
  sanitizeQuery, 
  sanitizeParams, 
  validateEndpoint,
  sanitizeHtml,
  sanitizeText
} = require('../middleware/inputValidation');

describe('Input Validation Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('sanitizeQuery', () => {
    test('should sanitize query parameters', async () => {
      app.get('/test', sanitizeQuery, (req, res) => {
        res.json({ query: req.query });
      });

      const response = await request(app)
        .get('/test?param=<script>alert("xss")</script>&safe=test');

      expect(response.status).toBe(200);
      expect(response.body.query.param).not.toContain('<script>');
      expect(response.body.query.safe).toBe('test');
    });

    test('should handle empty query', async () => {
      app.get('/test', sanitizeQuery, (req, res) => {
        res.json({ query: req.query });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.query).toEqual({});
    });
  });

  describe('sanitizeParams', () => {
    test('should sanitize URL parameters', async () => {
      app.get('/test/:param', sanitizeParams, (req, res) => {
        res.json({ params: req.params });
      });

      const response = await request(app)
        .get('/test/<script>alert("xss")</script>');

      expect(response.status).toBe(200);
      expect(response.body.params.param).not.toContain('<script>');
    });
  });

  describe('validateInput', () => {
    test('should validate DID input', async () => {
      app.post('/test-did', validateInput('did', 'body'), (req, res) => {
        res.json({ did: req.body.did });
      });

      // Valid DID
      const validResponse = await request(app)
        .post('/test-did')
        .send({ did: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789' });

      expect(validResponse.status).toBe(200);
      expect(validResponse.body.did).toBe('did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789');

      // Invalid DID
      const invalidResponse = await request(app)
        .post('/test-did')
        .send({ did: 'invalid-did' });

      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.error).toBe('Validation error');
    });

    test('should validate public key input', async () => {
      app.post('/test-key', validateInput('publicKey', 'body'), (req, res) => {
        res.json({ publicKey: req.body.publicKey });
      });

      // Valid public key
      const validResponse = await request(app)
        .post('/test-key')
        .send({ publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789' });

      expect(validResponse.status).toBe(200);

      // Invalid public key
      const invalidResponse = await request(app)
        .post('/test-key')
        .send({ publicKey: 'invalid-key' });

      expect(invalidResponse.status).toBe(400);
    });

    test('should validate URL input', async () => {
      app.post('/test-url', validateInput('url', 'body'), (req, res) => {
        res.json({ url: req.body.url });
      });

      // Valid URL
      const validResponse = await request(app)
        .post('/test-url')
        .send({ url: 'https://example.com' });

      expect(validResponse.status).toBe(200);

      // Invalid URL (javascript protocol)
      const invalidResponse = await request(app)
        .post('/test-url')
        .send({ url: 'javascript:alert("xss")' });

      expect(invalidResponse.status).toBe(400);
    });
  });

  describe('validateEndpoint', () => {
    test('should validate register DID endpoint', async () => {
      app.post('/register-did', validateEndpoint('registerDID'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const validPayload = {
        did: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        serviceEndpoint: 'https://example.com',
        signerSecret: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789'
      };

      const response = await request(app)
        .post('/register-did')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid register DID payload', async () => {
      app.post('/register-did', validateEndpoint('registerDID'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const invalidPayload = {
        did: 'invalid-did',
        publicKey: 'invalid-key',
        serviceEndpoint: 'javascript:alert("xss")',
        signerSecret: 'invalid-secret'
      };

      const response = await request(app)
        .post('/register-did')
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should validate issue credential endpoint', async () => {
      app.post('/issue-credential', validateEndpoint('issueCredential'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const validPayload = {
        issuerDID: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        subjectDID: 'did:stellar:GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        credentialType: 'test-credential',
        claims: {
          name: 'John Doe',
          age: 30
        },
        signerSecret: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789'
      };

      const response = await request(app)
        .post('/issue-credential')
        .send(validPayload);

      expect(response.status).toBe(200);
    });

    test('should sanitize claims in issue credential', async () => {
      app.post('/issue-credential', validateEndpoint('issueCredential'), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const payloadWithXSS = {
        issuerDID: 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        subjectDID: 'did:stellar:GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        credentialType: 'test-credential',
        claims: {
          name: '<script>alert("xss")</script>John Doe',
          description: 'Safe description'
        },
        signerSecret: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789'
      };

      const response = await request(app)
        .post('/issue-credential')
        .send(payloadWithXSS);

      expect(response.status).toBe(200);
      expect(response.body.data.claims.name).not.toContain('<script>');
    });
  });
});

describe('Sanitization Functions', () => {
  describe('sanitizeHtml', () => {
    test('should remove dangerous HTML tags', () => {
      const input = '<script>alert("xss")</script><div>Safe content</div>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('<div>Safe content</div>');
    });

    test('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(\'xss\')" class="safe">Content</div>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('onclick');
      expect(result).toContain('class="safe"');
    });

    test('should remove dangerous protocols', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('javascript:');
    });

    test('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
    });
  });

  describe('sanitizeText', () => {
    test('should remove HTML brackets', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeText(input);
      
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('should remove dangerous protocols', () => {
      const input = 'javascript:alert("xss") data:text/html,<script>alert("xss")</script>';
      const result = sanitizeText(input);
      
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('data:');
      expect(result).not.toContain('vbscript:');
    });

    test('should remove event handlers', () => {
      const input = 'onclick=alert("xss") onload=alert("xss")';
      const result = sanitizeText(input);
      
      expect(result).not.toContain('onclick=');
      expect(result).not.toContain('onload=');
    });

    test('should trim whitespace', () => {
      const input = '  test content  ';
      expect(sanitizeText(input)).toBe('test content');
    });
  });
});

describe('XSS Prevention Integration Tests', () => {
  test('should prevent multiple XSS attack vectors', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      '<div onclick="alert(\'xss\')">Click</div>',
      'javascript:alert("xss")',
      'data:text/html,<script>alert("xss")</script>',
      'vbscript:msgbox("xss")',
      '<svg onload=alert("xss")>',
      '<iframe src="javascript:alert(\'xss\')"></iframe>'
    ];

    xssPayloads.forEach(payload => {
      expect(sanitizeText(payload)).not.toContain('<script>');
      expect(sanitizeText(payload)).not.toContain('javascript:');
      expect(sanitizeText(payload)).not.toContain('data:');
      expect(sanitizeText(payload)).not.toContain('vbscript:');
      expect(sanitizeText(payload)).not.toContain('on');
      
      expect(sanitizeHtml(payload)).not.toContain('<script>');
      expect(sanitizeHtml(payload)).not.toContain('javascript:');
      expect(sanitizeHtml(payload)).not.toContain('onerror');
      expect(sanitizeHtml(payload)).not.toContain('onclick');
    });
  });

  test('should preserve safe content while removing dangerous parts', () => {
    const mixedContent = 'Safe text <script>alert("xss")</script> more safe text https://example.com';
    
    const textResult = sanitizeText(mixedContent);
    expect(textResult).toContain('Safe text');
    expect(textResult).toContain('more safe text');
    expect(textResult).toContain('https://example.com');
    expect(textResult).not.toContain('<script>');
    
    const htmlResult = sanitizeHtml(mixedContent);
    expect(htmlResult).toContain('Safe text');
    expect(htmlResult).toContain('more safe text');
    expect(htmlResult).not.toContain('<script>');
  });
});
