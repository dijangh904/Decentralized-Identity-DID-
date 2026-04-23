const request = require('supertest');
const { expect } = require('chai');
const app = require('../../server');
const TestUtils = require('../utils/testUtils');
const TestData = require('../utils/testData');

describe('Performance Test Suite', function() {
  this.timeout(120000); // 2 minute timeout for performance tests

  let server;
  let testUser;
  let authToken;
  let performanceData = {
    api: {},
    database: {},
    memory: {},
    cache: {}
  };

  before(async function() {
    // Setup test environment
    await TestUtils.setupTestEnvironment();
    await TestUtils.setupTestDatabase();
    await TestUtils.setupTestRedis();
    
    // Start test server
    server = app.listen(0);
    
    // Create test user
    testUser = await TestUtils.createTestUser();
    authToken = TestUtils.generateAuthToken(testUser);
    
    console.log('Performance test suite setup completed');
  });

  after(async function() {
    // Cleanup
    if (server) server.close();
    await TestUtils.cleanup();
    console.log('Performance test suite cleanup completed');
  });

  beforeEach(async function() {
    // Clear test data
    await TestUtils.clearTestData(TestUtils.testDb);
    await TestUtils.testRedis.flushdb();
  });

  describe('API Response Time Performance', function() {
    
    it('should handle DID operations within performance thresholds', async function() {
      const operations = ['create', 'read', 'update', 'delete'];
      const thresholds = { create: 500, read: 200, update: 300, delete: 200 };
      
      for (const operation of operations) {
        const performance = await TestUtils.measurePerformance(async () => {
          switch (operation) {
            case 'create':
              await request(app)
                .post('/api/v1/did')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validDID())
                .expect(201);
              break;
              
            case 'read':
              await request(app)
                .get('/api/v1/did')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
              break;
              
            case 'update':
              // First create a DID
              const createResponse = await request(app)
                .post('/api/v1/did')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validDID())
                .expect(201);
              
              // Then update it
              await request(app)
                .put(`/api/v1/did/${createResponse.body.data.did}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ serviceEndpoint: 'https://updated.example.com' })
                .expect(200);
              break;
              
            case 'delete':
              // First create a DID
              const deleteCreateResponse = await request(app)
                .post('/api/v1/did')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validDID())
                .expect(201);
              
              // Then delete it
              await request(app)
                .delete(`/api/v1/did/${deleteCreateResponse.body.data.did}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
              break;
          }
        }, 10);
        
        performanceData.api[`did_${operation}`] = performance;
        
        console.log(`DID ${operation} performance:`, {
          average: `${performance.average.toFixed(2)}ms`,
          min: `${performance.min}ms`,
          max: `${performance.max}ms`,
          median: `${performance.median.toFixed(2)}ms`
        });
        
        // Assert performance thresholds
        expect(performance.average).to.be.lessThan(thresholds[operation]);
        expect(performance.max).to.be.lessThan(thresholds[operation] * 2);
      }
    });

    it('should handle credential operations within performance thresholds', async function() {
      const operations = ['issue', 'verify', 'revoke', 'list'];
      const thresholds = { issue: 400, verify: 300, revoke: 200, list: 250 };
      
      for (const operation of operations) {
        const performance = await TestUtils.measurePerformance(async () => {
          switch (operation) {
            case 'issue':
              await request(app)
                .post('/api/v1/credentials')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validCredential())
                .expect(201);
              break;
              
            case 'verify':
              // First issue a credential
              const issueResponse = await request(app)
                .post('/api/v1/credentials')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validCredential())
                .expect(201);
              
              // Then verify it
              await request(app)
                .post(`/api/v1/credentials/${issueResponse.body.data.id}/verify`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ credential: issueResponse.body.data })
                .expect(200);
              break;
              
            case 'revoke':
              // First issue a credential
              const revokeIssueResponse = await request(app)
                .post('/api/v1/credentials')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validCredential())
                .expect(201);
              
              // Then revoke it
              await request(app)
                .delete(`/api/v1/credentials/${revokeIssueResponse.body.data.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
              break;
              
            case 'list':
              await request(app)
                .get('/api/v1/credentials')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
              break;
          }
        }, 10);
        
        performanceData.api[`credential_${operation}`] = performance;
        
        console.log(`Credential ${operation} performance:`, {
          average: `${performance.average.toFixed(2)}ms`,
          min: `${performance.min}ms`,
          max: `${performance.max}ms`,
          median: `${performance.median.toFixed(2)}ms`
        });
        
        // Assert performance thresholds
        expect(performance.average).to.be.lessThan(thresholds[operation]);
        expect(performance.max).to.be.lessThan(thresholds[operation] * 2);
      }
    });

    it('should handle Stellar operations within performance thresholds', async function() {
      const operations = ['getAccount', 'getTransactions', 'createTransaction'];
      const thresholds = { getAccount: 300, getTransactions: 400, createTransaction: 500 };
      
      for (const operation of operations) {
        const performance = await TestUtils.measurePerformance(async () => {
          switch (operation) {
            case 'getAccount':
              TestUtils.mockStellarAccount('GABC1234567890ABCDEF1234567890ABCDEF1234567890');
              
              await request(app)
                .get('/api/v1/stellar/account/GABC1234567890ABCDEF1234567890ABCDEF1234567890')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
              break;
              
            case 'getTransactions':
              TestUtils.mockStellarTransactions('GABC1234567890ABCDEF1234567890ABCDEF1234567890');
              
              await request(app)
                .get('/api/v1/stellar/transactions?account=GABC1234567890ABCDEF1234567890ABCDEF1234567890')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
              break;
              
            case 'createTransaction':
              TestUtils.mockStellarTransactionSubmission();
              
              await request(app)
                .post('/api/v1/stellar/transaction')
                .set('Authorization', `Bearer ${authToken}`)
                .send(TestData.validStellarTransaction())
                .expect(201);
              break;
          }
        }, 10);
        
        performanceData.api[`stellar_${operation}`] = performance;
        
        console.log(`Stellar ${operation} performance:`, {
          average: `${performance.average.toFixed(2)}ms`,
          min: `${performance.min}ms`,
          max: `${performance.max}ms`,
          median: `${performance.median.toFixed(2)}ms`
        });
        
        // Assert performance thresholds
        expect(performance.average).to.be.lessThan(thresholds[operation]);
        expect(performance.max).to.be.lessThan(thresholds[operation] * 2);
      }
    });
  });

  describe('Concurrent Request Performance', function() {
    
    it('should handle concurrent DID creation efficiently', async function() {
      const concurrencyLevels = [10, 25, 50, 100];
      
      for (const concurrency of concurrencyLevels) {
        const loadTest = await TestUtils.runLoadTest(async () => {
          await request(app)
            .post('/api/v1/did')
            .set('Authorization', `Bearer ${authToken}`)
            .send(TestData.validDID())
            .expect(201);
        }, concurrency, 10000); // 10 seconds
        
        console.log(`DID creation load test (${concurrency} concurrent):`, {
          total: loadTest.total,
          success: loadTest.success,
          errors: loadTest.errors,
          requestsPerSecond: loadTest.requestsPerSecond.toFixed(2),
          averageResponseTime: `${loadTest.averageResponseTime.toFixed(2)}ms`
        });
        
        // Assert performance requirements
        expect(loadTest.errors).to.equal(0);
        expect(loadTest.requestsPerSecond).to.be.greaterThan(concurrency * 2);
        expect(loadTest.averageResponseTime).to.be.lessThan(1000);
      }
    });

    it('should handle concurrent credential operations efficiently', async function() {
      const concurrencyLevels = [10, 25, 50];
      
      for (const concurrency of concurrencyLevels) {
        const loadTest = await TestUtils.runLoadTest(async () => {
          await request(app)
            .post('/api/v1/credentials')
            .set('Authorization', `Bearer ${authToken}`)
            .send(TestData.validCredential())
            .expect(201);
        }, concurrency, 10000); // 10 seconds
        
        console.log(`Credential issuance load test (${concurrency} concurrent):`, {
          total: loadTest.total,
          success: loadTest.success,
          errors: loadTest.errors,
          requestsPerSecond: loadTest.requestsPerSecond.toFixed(2),
          averageResponseTime: `${loadTest.averageResponseTime.toFixed(2)}ms`
        });
        
        // Assert performance requirements
        expect(loadTest.errors).to.equal(0);
        expect(loadTest.requestsPerSecond).to.be.greaterThan(concurrency * 1.5);
        expect(loadTest.averageResponseTime).to.be.lessThan(1500);
      }
    });

    it('should handle mixed concurrent operations efficiently', async function() {
      const concurrency = 50;
      const operations = [
        () => request(app).get('/api/v1/did').set('Authorization', `Bearer ${authToken}`).expect(200),
        () => request(app).get('/api/v1/credentials').set('Authorization', `Bearer ${authToken}`).expect(200),
        () => request(app).get('/api/v1/stellar/account/GABC1234567890ABCDEF1234567890ABCDEF1234567890').set('Authorization', `Bearer ${authToken}`).expect(200)
      ];
      
      const loadTest = await TestUtils.runLoadTest(async () => {
        const operation = operations[Math.floor(Math.random() * operations.length)];
        await operation();
      }, concurrency, 15000); // 15 seconds
      
      console.log(`Mixed operations load test (${concurrency} concurrent):`, {
        total: loadTest.total,
        success: loadTest.success,
        errors: loadTest.errors,
        requestsPerSecond: loadTest.requestsPerSecond.toFixed(2),
        averageResponseTime: `${loadTest.averageResponseTime.toFixed(2)}ms`
      });
      
      // Assert performance requirements
      expect(loadTest.errors).to.equal(0);
      expect(loadTest.requestsPerSecond).to.be.greaterThan(concurrency * 3);
      expect(loadTest.averageResponseTime).to.be.lessThan(800);
    });
  });

  describe('Memory and Resource Performance', function() {
    
    it('should maintain memory usage within acceptable limits', async function() {
      const initialMemory = process.memoryUsage();
      
      // Create large number of DIDs
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validDID())
          .expect(201);
      }
      
      const afterCreationMemory = process.memoryUsage();
      
      // Perform many read operations
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .get('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }
      
      const afterReadsMemory = process.memoryUsage();
      
      // Calculate memory growth
      const memoryGrowth = {
        heapUsed: afterReadsMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: afterReadsMemory.heapTotal - initialMemory.heapTotal,
        external: afterReadsMemory.external - initialMemory.external
      };
      
      console.log('Memory usage analysis:', {
        initial: {
          heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`
        },
        afterCreation: {
          heapUsed: `${(afterCreationMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(afterCreationMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`
        },
        afterReads: {
          heapUsed: `${(afterReadsMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(afterReadsMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`
        },
        growth: {
          heapUsed: `${(memoryGrowth.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memoryGrowth.heapTotal / 1024 / 1024).toFixed(2)}MB`
        }
      });
      
      performanceData.memory = memoryGrowth;
      
      // Assert memory limits (should not grow more than 100MB)
      expect(memoryGrowth.heapUsed).to.be.lessThan(100 * 1024 * 1024);
    });

    it('should handle large payload operations efficiently', async function() {
      // Test with large verification methods and services
      const largeDID = TestData.validDIDWithVerificationMethods();
      
      // Add many verification methods
      largeDID.verificationMethods = [];
      for (let i = 0; i < 50; i++) {
        largeDID.verificationMethods.push({
          id: `key-${i}`,
          type: 'Ed25519VerificationKey2018',
          controller: largeDID.did,
          publicKeyBase58: TestUtils.generateRandomStellarAddress()
        });
      }
      
      // Add many services
      largeDID.services = [];
      for (let i = 0; i < 20; i++) {
        largeDID.services.push({
          id: `service-${i}`,
          type: 'ServiceType',
          serviceEndpoint: `https://service${i}.example.com`
        });
      }
      
      const performance = await TestUtils.measurePerformance(async () => {
        await request(app)
          .post('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .send(largeDID)
          .expect(201);
      }, 5);
      
      console.log('Large payload DID creation performance:', {
        average: `${performance.average.toFixed(2)}ms`,
        min: `${performance.min}ms`,
        max: `${performance.max}ms`,
        payloadSize: `${JSON.stringify(largeDID).length} bytes`
      });
      
      // Should handle large payloads within reasonable time
      expect(performance.average).to.be.lessThan(2000);
      expect(performance.max).to.be.lessThan(5000);
    });
  });

  describe('Cache Performance', function() {
    
    it('should demonstrate cache effectiveness', async function() {
      // Create a DID first
      const didData = TestData.validDID();
      
      const createResponse = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .send(didData)
        .expect(201);
      
      const did = createResponse.body.data;
      
      // First request (cache miss)
      const firstRequestStart = Date.now();
      await request(app)
        .get(`/api/v1/did/${did.did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const firstRequestTime = Date.now() - firstRequestStart;
      
      // Second request (cache hit)
      const secondRequestStart = Date.now();
      const secondResponse = await request(app)
        .get(`/api/v1/did/${did.did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const secondRequestTime = Date.now() - secondRequestStart;
      
      console.log('Cache performance analysis:', {
        firstRequest: `${firstRequestTime}ms (cache miss)`,
        secondRequest: `${secondRequestTime}ms (cache hit)`,
        speedup: `${((firstRequestTime - secondRequestTime) / firstRequestTime * 100).toFixed(1)}%`,
        cacheHeaders: {
          'x-cache': secondResponse.headers['x-cache'],
          'x-cache-ttl': secondResponse.headers['x-cache-ttl']
        }
      });
      
      // Cache hit should be significantly faster
      expect(secondRequestTime).to.be.lessThan(firstRequestTime * 0.5);
      expect(secondResponse.headers['x-cache']).to.equal('HIT');
    });

    it('should handle cache invalidation correctly', async function() {
      // Create a DID
      const didData = TestData.validDID();
      
      const createResponse = await request(app)
        .post('/api/v1/did')
        .set('Authorization', `Bearer ${authToken}`)
        .send(didData)
        .expect(201);
      
      const did = createResponse.body.data;
      
      // First request to populate cache
      await request(app)
        .get(`/api/v1/did/${did.did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Update DID (should invalidate cache)
      await request(app)
        .put(`/api/v1/did/${did.did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ serviceEndpoint: 'https://updated.example.com' })
        .expect(200);
      
      // Request again (should be cache miss due to invalidation)
      const response = await request(app)
        .get(`/api/v1/did/${did.did}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.serviceEndpoint).to.equal('https://updated.example.com');
      expect(response.headers['x-cache']).to.equal('MISS');
    });
  });

  describe('Database Performance', function() {
    
    it('should handle database operations efficiently', async function() {
      const operations = ['insert', 'select', 'update', 'delete'];
      const batchSizes = [10, 50, 100];
      
      for (const batchSize of batchSizes) {
        const performance = {};
        
        for (const operation of operations) {
          performance[operation] = await TestUtils.measurePerformance(async () => {
            switch (operation) {
              case 'insert':
                // Insert multiple DIDs
                const insertPromises = [];
                for (let i = 0; i < batchSize; i++) {
                  insertPromises.push(
                    request(app)
                      .post('/api/v1/did')
                      .set('Authorization', `Bearer ${authToken}`)
                      .send(TestData.validDID())
                      .expect(201)
                  );
                }
                await Promise.all(insertPromises);
                break;
                
              case 'select':
                // Select multiple DIDs
                await request(app)
                  .get(`/api/v1/did?limit=${batchSize}`)
                  .set('Authorization', `Bearer ${authToken}`)
                  .expect(200);
                break;
                
              case 'update':
                // Update multiple DIDs
                const updatePromises = [];
                for (let i = 0; i < Math.min(batchSize, 10); i++) {
                  updatePromises.push(
                    request(app)
                      .put(`/api/v1/did/did:stellar:GABC${i.toString().padStart(54, '0')}`)
                      .set('Authorization', `Bearer ${authToken}`)
                      .send({ serviceEndpoint: `https://updated${i}.example.com` })
                      .expect(200)
                  );
                }
                await Promise.allSettled(updatePromises);
                break;
                
              case 'delete':
                // Delete multiple DIDs
                const deletePromises = [];
                for (let i = 0; i < Math.min(batchSize, 10); i++) {
                  deletePromises.push(
                    request(app)
                      .delete(`/api/v1/did/did:stellar:GABC${i.toString().padStart(54, '0')}`)
                      .set('Authorization', `Bearer ${authToken}`)
                      .expect(200)
                  );
                }
                await Promise.allSettled(deletePromises);
                break;
            }
          }, 3);
        }
        
        console.log(`Database performance (batch size ${batchSize}):`, {
          insert: `${performance.insert.average.toFixed(2)}ms avg`,
          select: `${performance.select.average.toFixed(2)}ms avg`,
          update: `${performance.update.average.toFixed(2)}ms avg`,
          delete: `${performance.delete.average.toFixed(2)}ms avg`
        });
        
        performanceData.database[`batch_${batchSize}`] = performance;
        
        // Assert database performance thresholds
        expect(performance.select.average).to.be.lessThan(500);
        expect(performance.insert.average / batchSize).to.be.lessThan(100);
      }
    });
  });

  describe('Stress Testing', function() {
    
    it('should handle sustained load without degradation', async function() {
      const duration = 30000; // 30 seconds
      const concurrency = 25;
      let requestCount = 0;
      let errorCount = 0;
      let responseTimes = [];
      
      const startTime = Date.now();
      const endTime = startTime + duration;
      
      const stressTest = async () => {
        while (Date.now() < endTime) {
          const requestStart = Date.now();
          
          try {
            await request(app)
              .get('/api/v1/did')
              .set('Authorization', `Bearer ${authToken}`)
              .expect(200);
            
            const requestTime = Date.now() - requestStart;
            responseTimes.push(requestTime);
            requestCount++;
          } catch (error) {
            errorCount++;
          }
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      
      // Run concurrent stress tests
      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(stressTest());
      }
      
      await Promise.all(promises);
      
      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / actualDuration) * 1000;
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      
      console.log('Stress test results:', {
        duration: `${actualDuration}ms`,
        totalRequests: requestCount,
        errors: errorCount,
        requestsPerSecond: requestsPerSecond.toFixed(2),
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${p95ResponseTime}ms`,
        errorRate: `${((errorCount / requestCount) * 100).toFixed(2)}%`
      });
      
      // Assert stress test requirements
      expect(errorCount / requestCount).to.be.lessThan(0.01); // Less than 1% error rate
      expect(requestsPerSecond).to.be.greaterThan(50);
      expect(avgResponseTime).to.be.lessThan(500);
      expect(p95ResponseTime).to.be.lessThan(1000);
    });

    it('should recover from resource exhaustion', async function() {
      // Simulate resource exhaustion with many concurrent requests
      const exhaustionConcurrency = 200;
      let successfulRequests = 0;
      let failedRequests = 0;
      
      const exhaustionTest = async () => {
        try {
          await request(app)
            .get('/api/v1/did')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
          
          successfulRequests++;
        } catch (error) {
          failedRequests++;
        }
      };
      
      // Run exhaustion test
      const promises = [];
      for (let i = 0; i < exhaustionConcurrency; i++) {
        promises.push(exhaustionTest());
      }
      
      await Promise.allSettled(promises);
      
      console.log('Resource exhaustion test:', {
        totalRequests: exhaustionConcurrency,
        successful: successfulRequests,
        failed: failedRequests,
        successRate: `${((successfulRequests / exhaustionConcurrency) * 100).toFixed(2)}%`
      });
      
      // System should handle reasonable load
      expect(successfulRequests / exhaustionConcurrency).to.be.greaterThan(0.7);
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test recovery with normal load
      const recoveryTest = await TestUtils.measurePerformance(async () => {
        await request(app)
          .get('/api/v1/did')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }, 5);
      
      console.log('Recovery test performance:', {
        average: `${recoveryTest.average.toFixed(2)}ms`,
        status: recoveryTest.average < 500 ? 'Recovered' : 'Not recovered'
      });
      
      // System should recover within reasonable time
      expect(recoveryTest.average).to.be.lessThan(500);
    });
  });

  describe('Performance Regression Detection', function() {
    
    it('should detect performance regressions', function() {
      // Define performance baselines (these would be stored from previous runs)
      const baselines = {
        did_create: { average: 200, max: 400 },
        did_read: { average: 100, max: 200 },
        credential_issue: { average: 150, max: 300 },
        stellar_account: { average: 200, max: 400 }
      };
      
      const regressions = [];
      
      for (const [operation, baseline] of Object.entries(baselines)) {
        const current = performanceData.api[operation];
        
        if (current) {
          const avgRegression = (current.average - baseline.average) / baseline.average;
          const maxRegression = (current.max - baseline.max) / baseline.max;
          
          if (avgRegression > 0.2 || maxRegression > 0.3) {
            regressions.push({
              operation,
              avgRegression: `${(avgRegression * 100).toFixed(1)}%`,
              maxRegression: `${(maxRegression * 100).toFixed(1)}%`,
              current: current.average,
              baseline: baseline.average
            });
          }
        }
      }
      
      if (regressions.length > 0) {
        console.warn('Performance regressions detected:', regressions);
      } else {
        console.log('No performance regressions detected');
      }
      
      // Fail test if significant regressions are detected
      expect(regressions.length).to.equal(0);
    });
  });

  after(function() {
    // Generate performance report
    console.log('\n=== Performance Test Summary ===');
    
    console.log('\nAPI Performance:');
    Object.entries(performanceData.api).forEach(([operation, data]) => {
      console.log(`  ${operation}:`);
      console.log(`    Average: ${data.average.toFixed(2)}ms`);
      console.log(`    Min: ${data.min}ms`);
      console.log(`    Max: ${data.max}ms`);
      console.log(`    Median: ${data.median.toFixed(2)}ms`);
    });
    
    if (Object.keys(performanceData.memory).length > 0) {
      console.log('\nMemory Usage:');
      console.log(`  Heap Used Growth: ${(performanceData.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Total Growth: ${(performanceData.memory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.log('\n=== End Performance Test Summary ===\n');
  });
});
