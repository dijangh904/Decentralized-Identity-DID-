const enhancedCache = require('../services/enhancedCacheService');
const cacheMonitor = require('../services/cacheMonitorService');
const { logger } = require('../middleware');

describe('Enhanced Cache Service', () => {
  beforeEach(() => {
    // Reset cache stats before each test
    enhancedCache.resetStats();
  });

  afterEach(async () => {
    // Clean up cache after each test
    await enhancedCache.invalidateByPattern('*');
  });

  describe('Basic Cache Operations', () => {
    test('should set and get values', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };

      const setResult = await enhancedCache.set('test', key, value, 300);
      expect(setResult).toBe(true);

      const retrieved = await enhancedCache.get('test', key);
      expect(retrieved).toEqual(value);
    });

    test('should return null for non-existent keys', async () => {
      const result = await enhancedCache.get('test', 'non-existent-key');
      expect(result).toBeNull();
    });

    test('should delete keys', async () => {
      const key = 'delete-test-key';
      await enhancedCache.set('test', key, 'value', 300);

      const deleteResult = await enhancedCache.delete('test', key);
      expect(deleteResult).toBe(true);

      const retrieved = await enhancedCache.get('test', key);
      expect(retrieved).toBeNull();
    });

    test('should check if key exists', async () => {
      const key = 'exists-test-key';
      
      expect(await enhancedCache.exists('test', key)).toBe(false);
      
      await enhancedCache.set('test', key, 'value', 300);
      expect(await enhancedCache.exists('test', key)).toBe(true);
      
      await enhancedCache.delete('test', key);
      expect(await enhancedCache.exists('test', key)).toBe(false);
    });
  });

  describe('Intelligent TTL Strategies', () => {
    test('should get TTL for different data types', () => {
      expect(enhancedCache.getTTLForType('did', 'active')).toBe(1800);
      expect(enhancedCache.getTTLForType('did', 'inactive')).toBe(7200);
      expect(enhancedCache.getTTLForType('credential', 'active')).toBe(600);
      expect(enhancedCache.getTTLForType('credential', 'revoked')).toBe(60);
      expect(enhancedCache.getTTLForType('session', 'admin')).toBe(300);
    });

    test('should use default TTL for unknown types', () => {
      const defaultTTL = enhancedCache.getTTLForType('unknown-type', 'unknown-status');
      expect(defaultTTL).toBe(300); // Default TTL
    });

    test('should infer data status correctly', () => {
      expect(enhancedCache.inferDataStatus({ revoked: true })).toBe('revoked');
      expect(enhancedCache.inferDataStatus({ expires: '2020-01-01' })).toBe('expired');
      expect(enhancedCache.inferDataStatus({ active: true })).toBe('active');
      expect(enhancedCache.inferDataStatus({ isAdmin: true })).toBe('admin');
      expect(enhancedCache.inferDataStatus({})).toBe('default');
    });
  });

  describe('Cache Wrapper with TTL Strategy', () => {
    test('should cache with intelligent TTL', async () => {
      const key = 'wrapper-test';
      const mockData = { type: 'credential', active: true };
      let fetchCount = 0;

      const mockFetch = async () => {
        fetchCount++;
        return mockData;
      };

      // First call should fetch and cache
      const result1 = await enhancedCache.wrap('credential', key, mockFetch, {
        dataType: 'credential'
      });

      expect(fetchCount).toBe(1);
      expect(result1).toEqual(mockData);

      // Second call should return cached value
      const result2 = await enhancedCache.wrap('credential', key, mockFetch, {
        dataType: 'credential'
      });

      expect(fetchCount).toBe(1); // Should not fetch again
      expect(result2).toEqual(mockData);
    });

    test('should validate cached data', async () => {
      const key = 'validation-test';
      const expiredCredential = {
        type: 'credential',
        expires: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
      };
      let fetchCount = 0;

      const mockFetch = async () => {
        fetchCount++;
        return expiredCredential;
      };

      // First call should cache expired credential
      const result1 = await enhancedCache.wrap('credential', key, mockFetch, {
        dataType: 'credential'
      });

      expect(fetchCount).toBe(1);
      expect(result1).toEqual(expiredCredential);

      // Second call should detect invalid data and refresh
      const result2 = await enhancedCache.wrap('credential', key, mockFetch, {
        dataType: 'credential'
      });

      expect(fetchCount).toBe(2); // Should fetch again due to invalid data
      expect(result2).toEqual(expiredCredential);
    });

    test('should force refresh when requested', async () => {
      const key = 'force-refresh-test';
      const mockData = { data: 'test' };
      let fetchCount = 0;

      const mockFetch = async () => {
        fetchCount++;
        return mockData;
      };

      // Cache the data first
      await enhancedCache.wrap('test', key, mockFetch);
      expect(fetchCount).toBe(1);

      // Force refresh should bypass cache
      const result = await enhancedCache.wrap('test', key, mockFetch, {
        forceRefresh: true
      });

      expect(fetchCount).toBe(2); // Should fetch again
      expect(result).toEqual(mockData);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate by pattern', async () => {
      // Set up some test data
      await enhancedCache.set('test', 'key1', 'value1', 300);
      await enhancedCache.set('test', 'key2', 'value2', 300);
      await enhancedCache.set('other', 'key3', 'value3', 300);

      // Invalidate test namespace
      const deletedCount = await enhancedCache.invalidateByPattern('test:*');

      expect(deletedCount).toBe(2);
      expect(await enhancedCache.get('test', 'key1')).toBeNull();
      expect(await enhancedCache.get('test', 'key2')).toBeNull();
      expect(await enhancedCache.get('other', 'key3')).toEqual('value3'); // Should still exist
    });

    test('should invalidate entity type', async () => {
      // Set up DID-related data
      await enhancedCache.set('did', 'did1', 'did-data', 300);
      await enhancedCache.set('verification', 'did1', 'ver-data', 300);
      await enhancedCache.set('service', 'did1', 'svc-data', 300);
      await enhancedCache.set('credential', 'cred1', 'cred-data', 300);

      // Invalidate DID entity type
      const deletedCount = await enhancedCache.invalidateEntityType('did');

      expect(deletedCount).toBe(3); // did, verification, service
      expect(await enhancedCache.get('did', 'did1')).toBeNull();
      expect(await enhancedCache.get('verification', 'did1')).toBeNull();
      expect(await enhancedCache.get('service', 'did1')).toBeNull();
      expect(await enhancedCache.get('credential', 'cred1')).toEqual('cred-data'); // Should still exist
    });

    test('should invalidate related entries intelligently', async () => {
      // Set up related data
      await enhancedCache.set('did', 'did1', 'did-data', 300);
      await enhancedCache.set('verification', 'did1', 'ver-data', 300);
      await enhancedCache.set('service', 'did1', 'svc-data', 300);
      await enhancedCache.set('credential:issuer', 'did1', 'cred-data', 300);
      await enhancedCache.set('credential:subject', 'did1', 'cred-data2', 300);

      // Invalidate DID with related entries
      const deletedCount = await enhancedCache.invalidateRelated([
        { namespace: 'did', id: 'did1', relationType: 'did' }
      ]);

      expect(deletedCount).toBe(5); // All related entries should be deleted
      expect(await enhancedCache.get('did', 'did1')).toBeNull();
      expect(await enhancedCache.get('verification', 'did1')).toBeNull();
      expect(await enhancedCache.get('service', 'did1')).toBeNull();
      expect(await enhancedCache.get('credential:issuer', 'did1')).toBeNull();
      expect(await enhancedCache.get('credential:subject', 'did1')).toBeNull();
    });
  });

  describe('Cache Metadata', () => {
    test('should set and get cache metadata', async () => {
      const key = 'metadata-test';
      const metadata = {
        cachedAt: new Date().toISOString(),
        ttl: 600,
        dataType: 'test',
        status: 'active'
      };

      await enhancedCache.setCacheMetadata('test', key, metadata);
      const retrieved = await enhancedCache.getCacheMetadata('test', key);

      expect(retrieved).toEqual(metadata);
    });

    test('should return null for non-existent metadata', async () => {
      const result = await enhancedCache.getCacheMetadata('test', 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    test('should track statistics correctly', async () => {
      // Perform various operations
      await enhancedCache.set('test', 'key1', 'value1', 300);
      await enhancedCache.get('test', 'key1'); // Hit
      await enhancedCache.get('test', 'key2'); // Miss
      await enhancedCache.delete('test', 'key1'); // Delete

      const stats = enhancedCache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0.5); // 1 hit out of 2 total requests
    });

    test('should calculate hit rate correctly', async () => {
      // Create 3 hits and 1 miss
      await enhancedCache.set('test', 'key1', 'value1', 300);
      await enhancedCache.set('test', 'key2', 'value2', 300);
      await enhancedCache.set('test', 'key3', 'value3', 300);
      
      await enhancedCache.get('test', 'key1'); // Hit
      await enhancedCache.get('test', 'key2'); // Hit
      await enhancedCache.get('test', 'key3'); // Hit
      await enhancedCache.get('test', 'key4'); // Miss

      const stats = enhancedCache.getStats();
      expect(stats.hitRate).toBe(0.75); // 3 hits out of 4 total requests
    });

    test('should reset statistics', () => {
      // Perform some operations
      enhancedCache.stats.hits = 10;
      enhancedCache.stats.misses = 5;

      // Reset
      enhancedCache.resetStats();

      const stats = enhancedCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    test('should get performance metrics', async () => {
      const metrics = await enhancedCache.getPerformanceMetrics();

      expect(metrics).toHaveProperty('stats');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.stats).toHaveProperty('hits');
      expect(metrics.stats).toHaveProperty('misses');
      expect(metrics.stats).toHaveProperty('hitRate');
    });

    test('should perform health check', async () => {
      const health = await enhancedCache.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('stats');
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Cache Warmup', () => {
    test('should warm up cache with provided data', async () => {
      const mockFetch = jest.fn().mockResolvedValue('test-data');
      
      await enhancedCache.warmupCache([
        {
          namespace: 'test',
          identifier: 'warmup-key',
          fetchFunction: mockFetch,
          dataType: 'test',
          status: 'active'
        }
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(await enhancedCache.get('test', 'warmup-key')).toBe('test-data');
    });

    test('should not overwrite existing cache during warmup', async () => {
      const existingData = 'existing-value';
      const mockFetch = jest.fn().mockResolvedValue('new-value');

      // Pre-populate cache
      await enhancedCache.set('test', 'existing-key', existingData, 300);

      // Warmup should not overwrite
      await enhancedCache.warmupCache([
        {
          namespace: 'test',
          identifier: 'existing-key',
          fetchFunction: mockFetch,
          dataType: 'test'
        }
      ]);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(await enhancedCache.get('test', 'existing-key')).toBe(existingData);
    });
  });
});

describe('Cache Monitor Service', () => {
  beforeEach(() => {
    // Stop monitoring to avoid interference between tests
    cacheMonitor.stopMonitoring();
  });

  afterEach(() => {
    // Clean up after each test
    cacheMonitor.stopMonitoring();
    cacheMonitor.clearAlertHistory();
  });

  describe('Monitoring Control', () => {
    test('should start and stop monitoring', () => {
      expect(cacheMonitor.getMonitoringStatus().isMonitoring).toBe(false);

      cacheMonitor.startMonitoring();
      expect(cacheMonitor.getMonitoringStatus().isMonitoring).toBe(true);

      cacheMonitor.stopMonitoring();
      expect(cacheMonitor.getMonitoringStatus().isMonitoring).toBe(false);
    });

    test('should not start monitoring if already running', () => {
      cacheMonitor.startMonitoring();
      const status1 = cacheMonitor.getMonitoringStatus();

      cacheMonitor.startMonitoring(); // Should not cause issues
      const status2 = cacheMonitor.getMonitoringStatus();

      expect(status1.isMonitoring).toBe(true);
      expect(status2.isMonitoring).toBe(true);
    });
  });

  describe('Alert Generation', () => {
    test('should generate alerts for low hit rate', async () => {
      // Mock low hit rate scenario
      enhancedCache.stats.hits = 30;
      enhancedCache.stats.misses = 70; // 30% hit rate

      const healthResult = await cacheMonitor.performHealthCheck();
      
      expect(healthResult.alerts).toHaveLength(1);
      expect(healthResult.alerts[0].type).toBe('low_hit_rate');
      expect(healthResult.alerts[0].severity).toBe('medium');
    });

    test('should generate alerts for high error rate', async () => {
      // Mock high error rate scenario
      enhancedCache.stats.hits = 80;
      enhancedCache.stats.misses = 15;
      enhancedCache.stats.errors = 5; // ~5% error rate

      const healthResult = await cacheMonitor.performHealthCheck();
      
      expect(healthResult.alerts).toHaveLength(1);
      expect(healthResult.alerts[0].type).toBe('high_error_rate');
      expect(healthResult.alerts[0].severity).toBe('high');
    });

    test('should store alerts in history', async () => {
      // Generate an alert
      enhancedCache.stats.hits = 20;
      enhancedCache.stats.misses = 80; // 20% hit rate

      await cacheMonitor.performHealthCheck();
      
      const alerts = cacheMonitor.getRecentAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('low_hit_rate');
      expect(alerts[0]).toHaveProperty('id');
      expect(alerts[0]).toHaveProperty('timestamp');
    });

    test('should limit alert history size', async () => {
      // Generate more alerts than the maximum
      for (let i = 0; i < 150; i++) {
        enhancedCache.stats.hits = 20;
        enhancedCache.stats.misses = 80;
        await cacheMonitor.performHealthCheck();
      }

      const alertHistory = cacheMonitor.getRecentAlerts();
      expect(alertHistory.length).toBeLessThanOrEqual(100); // Max alert history
    });
  });

  describe('Performance Reporting', () => {
    test('should generate performance report', async () => {
      // Set up some test data
      enhancedCache.stats.hits = 70;
      enhancedCache.stats.misses = 30;
      enhancedCache.stats.errors = 2;

      const report = await cacheMonitor.generatePerformanceReport('24h');

      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recommendations');

      expect(report.performance.hitRate).toBe(0.7);
      expect(report.alerts.total).toBeGreaterThanOrEqual(0);
    });

    test('should generate recommendations based on metrics', async () => {
      // Set up poor performance scenario
      enhancedCache.stats.hits = 30;
      enhancedCache.stats.misses = 70; // 30% hit rate
      enhancedCache.stats.errors = 10; // High error rate

      const report = await cacheMonitor.generatePerformanceReport();

      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);

      // Should have performance recommendation for low hit rate
      const hitRateRec = report.recommendations.find(r => r.type === 'performance');
      expect(hitRateRec).toBeDefined();
      expect(hitRateRec.priority).toBe('high');

      // Should have reliability recommendation for high error rate
      const errorRec = report.recommendations.find(r => r.type === 'reliability');
      expect(errorRec).toBeDefined();
      expect(errorRec.priority).toBe('critical');
    });
  });

  describe('Threshold Management', () => {
    test('should update alert thresholds', () => {
      const newThresholds = {
        hitRate: 0.8,
        memoryUsage: 0.9,
        errorRate: 0.1
      };

      cacheMonitor.updateThresholds(newThresholds);

      const status = cacheMonitor.getMonitoringStatus();
      expect(status.alertThresholds.hitRate).toBe(0.8);
      expect(status.alertThresholds.memoryUsage).toBe(0.9);
      expect(status.alertThresholds.errorRate).toBe(0.1);
    });

    test('should merge thresholds with existing ones', () => {
      const originalThresholds = cacheMonitor.getMonitoringStatus().alertThresholds;

      cacheMonitor.updateThresholds({ hitRate: 0.85 });

      const updatedThresholds = cacheMonitor.getMonitoringStatus().alertThresholds;
      expect(updatedThresholds.hitRate).toBe(0.85);
      expect(updatedThresholds.memoryUsage).toBe(originalThresholds.memoryUsage);
      expect(updatedThresholds.errorRate).toBe(originalThresholds.errorRate);
    });
  });

  describe('Alert Filtering', () => {
    beforeEach(async () => {
      // Set up some test alerts
      enhancedCache.stats.hits = 20;
      enhancedCache.stats.misses = 80;
      await cacheMonitor.performHealthCheck(); // Generate low hit rate alert

      enhancedCache.stats.errors = 5;
      await cacheMonitor.performHealthCheck(); // Generate high error rate alert
    });

    test('should filter alerts by severity', () => {
      const highSeverityAlerts = cacheMonitor.getAlertsBySeverity('high');
      const mediumSeverityAlerts = cacheMonitor.getAlertsBySeverity('medium');

      expect(highSeverityAlerts.length).toBe(1);
      expect(mediumSeverityAlerts.length).toBe(1);
    });

    test('should filter alerts by type', () => {
      const hitRateAlerts = cacheMonitor.getAlertsByType('low_hit_rate');
      const errorAlerts = cacheMonitor.getAlertsByType('high_error_rate');

      expect(hitRateAlerts.length).toBe(1);
      expect(errorAlerts.length).toBe(1);
    });

    test('should get recent alerts within time range', () => {
      const recentAlerts = cacheMonitor.getRecentAlerts(1); // Last 1 hour
      const allAlerts = cacheMonitor.getRecentAlerts(24); // Last 24 hours

      expect(recentAlerts.length).toBeLessThanOrEqual(allAlerts.length);
    });
  });
});

describe('Cache Integration Tests', () => {
  test('should handle cache failures gracefully', async () => {
    // Mock a cache failure
    const originalSet = enhancedCache.set;
    enhancedCache.set = jest.fn().mockRejectedValue(new Error('Cache error'));

    try {
      await enhancedCache.set('test', 'key', 'value', 300);
      // Should not throw
    } catch (error) {
      expect(error.message).toBe('Cache error');
    }

    // Restore original method
    enhancedCache.set = originalSet;
    
    // Stats should track the error
    const stats = enhancedCache.getStats();
    expect(stats.errors).toBeGreaterThan(0);
  });

  test('should maintain cache consistency across operations', async () => {
    const key = 'consistency-test';
    const value = { data: 'test', version: 1 };

    // Set value
    await enhancedCache.set('test', key, value, 300);

    // Get value multiple times
    const result1 = await enhancedCache.get('test', key);
    const result2 = await enhancedCache.get('test', key);
    const result3 = await enhancedCache.get('test', key);

    expect(result1).toEqual(value);
    expect(result2).toEqual(value);
    expect(result3).toEqual(value);
  });

  test('should handle concurrent operations safely', async () => {
    const promises = [];

    // Create multiple concurrent operations
    for (let i = 0; i < 10; i++) {
      promises.push(
        enhancedCache.set('concurrent', `key-${i}`, `value-${i}`, 300)
      );
    }

    // All operations should complete without errors
    await Promise.all(promises);

    // Verify all values are cached
    for (let i = 0; i < 10; i++) {
      const value = await enhancedCache.get('concurrent', `key-${i}`);
      expect(value).toBe(`value-${i}`);
    }
  });
});
