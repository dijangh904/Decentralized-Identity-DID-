const express = require('express');
const router = express.Router();
const { credentialVerificationQueue, blockchainInteractionQueue, crossChainBridgeQueue } = require('../../config/queue');
const { logger } = require('../../middleware');

/**
 * @route   GET /api/v1/jobs/:jobId
 * @desc    Get job status by ID
 * @access  Public
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Try to find the job in all queues
    const queues = [credentialVerificationQueue, blockchainInteractionQueue, crossChainBridgeQueue];
    let job = null;
    let queueName = null;
    
    for (const queue of queues) {
      try {
        job = await queue.getJob(jobId);
        if (job) {
          queueName = queue.name;
          break;
        }
      } catch (err) {
        // Job not found in this queue, continue
      }
    }
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    const state = await job.getState();
    const progress = job.progress();
    
    res.json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        queue: queueName,
        state,
        progress,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        createdAt: job.timestamp
      }
    });
  } catch (error) {
    logger.error('Error fetching job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job status'
    });
  }
});

/**
 * @route   GET /api/v1/jobs/:jobId/result
 * @desc    Get job result (waits if job is not complete)
 * @access  Public
 */
router.get('/:jobId/result', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { timeout = 30000 } = req.query;
    
    // Try to find the job in all queues
    const queues = [credentialVerificationQueue, blockchainInteractionQueue, crossChainBridgeQueue];
    let job = null;
    
    for (const queue of queues) {
      try {
        job = await queue.getJob(jobId);
        if (job) break;
      } catch (err) {
        // Job not found in this queue, continue
      }
    }
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    const result = await job.finished(parseInt(timeout));
    
    if (result instanceof Error) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching job result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job result'
    });
  }
});

/**
 * @route   DELETE /api/v1/jobs/:jobId
 * @desc    Cancel a job
 * @access  Public
 */
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Try to find the job in all queues
    const queues = [credentialVerificationQueue, blockchainInteractionQueue, crossChainBridgeQueue];
    let job = null;
    
    for (const queue of queues) {
      try {
        job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          break;
        }
      } catch (err) {
        // Job not found in this queue, continue
      }
    }
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel job'
    });
  }
});

/**
 * @route   GET /api/v1/jobs/queue/:queueName/stats
 * @desc    Get queue statistics
 * @access  Public
 */
router.get('/queue/:queueName/stats', async (req, res) => {
  try {
    const { queueName } = req.params;
    
    let queue;
    switch (queueName) {
      case 'credential-verification':
        queue = credentialVerificationQueue;
        break;
      case 'blockchain-interaction':
        queue = blockchainInteractionQueue;
        break;
      case 'cross-chain-bridge':
        queue = crossChainBridgeQueue;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid queue name'
        });
    }
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);
    
    res.json({
      success: true,
      data: {
        queue: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed
      }
    });
  } catch (error) {
    logger.error('Error fetching queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue statistics'
    });
  }
});

module.exports = router;
