const path = require('path');
const { expect } = require('chai');

/**
 * Test Configuration
 * Centralized configuration for all test suites
 */

class TestConfig {
  constructor() {
    this.environment = {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
      JWT_EXPIRES_IN: '1h',
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.REDIS_PORT || 6379,
      REDIS_DB: 15, // Separate DB for tests
      MONGODB_TEST_URI: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/stellar-did-test',
      STELLAR_NETWORK: 'TESTNET',
      LOG_LEVEL: 'error' // Minimal logging during tests
    };

    this.timeouts = {
      default: 30000,        // 30 seconds
      slow: 5000,           // 5 seconds
      integration: 60000,    // 1 minute
      performance: 120000,  // 2 minutes
      load: 300000         // 5 minutes
    };

    this.thresholds = {
      api: {
        did_create: { average: 500, max: 1000 },
        did_read: { average: 200, max: 400 },
        did_update: { average: 300, max: 600 },
        did_delete: { average: 200, max: 400 },
        did_list: { average: 250, max: 500 },
        credential_issue: { average: 400, max: 800 },
        credential_verify: { average: 300, max: 600 },
        credential_revoke: { average: 200, max: 400 },
        credential_list: { average: 250, max: 500 },
        stellar_account: { average: 300, max: 600 },
        stellar_transactions: { average: 400, max: 800 },
        stellar_transaction: { average: 500, max: 1000 }
      },
      concurrency: {
        low: 10,
        medium: 25,
        high: 50,
        stress: 100
      },
      load: {
        requestsPerSecond: {
          minimum: 50,
          target: 100,
          maximum: 500
        },
        errorRate: {
          acceptable: 0.01, // 1%
          warning: 0.05,    // 5%
          critical: 0.1    // 10%
        },
        responseTime: {
          average: 500,
          p95: 1000,
          p99: 2000
        }
      },
      memory: {
        maxGrowth: 100 * 1024 * 1024, // 100MB
        heapUsed: 200 * 1024 * 1024,  // 200MB
        heapTotal: 400 * 1024 * 1024 // 400MB
      }
    };

    this.mockData = {
      users: {
        count: 3,
        defaultRoles: ['USER'],
        adminRoles: ['USER', 'ADMIN'],
        issuerRoles: ['USER', 'ISSUER'],
        verifierRoles: ['USER', 'VERIFIER']
      },
      dids: {
        count: 10,
        verificationMethods: 2,
        services: 2
      },
      credentials: {
        count: 20,
        types: ['VerifiableCredential', 'DegreeCredential', 'EmploymentCredential', 'IdentityCredential']
      },
      transactions: {
        count: 50,
        operations: 2
      }
    };

    this.endpoints = {
      rest: {
        base: '/api/v1',
        did: '/api/v1/did',
        credentials: '/api/v1/credentials',
        stellar: '/api/v1/stellar',
        contracts: '/api/v1/contracts',
        auth: '/api/v1/auth'
      },
      graphql: {
        endpoint: '/graphql',
        playground: '/graphql',
        subscriptions: '/graphql'
      }
    };

    this.assertions = {
      http: {
        success: [200, 201, 204],
        clientError: [400, 401, 403, 404, 409, 422, 429],
        serverError: [500, 502, 503, 504]
      },
      response: {
        structure: ['success', 'data', 'error'],
        error: ['code', 'message'],
        pagination: ['total', 'limit', 'offset', 'hasNext', 'hasPrev']
      },
      performance: {
        regressionThreshold: 0.2, // 20%
        degradationThreshold: 0.5 // 50%
      }
    };

    this.coverage = {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/coverage/**',
        '**/dist/**',
        '**/build/**'
      ],
      reporters: ['text', 'html', 'lcov'],
      outputDir: './coverage'
    };

    this.reports = {
      outputDir: './test-results',
      formats: ['json', 'html', 'junit'],
      includeScreenshots: true,
      includePerformanceMetrics: true,
      includeCoverageReport: true
    };
  }

  /**
   * Get environment variable with fallback
   */
  getEnv(key, fallback = null) {
    return process.env[key] || this.environment[key] || fallback;
  }

  /**
   * Get timeout for test type
   */
  getTimeout(type = 'default') {
    return this.timeouts[type] || this.timeouts.default;
  }

  /**
   * Get performance threshold for operation
   */
  getThreshold(category, operation) {
    return this.thresholds[category]?.[operation] || null;
  }

  /**
   * Check if HTTP status is in expected range
   */
  isStatusSuccess(status) {
    return this.assertions.http.success.includes(status);
  }

  isStatusClientError(status) {
    return this.assertions.http.clientError.includes(status);
  }

  isStatusServerError(status) {
    return this.assertions.http.serverError.includes(status);
  }

  /**
   * Assert response structure
   */
  assertResponseStructure(response, expectedFields = []) {
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
  assertErrorResponse(response, expectedCode, expectedMessageContains = '') {
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
  assertPaginationStructure(response) {
    expect(response.body).to.have.property('meta');
    
    this.assertions.response.pagination.forEach(field => {
      expect(response.body.meta).to.have.property(field);
    });
  }

  /**
   * Check for performance regression
   */
  checkPerformanceRegression(current, baseline, operation) {
    const threshold = this.thresholds.assertions.performance.regressionThreshold;
    const regression = (current - baseline) / baseline;
    
    if (regression > threshold) {
      throw new Error(
        `Performance regression detected for ${operation}: ` +
        `current ${current}ms vs baseline ${baseline}ms (${(regression * 100).toFixed(1)}% increase)`
      );
    }
  }

  /**
   * Generate test report
   */
  generateReport(testResults, performanceData, coverageData) {
    const report = {
      summary: {
        total: testResults.total,
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped,
        duration: testResults.duration,
        passRate: ((testResults.passed / testResults.total) * 100).toFixed(2)
      },
      performance: performanceData,
      coverage: coverageData,
      timestamp: new Date().toISOString(),
      environment: this.environment
    };

    return report;
  }

  /**
   * Setup test environment
   */
  async setupEnvironment() {
    // Set environment variables
    Object.entries(this.environment).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Suppress console output unless verbose
    if (process.env.VERBOSE_TESTS !== 'true') {
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
      console.debug = () => {};
    }

    // Setup Chai assertions
    expect.should();
  }

  /**
   * Cleanup test environment
   */
  cleanupEnvironment() {
    // Restore environment variables
    Object.keys(this.environment).forEach(key => {
      delete process.env[key];
    });

    // Restore console functions
    if (process.env.VERBOSE_TESTS !== 'true') {
      // Restore original console if needed
    }
  }

  /**
   * Get test configuration for specific test type
   */
  getTestConfig(testType) {
    const configs = {
      unit: {
        timeout: this.timeouts.default,
        parallel: true,
        retries: 0,
        bail: false
      },
      integration: {
        timeout: this.timeouts.integration,
        parallel: false,
        retries: 1,
        bail: false
      },
      performance: {
        timeout: this.timeouts.performance,
        parallel: false,
        retries: 0,
        bail: true
      },
      load: {
        timeout: this.timeouts.load,
        parallel: false,
        retries: 0,
        bail: false
      },
      security: {
        timeout: this.timeouts.default,
        parallel: true,
        retries: 0,
        bail: false
      }
    };

    return configs[testType] || configs.unit;
  }

  /**
   * Validate test configuration
   */
  validate() {
    const errors = [];

    // Check required environment variables
    const requiredEnv = ['NODE_ENV', 'JWT_SECRET'];
    requiredEnv.forEach(env => {
      if (!process.env[env] && !this.environment[env]) {
        errors.push(`Missing required environment variable: ${env}`);
      }
    });

    // Check thresholds are reasonable
    Object.entries(this.thresholds.api).forEach(([operation, threshold]) => {
      if (threshold.average <= 0 || threshold.max <= 0) {
        errors.push(`Invalid threshold for ${operation}: average and max must be positive`);
      }
      if (threshold.max < threshold.average) {
        errors.push(`Invalid threshold for ${operation}: max must be >= average`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Test configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Export configuration for external use
   */
  export() {
    return {
      environment: this.environment,
      timeouts: this.timeouts,
      thresholds: this.thresholds,
      endpoints: this.endpoints,
      assertions: this.assertions,
      coverage: this.coverage,
      reports: this.reports
    };
  }
}

// Create singleton instance
const testConfig = new TestConfig();

// Validate configuration on load
testConfig.validate();

module.exports = testConfig;
