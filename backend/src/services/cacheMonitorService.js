const enhancedCache = require('./enhancedCacheService');
const { logger } = require('../middleware');

/**
 * Cache Monitoring Service for performance tracking and health monitoring
 */
class CacheMonitorService {
  constructor() {
    this.monitoringInterval = 60000; // 1 minute
    this.alertThresholds = {
      hitRate: 0.7,      // Alert if hit rate below 70%
      memoryUsage: 0.8,   // Alert if memory usage above 80%
      errorRate: 0.05,    // Alert if error rate above 5%
      responseTime: 1000   // Alert if response time above 1 second
    };
    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.alertHistory = [];
    this.maxAlertHistory = 100;
  }

  /**
   * Start cache monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Cache monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting cache monitoring...');

    // Start periodic monitoring
    this.monitoringTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.monitoringInterval);

    // Perform initial health check
    this.performHealthCheck();
  }

  /**
   * Stop cache monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      logger.warn('Cache monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    logger.info('Cache monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    try {
      const startTime = Date.now();
      
      // Get cache metrics
      const metrics = await enhancedCache.getPerformanceMetrics();
      const healthCheck = await enhancedCache.healthCheck();
      
      const responseTime = Date.now() - startTime;
      
      // Analyze metrics and generate alerts
      const alerts = this.analyzeMetrics(metrics, responseTime);
      
      // Log metrics
      logger.debug('Cache health check completed:', {
        status: healthCheck.status,
        hitRate: metrics.stats.hitRate,
        memoryUsage: metrics.memory.usedMemoryHuman,
        responseTime,
        alerts: alerts.length
      });

      // Store alerts
      if (alerts.length > 0) {
        this.storeAlerts(alerts);
        await this.sendAlerts(alerts);
      }

      return {
        status: healthCheck.status,
        metrics,
        alerts,
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error during cache health check:', error);
      
      const alert = {
        type: 'monitoring_error',
        severity: 'high',
        message: 'Cache monitoring error',
        details: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.storeAlerts([alert]);
      await this.sendAlerts([alert]);
      
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze cache metrics and generate alerts
   */
  analyzeMetrics(metrics, responseTime) {
    const alerts = [];
    const { stats, memory } = metrics;

    // Check hit rate
    if (stats.hitRate < this.alertThresholds.hitRate) {
      alerts.push({
        type: 'low_hit_rate',
        severity: 'medium',
        message: `Cache hit rate is low: ${stats.hitRate}%`,
        details: {
          hitRate: stats.hitRate,
          hits: stats.hits,
          misses: stats.misses
        }
      });
    }

    // Check memory usage (if available)
    if (memory.usedMemory && memory.peakMemory) {
      const memoryUsageRatio = memory.usedMemory / memory.peakMemory;
      if (memoryUsageRatio > this.alertThresholds.memoryUsage) {
        alerts.push({
          type: 'high_memory_usage',
          severity: 'high',
          message: `Cache memory usage is high: ${memory.usedMemoryHuman}`,
          details: {
            usedMemory: memory.usedMemoryHuman,
            peakMemory: memory.peakMemoryHuman,
            usageRatio: Math.round(memoryUsageRatio * 100) / 100
          }
        });
      }
    }

    // Check error rate
    const totalRequests = stats.hits + stats.misses + stats.errors;
    if (totalRequests > 0) {
      const errorRate = stats.errors / totalRequests;
      if (errorRate > this.alertThresholds.errorRate) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'high',
          message: `Cache error rate is high: ${Math.round(errorRate * 100)}%`,
          details: {
            errorRate: Math.round(errorRate * 100) / 100,
            errors: stats.errors,
            totalRequests
          }
        });
      }
    }

    // Check response time
    if (responseTime > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'slow_response',
        severity: 'medium',
        message: `Cache response time is slow: ${responseTime}ms`,
        details: {
          responseTime,
          threshold: this.alertThresholds.responseTime
        }
      });
    }

    return alerts;
  }

  /**
   * Store alerts in history
   */
  storeAlerts(alerts) {
    alerts.forEach(alert => {
      this.alertHistory.push({
        ...alert,
        id: this.generateAlertId(),
        timestamp: alert.timestamp || new Date().toISOString()
      });
    });

    // Trim alert history if it exceeds maximum
    if (this.alertHistory.length > this.maxAlertHistory) {
      this.alertHistory = this.alertHistory.slice(-this.maxAlertHistory);
    }
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send alerts (can be extended to send to external systems)
   */
  async sendAlerts(alerts) {
    try {
      for (const alert of alerts) {
        logger.warn('Cache alert:', {
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details
        });

        // Here you could integrate with external alerting systems
        // await this.sendToSlack(alert);
        // await this.sendToEmail(alert);
        // await this.sendToPagerDuty(alert);
      }
    } catch (error) {
      logger.error('Error sending cache alerts:', error);
    }
  }

  /**
   * Get cache statistics and health summary
   */
  async getCacheSummary() {
    try {
      const metrics = await enhancedCache.getPerformanceMetrics();
      const healthCheck = await enhancedCache.performHealthCheck();
      
      return {
        status: healthCheck.status,
        metrics,
        alerts: this.getRecentAlerts(),
        summary: {
          totalAlerts: this.alertHistory.length,
          recentAlerts: this.getRecentAlerts(24).length, // Last 24 hours
          criticalAlerts: this.getAlertsBySeverity('high').length
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting cache summary:', error);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get recent alerts within specified hours
   */
  getRecentAlerts(hours = 24) {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.alertHistory.filter(alert => new Date(alert.timestamp) > cutoffTime);
  }

  /**
   * Get alerts by severity level
   */
  getAlertsBySeverity(severity) {
    return this.alertHistory.filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type) {
    return this.alertHistory.filter(alert => alert.type === type);
  }

  /**
   * Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory = [];
    logger.info('Cache alert history cleared');
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds) {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...newThresholds
    };
    logger.info('Cache alert thresholds updated:', this.alertThresholds);
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      monitoringInterval: this.monitoringInterval,
      alertThresholds: this.alertThresholds,
      alertHistorySize: this.alertHistory.length,
      lastHealthCheck: this.alertHistory.length > 0 
        ? this.alertHistory[this.alertHistory.length - 1].timestamp 
        : null
    };
  }

  /**
   * Generate cache performance report
   */
  async generatePerformanceReport(timeRange = '24h') {
    try {
      const summary = await this.getCacheSummary();
      const recentAlerts = this.getRecentAlerts();
      
      const report = {
        timeRange,
        generatedAt: new Date().toISOString(),
        status: summary.status,
        performance: {
          hitRate: summary.metrics.stats.hitRate,
          totalRequests: summary.metrics.stats.hits + summary.metrics.stats.misses + summary.metrics.stats.errors,
          cacheSize: summary.metrics.memory.usedMemoryHuman,
          peakMemory: summary.metrics.memory.peakMemoryHuman
        },
        alerts: {
          total: recentAlerts.length,
          critical: this.getAlertsBySeverity('high').length,
          medium: this.getAlertsBySeverity('medium').length,
          low: this.getAlertsBySeverity('low').length,
          byType: this.groupAlertsByType(recentAlerts)
        },
        recommendations: this.generateRecommendations(summary, recentAlerts)
      };

      logger.info('Cache performance report generated:', { timeRange, status: report.status });
      return report;
    } catch (error) {
      logger.error('Error generating performance report:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Group alerts by type
   */
  groupAlertsByType(alerts) {
    const grouped = {};
    alerts.forEach(alert => {
      if (!grouped[alert.type]) {
        grouped[alert.type] = 0;
      }
      grouped[alert.type]++;
    });
    return grouped;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(summary, alerts) {
    const recommendations = [];
    const { stats } = summary.metrics;

    // Hit rate recommendations
    if (stats.hitRate < 0.5) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Cache hit rate is very low. Consider increasing TTL for frequently accessed data.',
        action: 'Review caching strategies and data access patterns'
      });
    } else if (stats.hitRate < 0.7) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Cache hit rate could be improved. Analyze cache miss patterns.',
        action: 'Optimize cache keys and TTL strategies'
      });
    }

    // Memory usage recommendations
    if (summary.metrics.memory.usedMemory && summary.metrics.memory.peakMemory) {
      const memoryUsageRatio = summary.metrics.memory.usedMemory / summary.metrics.memory.peakMemory;
      if (memoryUsageRatio > 0.9) {
        recommendations.push({
          type: 'memory',
          priority: 'critical',
          message: 'Cache memory usage is critically high.',
          action: 'Consider increasing Redis memory or implementing cache eviction policies'
        });
      } else if (memoryUsageRatio > 0.8) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: 'Cache memory usage is high.',
          action: 'Monitor memory trends and plan for capacity increase'
        });
      }
    }

    // Error rate recommendations
    if (stats.errors > 0) {
      const errorRate = stats.errors / (stats.hits + stats.misses + stats.errors);
      if (errorRate > 0.1) {
        recommendations.push({
          type: 'reliability',
          priority: 'critical',
          message: 'Cache error rate is critically high.',
          action: 'Investigate Redis connectivity and performance issues'
        });
      } else if (errorRate > 0.05) {
        recommendations.push({
          type: 'reliability',
          priority: 'high',
          message: 'Cache error rate is elevated.',
          action: 'Check Redis logs and network connectivity'
        });
      }
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'high');
    if (criticalAlerts.length > 5) {
      recommendations.push({
        type: 'monitoring',
        priority: 'high',
        message: 'Multiple critical alerts detected.',
        action: 'Review alerting thresholds and investigate underlying issues'
      });
    }

    return recommendations;
  }
}

// Create singleton instance
const cacheMonitorService = new CacheMonitorService();

module.exports = cacheMonitorService;
