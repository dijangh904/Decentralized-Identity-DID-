const Queue = require('bull');
const redis = require('../utils/redis');
const { logger } = require('../middleware');

// Queue configuration
const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0
  },
  defaultJobOptions: {
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600 // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600 // Keep failed jobs for 7 days
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
};

// Create queues
const credentialVerificationQueue = new Queue('credential-verification', queueConfig);
const blockchainInteractionQueue = new Queue('blockchain-interaction', queueConfig);
const crossChainBridgeQueue = new Queue('cross-chain-bridge', queueConfig);

// Error handling
const handleQueueError = (queue, queueName) => {
  queue.on('error', (error) => {
    logger.error(`Queue error (${queueName}):`, error);
  });

  queue.on('failed', (job, error) => {
    logger.error(`Job failed (${queueName}):`, {
      jobId: job.id,
      jobName: job.name,
      error: error.message,
      data: job.data
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job stalled (${queueName}):`, {
      jobId: job.id,
      jobName: job.name
    });
  });
};

handleQueueError(credentialVerificationQueue, 'credential-verification');
handleQueueError(blockchainInteractionQueue, 'blockchain-interaction');
handleQueueError(crossChainBridgeQueue, 'cross-chain-bridge');

// Event logging
credentialVerificationQueue.on('completed', (job, result) => {
  logger.info(`Credential verification job completed:`, {
    jobId: job.id,
    duration: job.finishedOn - job.processedOn
  });
});

blockchainInteractionQueue.on('completed', (job, result) => {
  logger.info(`Blockchain interaction job completed:`, {
    jobId: job.id,
    duration: job.finishedOn - job.processedOn
  });
});

crossChainBridgeQueue.on('completed', (job, result) => {
  logger.info(`Cross-chain bridge job completed:`, {
    jobId: job.id,
    duration: job.finishedOn - job.processedOn
  });
});

// Graceful shutdown
const closeQueues = async () => {
  logger.info('Closing queues...');
  await Promise.all([
    credentialVerificationQueue.close(),
    blockchainInteractionQueue.close(),
    crossChainBridgeQueue.close()
  ]);
  logger.info('Queues closed successfully');
};

// Handle process termination
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

module.exports = {
  credentialVerificationQueue,
  blockchainInteractionQueue,
  crossChainBridgeQueue,
  closeQueues
};
