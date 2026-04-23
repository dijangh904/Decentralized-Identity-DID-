const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../../server');
const { logger } = require('../../middleware');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

// Test utilities
const TestUtils = require('../utils/testUtils');
const TestData = require('../utils/testData');

describe('API Comprehensive Test Suite', function() {
  this.timeout(30000); // 30 second timeout for API tests

  let server;
  let testUser;
  let authToken;
  let redis;
  let testDb;

  before(async function() {
    // Setup test environment
    await TestUtils.setupTestEnvironment();
    
    // Start test server
    server = app.listen(0);
    
    // Setup test database
    testDb = await TestUtils.setupTestDatabase();
    
    // Setup test Redis
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      db: 15 // Use separate DB for tests
    });
    
    // Create test user and get auth token
    testUser = await TestUtils.createTestUser();
    authToken = TestUtils.generateAuthToken(testUser);
    
    logger.info('API test suite setup completed');
  });

  after(async function() {
    // Cleanup test environment
    if (server) {
      server.close();
    }
    
    await TestUtils.cleanupTestDatabase(testDb);
    await redis.flushdb();
    redis.disconnect();
    
    await TestUtils.cleanupTestEnvironment();
    
    logger.info('API test suite cleanup completed');
  });

  beforeEach(async function() {
    // Clear test data before each test
    await redis.flushdb();
    await TestUtils.clearTestData(testDb);
  });

  describe('Authentication & Authorization', function() {
    
    it('should reject requests without authentication', async function() {
      const response = await request(app)
        .get('/api/v1/did')
        .expect(401);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error.code).to.equal('UNAUTHORIZED');
    });

    it('should reject requests with invalid token', async function() {
      const response = await request(app)
        .get('/api/v1/did')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error.code).to.equal('UNAUTHORIZED');
    });

    it('should accept requests with valid token', async function() {
      const response = await request(app)
        .get('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).to.have.property('success', true);
    });

    it('should handle token expiration', async function() {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      
      const response = await request(app)
        .get('/api/v1/did')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
      
      expect(response.body.error.code).to.equal('UNAUTHORIZED');
    });
  });

  describe('DID API Endpoints', function() {
    
    describe('POST /api/v1/did', function() {
      
      it('should create a new DID with valid data', async function() {
        const didData = TestData.validDID();
        
        const response = await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData)
          .expect(201);
        
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data.did).to.equal(didData.did);
        expect(response.body.data.owner).to.equal(testUser.walletAddress);
        
        // Verify DID was created
        const verifyResponse = await request(app)
          .get(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(verifyResponse.body.data.did).to.equal(didData.did);
      });

      it('should reject DID creation with duplicate DID', async function() {
        const didData = TestData.validDID();
        
        // Create first DID
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData)
          .expect(201);
        
        // Try to create duplicate
        const response = await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData)
          .expect(409);
        
        expect(response.body.error.code).to.equal('CONFLICT');
        expect(response.body.error.message).to.include('already exists');
      });

      it('should reject DID creation with invalid data', async function() {
        const invalidData = {
          did: 'invalid-did-format',
          publicKey: 'invalid-key'
        };
        
        const response = await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);
        
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should handle DID creation with verification methods', async function() {
        const didData = TestData.validDIDWithVerificationMethods();
        
        const response = await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData)
          .expect(201);
        
        expect(response.body.data.verificationMethods).to.be.an('array');
        expect(response.body.data.verificationMethods).to.have.length(2);
      });
    });

    describe('GET /api/v1/did/:did', function() {
      
      it('should retrieve existing DID', async function() {
        const didData = TestData.validDID();
        
        // Create DID first
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData);
        
        // Retrieve DID
        const response = await request(app)
          .get(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.property('did', didData.did);
        expect(response.body.data).to.have.property('publicKey', didData.publicKey);
        expect(response.body.data).to.have.property('active', true);
      });

      it('should return 404 for non-existent DID', async function() {
        const response = await request(app)
          .get('/api/v1/did/did:stellar:NONEXISTENT')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
        
        expect(response.body.error.code).to.equal('NOT_FOUND');
      });

      it('should handle malformed DID parameter', async function() {
        const response = await request(app)
          .get('/api/v1/did/')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('PUT /api/v1/did/:did', function() {
      
      it('should update existing DID owned by user', async function() {
        const didData = TestData.validDID();
        
        // Create DID first
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData);
        
        // Update DID
        const updateData = {
          publicKey: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
          serviceEndpoint: 'https://updated.example.com'
        };
        
        const response = await request(app)
          .put(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);
        
        expect(response.body.data.publicKey).to.equal(updateData.publicKey);
        expect(response.body.data.serviceEndpoint).to.equal(updateData.serviceEndpoint);
        expect(response.body.data.updated).to.not.equal(response.body.data.created);
      });

      it('should reject update of DID not owned by user', async function() {
        const otherUser = await TestUtils.createTestUser();
        const otherToken = TestUtils.generateAuthToken(otherUser);
        
        const didData = TestData.validDID();
        
        // Create DID with other user
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${otherToken}`)
          .send(didData);
        
        // Try to update with test user
        const updateData = { publicKey: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890' };
        
        const response = await request(app)
          .put(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(403);
        
        expect(response.body.error.code).to.equal('FORBIDDEN');
      });

      it('should reject update with invalid data', async function() {
        const didData = TestData.validDID();
        
        // Create DID first
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData);
        
        // Try invalid update
        const invalidUpdate = { publicKey: 'invalid-key' };
        
        const response = await request(app)
          .put(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdate)
          .expect(400);
        
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });

    describe('DELETE /api/v1/did/:did', function() {
      
      it('should deactivate DID owned by user', async function() {
        const didData = TestData.validDID();
        
        // Create DID first
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData);
        
        // Deactivate DID
        const response = await request(app)
          .delete(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data.active).to.be.false;
        
        // Verify deactivation
        const verifyResponse = await request(app)
          .get(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(verifyResponse.body.data.active).to.be.false;
      });

      it('should reject deactivation of DID not owned by user', async function() {
        const otherUser = await TestUtils.createTestUser();
        const otherToken = TestUtils.generateAuthToken(otherUser);
        
        const didData = TestData.validDID();
        
        // Create DID with other user
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${otherToken}`)
          .send(didData);
        
        // Try to deactivate with test user
        const response = await request(app)
          .delete(`/api/v1/did/${didData.did}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
        
        expect(response.body.error.code).to.equal('FORBIDDEN');
      });
    });

    describe('GET /api/v1/did', function() {
      
      it('should list DIDs with pagination', async function() {
        // Create multiple DIDs
        for (let i = 0; i < 5; i++) {
          const didData = TestData.validDID();
          didData.did = `did:stellar:GABC${i.toString().padStart(54, '0')}`;
          
          await request(app)
            .post('/api/v1/did')
            .set('Authorization', `Bearer ${authToken}`)
            .send(didData);
        }
        
        // List DIDs
        const response = await request(app)
          .get('/api/v1/did?limit=3&offset=0')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length(3);
        expect(response.body.meta).to.have.property('total');
        expect(response.body.meta).to.have.property('limit', 3);
        expect(response.body.meta).to.have.property('offset', 0);
      });

      it('should filter DIDs by owner', async function() {
        const otherUser = await TestUtils.createTestUser();
        const otherToken = TestUtils.generateAuthToken(otherUser);
        
        // Create DID with test user
        const didData1 = TestData.validDID();
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData1);
        
        // Create DID with other user
        const didData2 = TestData.validDID();
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${otherToken}`)
          .send(didData2);
        
        // Filter by test user
        const response = await request(app)
          .get(`/api/v1/did?owner=${testUser.walletAddress}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.length(1);
        expect(response.body.data[0].owner).to.equal(testUser.walletAddress);
      });

      it('should filter DIDs by active status', async function() {
        // Create active DID
        const activeDID = TestData.validDID();
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(activeDID);
        
        // Create and deactivate DID
        const inactiveDID = TestData.validDID();
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(inactiveDID);
        
        await request(app)
          .delete(`/api/v1/did/${inactiveDID.did}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        // Filter active DIDs
        const response = await request(app)
          .get('/api/v1/did?active=true')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.length(1);
        expect(response.body.data[0].active).to.be.true;
      });
    });

    describe('GET /api/v1/did/search', function() {
      
      it('should search DIDs by query', async function() {
        // Create DID with searchable content
        const didData = TestData.validDID();
        didData.serviceEndpoint = 'https://university.example.com';
        
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData);
        
        // Search
        const response = await request(app)
          .get('/api/v1/did/search?q=university')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length(1);
        expect(response.body.data[0].serviceEndpoint).to.include('university');
      });

      it('should return empty results for non-matching query', async function() {
        const response = await request(app)
          .get('/api/v1/did/search?q=nonexistent')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length(0);
      });
    });
  });

  describe('Credential API Endpoints', function() {
    
    describe('POST /api/v1/credentials', function() {
      
      it('should issue a new credential with valid data', async function() {
        const credentialData = TestData.validCredential();
        
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData)
          .expect(201);
        
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data.issuer).to.equal(credentialData.issuer);
        expect(response.body.data.subject).to.equal(credentialData.subject);
        expect(response.body.data.revoked).to.be.false;
      });

      it('should reject credential issuance with invalid data', async function() {
        const invalidData = {
          issuer: 'invalid-issuer',
          subject: '',
          credentialType: '',
          claims: null
        };
        
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);
        
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should handle credential with expiration date', async function() {
        const credentialData = TestData.validCredential();
        credentialData.expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData)
          .expect(201);
        
        expect(response.body.data).to.have.property('expires');
        expect(new Date(response.body.data.expires)).to.be.a('date');
      });
    });

    describe('GET /api/v1/credentials/:id', function() {
      
      it('should retrieve existing credential', async function() {
        const credentialData = TestData.validCredential();
        
        // Create credential first
        const createResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData)
          .expect(201);
        
        // Retrieve credential
        const response = await request(app)
          .get(`/api/v1/credentials/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data.id).to.equal(createResponse.body.data.id);
        expect(response.body.data.issuer).to.equal(credentialData.issuer);
        expect(response.body.data.subject).to.equal(credentialData.subject);
      });

      it('should return 404 for non-existent credential', async function() {
        const response = await request(app)
          .get('/api/v1/credentials/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
        
        expect(response.body.error.code).to.equal('NOT_FOUND');
      });
    });

    describe('DELETE /api/v1/credentials/:id', function() {
      
      it('should revoke existing credential', async function() {
        const credentialData = TestData.validCredential();
        
        // Create credential first
        const createResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData);
        
        // Revoke credential
        const response = await request(app)
          .delete(`/api/v1/credentials/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data.revoked).to.be.true;
        expect(response.body.data).to.have.property('revokedAt');
        
        // Verify revocation
        const verifyResponse = await request(app)
          .get(`/api/v1/credentials/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(verifyResponse.body.data.revoked).to.be.true;
      });

      it('should reject revocation of already revoked credential', async function() {
        const credentialData = TestData.validCredential();
        
        // Create credential
        const createResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData);
        
        // Revoke credential
        await request(app)
          .delete(`/api/v1/credentials/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        // Try to revoke again
        const response = await request(app)
          .delete(`/api/v1/credentials/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
        
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('already revoked');
      });
    });

    describe('GET /api/v1/credentials', function() {
      
      it('should list credentials with pagination', async function() {
        // Create multiple credentials
        for (let i = 0; i < 5; i++) {
          const credentialData = TestData.validCredential();
          credentialData.issuer = `did:stellar:GABC${i.toString().padStart(54, '0')}`;
          
          await request(app)
            .post('/api/v1/credentials')
            .set('Authorization', `Bearer ${authToken}`)
            .send(credentialData);
        }
        
        // List credentials
        const response = await request(app)
          .get('/api/v1/credentials?limit=3&offset=0')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length(3);
        expect(response.body.meta).to.have.property('total');
        expect(response.body.meta).to.have.property('limit', 3);
        expect(response.body.meta).to.have.property('offset', 0);
      });

      it('should filter credentials by issuer', async function() {
        const credentialData1 = TestData.validCredential();
        credentialData1.issuer = 'did:stellar:GABC111111111111111111111111111111111111111';
        
        const credentialData2 = TestData.validCredential();
        credentialData2.issuer = 'did:stellar:GDEF222222222222222222222222222222222222222';
        
        // Create credentials
        await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData1);
        
        await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData2);
        
        // Filter by issuer
        const response = await request(app)
          .get(`/api/v1/credentials?issuer=${credentialData1.issuer}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.length(1);
        expect(response.body.data[0].issuer).to.equal(credentialData1.issuer);
      });

      it('should filter credentials by revoked status', async function() {
        // Create active credential
        const activeCredential = TestData.validCredential();
        const activeResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(activeCredential);
        
        // Create and revoke credential
        const revokedCredential = TestData.validCredential();
        const revokedResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(revokedCredential);
        
        await request(app)
          .delete(`/api/v1/credentials/${revokedResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        // Filter active credentials
        const response = await request(app)
          .get('/api/v1/credentials?revoked=false')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.length(1);
        expect(response.body.data[0].revoked).to.be.false;
      });
    });

    describe('POST /api/v1/credentials/:id/verify', function() {
      
      it('should verify valid credential', async function() {
        const credentialData = TestData.validCredential();
        
        // Create credential
        const createResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData);
        
        // Verify credential
        const response = await request(app)
          .post(`/api/v1/credentials/${createResponse.body.data.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ credential: createResponse.body.data })
          .expect(200);
        
        expect(response.body.data).to.have.property('valid', true);
        expect(response.body.data).to.have.property('verifiedAt');
      });

      it('should reject verification of revoked credential', async function() {
        const credentialData = TestData.validCredential();
        
        // Create and revoke credential
        const createResponse = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData);
        
        await request(app)
          .delete(`/api/v1/credentials/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        // Try to verify
        const response = await request(app)
          .post(`/api/v1/credentials/${createResponse.body.data.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ credential: createResponse.body.data })
          .expect(200);
        
        expect(response.body.data).to.have.property('valid', false);
        expect(response.body.data.reason).to.include('revoked');
      });
    });
  });

  describe('Stellar API Endpoints', function() {
    
    describe('GET /api/v1/stellar/account/:address', function() {
      
      it('should retrieve Stellar account information', async function() {
        const testAddress = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890';
        
        // Mock Stellar API response
        TestUtils.mockStellarAccount(testAddress);
        
        const response = await request(app)
          .get(`/api/v1/stellar/account/${testAddress}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.property('address', testAddress);
        expect(response.body.data).to.have.property('balance');
        expect(response.body.data).to.have.property('sequence');
      });

      it('should handle invalid Stellar address', async function() {
        const response = await request(app)
          .get('/api/v1/stellar/account/invalid-address')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
        
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should handle non-existent Stellar account', async function() {
        const nonExistentAddress = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890';
        
        // Mock non-existent account
        TestUtils.mockStellarAccountNotFound(nonExistentAddress);
        
        const response = await request(app)
          .get(`/api/v1/stellar/account/${nonExistentAddress}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
        
        expect(response.body.error.code).to.equal('NOT_FOUND');
      });
    });

    describe('GET /api/v1/stellar/transactions', function() {
      
      it('should list transactions for account', async function() {
        const testAddress = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890';
        
        // Mock transactions
        TestUtils.mockStellarTransactions(testAddress);
        
        const response = await request(app)
          .get(`/api/v1/stellar/transactions?account=${testAddress}&limit=5`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length.at.most(5);
      });

      it('should filter transactions by status', async function() {
        const testAddress = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890';
        
        // Mock transactions
        TestUtils.mockStellarTransactions(testAddress);
        
        const response = await request(app)
          .get(`/api/v1/stellar/transactions?account=${testAddress}&status=success`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.be.an('array');
        // All transactions should have status 'success'
        response.body.data.forEach(tx => {
          expect(tx.status).to.equal('success');
        });
      });
    });

    describe('POST /api/v1/stellar/transaction', function() {
      
      it('should create new transaction', async function() {
        const transactionData = TestData.validStellarTransaction();
        
        // Mock Stellar submission
        TestUtils.mockStellarTransactionSubmission();
        
        const response = await request(app)
          .post('/api/v1/stellar/transaction')
          .set('Authorization', `Bearer ${authToken}`)
          .send(transactionData)
          .expect(201);
        
        expect(response.body.data).to.have.property('id');
        expect(response.body.data).to.have.property('status', 'pending');
        expect(response.body.data).to.have.property('xdr');
      });

      it('should reject transaction with invalid data', async function() {
        const invalidData = {
          sourceAccount: 'invalid-address',
          operations: []
        };
        
        const response = await request(app)
          .post('/api/v1/stellar/transaction')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);
        
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });
  });

  describe('Contract API Endpoints', function() {
    
    describe('GET /api/v1/contracts/info', function() {
      
      it('should return contract information', async function() {
        // Mock contract info
        TestUtils.mockContractInfo();
        
        const response = await request(app)
          .get('/api/v1/contracts/info')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.property('version');
        expect(response.body.data).to.have.property('network');
        expect(response.body.data).to.have.property('address');
      });
    });

    describe('POST /api/v1/contracts/deploy', function() {
      
      it('should deploy new contract', async function() {
        const deployData = {
          deployerSecret: process.env.TEST_DEPLOYER_SECRET || 'SA...'
        };
        
        // Mock contract deployment
        TestUtils.mockContractDeployment();
        
        const response = await request(app)
          .post('/api/v1/contracts/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployData)
          .expect(201);
        
        expect(response.body.data).to.have.property('address');
        expect(response.body.data).to.have.property('transactionHash');
      });
    });

    describe('GET /api/v1/contracts/data/:key', function() {
      
      it('should retrieve contract data', async function() {
        const testKey = 'test_key';
        
        // Mock contract data
        TestUtils.mockContractData(testKey);
        
        const response = await request(app)
          .get(`/api/v1/contracts/data/${testKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.data).to.have.property('key', testKey);
        expect(response.body.data).to.have.property('value');
      });
    });
  });

  describe('Error Handling', function() {
    
    it('should handle malformed JSON requests', async function() {
      const response = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should handle missing required fields', async function() {
      const response = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
      
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      expect(response.body.error.message).to.include('required');
    });

    it('should handle rate limiting', async function() {
      // Make multiple rapid requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 105; i++) { // Assuming rate limit is 100 per 15 minutes
        promises.push(
          request(app)
            .get('/api/v1/did')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses).to.have.length.greaterThan(0);
      expect(rateLimitedResponses[0].body.error.code).to.equal('RATE_LIMIT_EXCEEDED');
    });

    it('should handle server errors gracefully', async function() {
      // Mock a server error
      TestUtils.mockServerError('/api/v1/did', 'GET');
      
      const response = await request(app)
        .get('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
      
      expect(response.body.error.code).to.equal('INTERNAL_ERROR');
    });
  });

  describe('Performance Tests', function() {
    
    it('should handle concurrent requests', async function() {
      const concurrentRequests = 50;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/v1/did')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200);
      });
      
      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(endTime - startTime).to.be.lessThan(5000);
    });

    it('should maintain response times under load', async function() {
      const responseTimes = [];
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }
      
      // Average response time should be under 500ms
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(avgResponseTime).to.be.lessThan(500);
      
      // 95th percentile should be under 1000ms
      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(responseTimes.length * 0.95);
      expect(responseTimes[p95Index]).to.be.lessThan(1000);
    });
  });

  describe('Security Tests', function() {
    
    it('should prevent SQL injection attempts', async function() {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .get(`/api/v1/did?owner=${maliciousInput}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
      
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should prevent XSS attempts', async function() {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          did: `did:stellar:${xssPayload}`,
          publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890'
        })
        .expect(400);
      
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should sanitize output data', async function() {
      // Create DID with potentially malicious data
      const didData = TestData.validDID();
      didData.serviceEndpoint = 'https://example.com<script>alert("xss")</script>';
      
      const createResponse = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .send(didData)
        .expect(201);
      
      // Verify data is sanitized in response
      expect(createResponse.body.data.serviceEndpoint).to.not.include('<script>');
    });

    it('should enforce CORS headers', async function() {
      const response = await request(app)
        .options('/api/v1/did')
        .expect(200);
      
      expect(response.headers).to.have.property('access-control-allow-origin');
      expect(response.headers).to.have.property('access-control-allow-methods');
    });
  });

  describe('Integration Tests', function() {
    
    it('should handle complete DID lifecycle', async function() {
      // Create DID
      const didData = TestData.validDID();
      const createResponse = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .send(didData)
        .expect(201);
      
      const did = createResponse.body.data.did;
      
      // Retrieve DID
      const getResponse = await request(app)
        .get(`/api/v1/did/${did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(getResponse.body.data.did).to.equal(did);
      
      // Update DID
      const updateData = { serviceEndpoint: 'https://updated.example.com' };
      const updateResponse = await request(app)
        .put(`/api/v1/did/${did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);
      
      expect(updateResponse.body.data.serviceEndpoint).to.equal(updateData.serviceEndpoint);
      
      // Issue credential for DID
      const credentialData = TestData.validCredential();
      credentialData.subject = did;
      
      const credentialResponse = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send(credentialData)
        .expect(201);
      
      // Verify credential
      const verifyResponse = await request(app)
        .post(`/api/v1/credentials/${credentialResponse.body.data.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ credential: credentialResponse.body.data })
        .expect(200);
      
      expect(verifyResponse.body.data.valid).to.be.true;
      
      // Revoke credential
      await request(app)
        .delete(`/api/v1/credentials/${credentialResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Deactivate DID
      await request(app)
        .delete(`/api/v1/did/${did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Verify final state
      const finalDIDResponse = await request(app)
        .get(`/api/v1/did/${did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(finalDIDResponse.body.data.active).to.be.false;
      
      const finalCredentialResponse = await request(app)
        .get(`/api/v1/credentials/${credentialResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(finalCredentialResponse.body.data.revoked).to.be.true;
    });

    it('should handle batch operations', async function() {
      // Create multiple DIDs
      const dids = [];
      for (let i = 0; i < 3; i++) {
        const didData = TestData.validDID();
        didData.did = `did:stellar:GABC${i.toString().padStart(54, '0')}`;
        
        const response = await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(didData)
          .expect(201);
        
        dids.push(response.body.data);
      }
      
      // List all DIDs
      const listResponse = await request(app)
        .get('/api/v1/did?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(listResponse.body.data).to.have.length.at.least(3);
      
      // Create credentials for all DIDs
      const credentials = [];
      for (const did of dids) {
        const credentialData = TestData.validCredential();
        credentialData.subject = did.did;
        
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credentialData)
          .expect(201);
        
        credentials.push(response.body.data);
      }
      
      // Verify all credentials
      const verificationPromises = credentials.map(credential =>
        request(app)
          .post(`/api/v1/credentials/${credential.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ credential })
          .expect(200)
      );
      
      const verificationResults = await Promise.all(verificationPromises);
      
      verificationResults.forEach(result => {
        expect(result.body.data.valid).to.be.true;
      });
    });
  });
});
