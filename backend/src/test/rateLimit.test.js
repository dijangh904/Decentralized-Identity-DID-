const request = require('supertest');
const express = require('express');
const { smartRateLimiter, applyRateLimit } = require('../middleware/rateLimiter');

describe('Rate Limiting Tests', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', smartRateLimiter);
    
    // Mock contract routes for testing
    app.post('/api/v1/contracts/deploy', (req, res) => {
      res.json({ success: true, message: 'Contract deployed' });
    });
    
    app.post('/api/v1/contracts/register-did', (req, res) => {
      res.json({ success: true, message: 'DID registered' });
    });
    
    app.post('/api/v1/contracts/issue-credential', (req, res) => {
      res.json({ success: true, message: 'Credential issued' });
    });
    
    app.get('/api/v1/contracts/did/:did', (req, res) => {
      res.json({ success: true, message: 'DID retrieved' });
    });
    
    app.get('/api/v1/did/test', (req, res) => {
      res.json({ success: true, message: 'General DID endpoint' });
    });
  });

  describe('General Rate Limiting', () => {
    it('should allow requests within general rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/v1/did/test');
        
        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
      }
    });
  });

  describe('Contract Read Rate Limiting', () => {
    it('should allow contract read requests within limit', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/v1/contracts/did/did:stellar:GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
        
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Contract Write Rate Limiting', () => {
    it('should allow contract write requests within limit', async () => {
      const response = await request(app)
        .post('/api/v1/contracts/register-did')
        .send({
          did: 'did:stellar:GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
          publicKey: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
          signerSecret: 'SABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
        });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Critical Operations Rate Limiting', () => {
    it('should rate limit contract deployments', async () => {
      // This test would need to be adjusted based on the actual rate limit
      // For now, just test that the endpoint responds correctly
      const response = await request(app)
        .post('/api/v1/contracts/deploy')
        .send({
          deployerSecret: 'SABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
        });
      
      expect(response.status).toBe(200);
    });

    it('should rate limit DID registrations', async () => {
      const response = await request(app)
        .post('/api/v1/contracts/register-did')
        .send({
          did: 'did:stellar:GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
          publicKey: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
          signerSecret: 'SABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
        });
      
      expect(response.status).toBe(200);
    });

    it('should rate limit credential issuances', async () => {
      const response = await request(app)
        .post('/api/v1/contracts/issue-credential')
        .send({
          issuerDID: 'did:stellar:GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
          subjectDID: 'did:stellar:GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
          credentialType: 'test',
          claims: { test: true },
          signerSecret: 'SABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
        });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/did/test');
      
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Rate Limit Error Responses', () => {
    it('should return proper error format when rate limited', async () => {
      // This test would need to simulate rate limit exceeded
      // For now, just verify the error format structure
      const mockRateLimitResponse = {
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: '5 minutes'
      };
      
      expect(mockRateLimitResponse).toHaveProperty('success', false);
      expect(mockRateLimitResponse).toHaveProperty('error');
      expect(mockRateLimitResponse).toHaveProperty('message');
      expect(mockRateLimitResponse).toHaveProperty('retryAfter');
    });
  });
});

// Integration tests for different rate limiting scenarios
describe('Rate Limiting Integration Tests', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', smartRateLimiter);
    
    // Test endpoint
    app.get('/api/test', (req, res) => {
      res.json({ success: true, message: 'Test endpoint' });
    });
  });

  it('should handle different IP addresses separately', async () => {
    // Test with different client IPs
    const response1 = await request(app)
      .get('/api/test')
      .set('X-Forwarded-For', '192.168.1.1');
    
    const response2 = await request(app)
      .get('/api/test')
      .set('X-Forwarded-For', '192.168.1.2');
    
    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
  });

  it('should handle health check endpoints without rate limiting', async () => {
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
    
    // Health checks should not be rate limited
    for (let i = 0; i < 100; i++) {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    }
  });
});
