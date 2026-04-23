const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { logger } = require('../../middleware');
const Redis = require('ioredis');

class TestUtils {
  static testRedis = null;
  static testDb = null;

  /**
   * Setup test environment
   */
  static async setupTestEnvironment() {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.REDIS_DB = '15'; // Use separate Redis DB for tests
    
    // Suppress console logs during tests unless explicitly needed
    if (process.env.VERBOSE_TESTS !== 'true') {
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
    }
    
    logger.info('Test environment setup completed');
  }

  /**
   * Cleanup test environment
   */
  static async cleanupTestEnvironment() {
    // Restore environment variables
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    delete process.env.REDIS_DB;
    
    logger.info('Test environment cleanup completed');
  }

  /**
   * Setup test database
   */
  static async setupTestDatabase() {
    try {
      // Connect to test database
      const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/stellar-did-test';
      
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      this.testDb = mongoose.connection;
      
      logger.info('Test database setup completed');
      return this.testDb;
    } catch (error) {
      logger.error('Failed to setup test database:', error);
      throw error;
    }
  }

  /**
   * Cleanup test database
   */
  static async cleanupTestDatabase(db) {
    try {
      if (db) {
        // Get all collections
        const collections = await db.db.listCollections().toArray();
        
        // Drop each collection
        for (const collection of collections) {
          await db.db.collection(collection.name).deleteMany({});
        }
        
        await db.close();
      }
      
      logger.info('Test database cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup test database:', error);
      throw error;
    }
  }

  /**
   * Clear test data
   */
  static async clearTestData(db) {
    try {
      if (!db) return;
      
      const collections = await db.db.listCollections().toArray();
      
      for (const collection of collections) {
        await db.db.collection(collection.name).deleteMany({});
      }
      
      logger.debug('Test data cleared');
    } catch (error) {
      logger.error('Failed to clear test data:', error);
      throw error;
    }
  }

  /**
   * Create test user
   */
  static async createTestUser(userData = {}) {
    const defaultUserData = {
      walletAddress: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
      email: 'test@example.com',
      roles: ['USER'],
      active: true,
      ...userData
    };

    // In a real implementation, this would save to database
    // For testing, we'll create a mock user object
    const user = {
      id: 'test-user-id',
      ...defaultUserData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return user;
  }

  /**
   * Generate authentication token
   */
  static generateAuthToken(user, expiresIn = '1h') {
    const payload = {
      userId: user.id,
      walletAddress: user.walletAddress,
      roles: user.roles || ['USER']
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-jwt-secret', {
      expiresIn,
      issuer: 'stellar-did-platform',
      audience: 'stellar-did-users'
    });
  }

  /**
   * Setup test Redis
   */
  static async setupTestRedis() {
    try {
      this.testRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: 15, // Use separate DB for tests
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });

      // Test connection
      await this.testRedis.ping();
      
      logger.info('Test Redis setup completed');
      return this.testRedis;
    } catch (error) {
      logger.error('Failed to setup test Redis:', error);
      throw error;
    }
  }

  /**
   * Cleanup test Redis
   */
  static async cleanupTestRedis() {
    try {
      if (this.testRedis) {
        await this.testRedis.flushdb();
        await this.testRedis.quit();
        this.testRedis = null;
      }
      
      logger.info('Test Redis cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup test Redis:', error);
      throw error;
    }
  }

  /**
   * Mock Stellar API responses
   */
  static mockStellarAccount(address) {
    const mockAccount = {
      address: address,
      balance: '1000.0000000',
      sequence: '123456789',
      signers: [
        {
          key: address,
          weight: 1,
          type: 'ed25519_public_key'
        }
      ],
      thresholds: {
        lowThreshold: 1,
        medThreshold: 2,
        highThreshold: 3
      },
      flags: {
        authRequired: false,
        authRevocable: false,
        authImmutable: false
      }
    };

    // This would integrate with actual mocking library like nock
    // For now, we'll store the mock for reference
    this._mocks = this._mocks || {};
    this._mocks[`stellar-account-${address}`] = mockAccount;
    
    return mockAccount;
  }

  /**
   * Mock Stellar account not found
   */
  static mockStellarAccountNotFound(address) {
    this._mocks = this._mocks || {};
    this._mocks[`stellar-account-${address}`] = null;
  }

  /**
   * Mock Stellar transactions
   */
  static mockStellarTransactions(address, count = 10) {
    const transactions = [];
    
    for (let i = 0; i < count; i++) {
      transactions.push({
        id: `transaction-${i}`,
        hash: `hash-${i}`,
        sourceAccount: address,
        successful: true,
        status: 'success',
        createdAt: new Date(Date.now() - i * 60000).toISOString(),
        operations: [
          {
            type: 'payment',
            destination: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
            amount: '10.0000000',
            asset: 'native'
          }
        ]
      });
    }
    
    this._mocks = this._mocks || {};
    this._mocks[`stellar-transactions-${address}`] = transactions;
    
    return transactions;
  }

  /**
   * Mock Stellar transaction submission
   */
  static mockStellarTransactionSubmission() {
    const mockSubmission = {
      id: 'submitted-transaction-id',
      hash: 'submitted-transaction-hash',
      status: 'pending',
      xdr: 'AAAAAgAAAAB...',
      submittedAt: new Date().toISOString()
    };
    
    this._mocks = this._mocks || {};
    this._mocks['stellar-transaction-submission'] = mockSubmission;
    
    return mockSubmission;
  }

  /**
   * Mock contract info
   */
  static mockContractInfo() {
    const mockInfo = {
      version: '2.0.0',
      network: 'TESTNET',
      address: 'CA1234567890ABCDEF1234567890ABCDEF1234567890',
      deployedAt: '2023-01-01T00:00:00.000Z',
      admin: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890'
    };
    
    this._mocks = this._mocks || {};
    this._mocks['contract-info'] = mockInfo;
    
    return mockInfo;
  }

  /**
   * Mock contract deployment
   */
  static mockContractDeployment() {
    const mockDeployment = {
      address: 'CA1234567890ABCDEF1234567890ABCDEF1234567890',
      transactionHash: 'tx-hash-deployment',
      deployedAt: new Date().toISOString(),
      status: 'success'
    };
    
    this._mocks = this._mocks || {};
    this._mocks['contract-deployment'] = mockDeployment;
    
    return mockDeployment;
  }

  /**
   * Mock contract data
   */
  static mockContractData(key) {
    const mockData = {
      key: key,
      value: `mock-value-for-${key}`,
      updatedAt: new Date().toISOString()
    };
    
    this._mocks = this._mocks || {};
    this._mocks[`contract-data-${key}`] = mockData;
    
    return mockData;
  }

  /**
   * Mock server error
   */
  static mockServerError(path, method) {
    this._mocks = this._mocks || {};
    this._mocks[`server-error-${method}-${path}`] = true;
  }

  /**
   * Get mock data
   */
  static getMockData(key) {
    return this._mocks ? this._mocks[key] : null;
  }

  /**
   * Wait for async operations
   */
  static async waitFor(milliseconds = 100) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Generate random test data
   */
  static generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random Stellar address
   */
  static generateRandomStellarAddress() {
    const prefix = 'G';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = prefix;
    for (let i = 0; i < 55; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random DID
   */
  static generateRandomDID() {
    const address = this.generateRandomStellarAddress();
    return `did:stellar:${address}`;
  }

  /**
   * Assert HTTP response structure
   */
  static assertResponseStructure(response, expectedFields = []) {
    expect(response).to.have.property('body');
    expect(response.body).to.have.property('success');
    
    if (response.body.success) {
      expect(response.body).to.have.property('data');
      
      if (expectedFields.length > 0) {
        expectedFields.forEach(field => {
          expect(response.body.data).to.have.property(field);
        });
      }
    } else {
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.have.property('code');
      expect(response.body.error).to.have.property('message');
    }
  }

  /**
   * Assert error response structure
   */
  static assertErrorResponse(response, expectedCode, expectedMessageContains = '') {
    expect(response.body).to.have.property('success', false);
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('code', expectedCode);
    
    if (expectedMessageContains) {
      expect(response.body.error.message).to.include(expectedMessageContains);
    }
  }

  /**
   * Assert pagination structure
   */
  static assertPaginationStructure(response) {
    expect(response.body).to.have.property('meta');
    expect(response.body.meta).to.have.property('total');
    expect(response.body.meta).to.have.property('limit');
    expect(response.body.meta).to.have.property('offset');
    expect(response.body.meta).to.have.property('hasNext');
    expect(response.body.meta).to.have.property('hasPrev');
  }

  /**
   * Create test file upload
   */
  static createTestFileUpload(filename = 'test.txt', content = 'test content', mimeType = 'text/plain') {
    const buffer = Buffer.from(content);
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: mimeType,
      size: buffer.length,
      buffer: buffer
    };
  }

  /**
   * Setup test middleware
   */
  static setupTestMiddleware(app) {
    // Add test-specific middleware
    app.use((req, res, next) => {
      req.testMode = true;
      next();
    });

    // Add test error handler
    app.use((err, req, res, next) => {
      if (req.testMode) {
        logger.error('Test error:', err);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            technicalError: err.message
          }
        });
      } else {
        next(err);
      }
    });
  }

  /**
   * Cleanup test resources
   */
  static async cleanup() {
    try {
      await this.cleanupTestDatabase(this.testDb);
      await this.cleanupTestRedis();
      await this.cleanupTestEnvironment();
      
      // Clear mocks
      this._mocks = {};
      
      logger.info('All test resources cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup test resources:', error);
      throw error;
    }
  }

  /**
   * Setup test hooks for Mocha
   */
  static setupMochaHooks() {
    return {
      beforeAll: async () => {
        await this.setupTestEnvironment();
        await this.setupTestDatabase();
        await this.setupTestRedis();
      },
      
      afterAll: async () => {
        await this.cleanup();
      },
      
      beforeEach: async () => {
        await this.clearTestData(this.testDb);
        if (this.testRedis) {
          await this.testRedis.flushdb();
        }
      },
      
      afterEach: async () => {
        // Clear any test-specific state
        this._mocks = {};
      }
    };
  }

  /**
   * Performance test helper
   */
  static async measurePerformance(testFunction, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      await testFunction();
      const endTime = process.hrtime.bigint();
      
      times.push(Number(endTime - startTime) / 1000000); // Convert to milliseconds
    }
    
    return {
      times,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
    };
  }

  /**
   * Load test helper
   */
  static async runLoadTest(testFunction, concurrency = 10, duration = 5000) {
    const startTime = Date.now();
    const results = {
      total: 0,
      success: 0,
      errors: 0,
      responseTimes: []
    };
    
    const runTest = async () => {
      const testStartTime = Date.now();
      
      try {
        await testFunction();
        results.success++;
      } catch (error) {
        results.errors++;
      } finally {
        const testEndTime = Date.now();
        results.responseTimes.push(testEndTime - testStartTime);
        results.total++;
      }
    };
    
    const promises = [];
    
    while (Date.now() - startTime < duration) {
      // Run tests concurrently
      const batch = [];
      for (let i = 0; i < concurrency; i++) {
        batch.push(runTest());
      }
      
      await Promise.all(batch);
    }
    
    return {
      ...results,
      averageResponseTime: results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length,
      requestsPerSecond: results.total / (duration / 1000)
    };
  }
}

module.exports = TestUtils;
