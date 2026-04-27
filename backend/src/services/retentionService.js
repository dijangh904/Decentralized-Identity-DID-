const cron = require('node-cron');
const mongoose = require('mongoose');
const { logger } = require('../middleware');

class RetentionService {
  constructor() {
    this.policies = [
      {
        name: 'Logs Cleanup',
        modelName: 'Log', // Assuming a Log model exists
        retentionDays: 30,
        cronSchedule: '0 0 * * *' // Daily at midnight
      },
      {
        name: 'Expired API Keys Cleanup',
        modelName: 'ApiKey',
        retentionDays: 90,
        condition: { status: 'revoked' },
        cronSchedule: '0 1 * * 0' // Weekly on Sunday at 1 AM
      },
      {
        name: 'Old Webhook Deliveries',
        modelName: 'WebhookDelivery',
        retentionDays: 14,
        cronSchedule: '0 2 * * *'
      }
    ];
  }

  /**
   * Initialize retention jobs
   */
  init() {
    logger.info('Initializing data retention service');
    
    this.policies.forEach(policy => {
      cron.schedule(policy.cronSchedule, () => {
        this.runCleanup(policy);
      });
      logger.info(`Scheduled retention job: ${policy.name} (${policy.cronSchedule})`);
    });
  }

  /**
   * Run cleanup for a specific policy
   */
  async runCleanup(policy) {
    try {
      logger.info(`Starting cleanup for: ${policy.name}`);
      
      const Model = mongoose.models[policy.modelName];
      if (!Model) {
        logger.warn(`Model ${policy.modelName} not found, skipping cleanup`);
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const query = {
        createdAt: { $lt: cutoffDate },
        ...(policy.condition || {})
      };

      const result = await Model.deleteMany(query);
      
      logger.info(`Cleanup finished for ${policy.name}: Deleted ${result.deletedCount} documents`);
    } catch (error) {
      logger.error(`Error during cleanup for ${policy.name}: ${error.message}`);
    }
  }

  /**
   * Manually trigger all cleanups
   */
  async runAllCleanups() {
    for (const policy of this.policies) {
      await this.runCleanup(policy);
    }
  }
}

module.exports = new RetentionService();
