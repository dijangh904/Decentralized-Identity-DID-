const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const { logger } = require('../middleware');

/**
 * @swagger
 * /api/v1/monitoring/alerts:
 *   get:
 *     summary: Get contract monitoring alerts
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: A list of recent alerts
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = monitoringService.getAlerts();
    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/status:
 *   get:
 *     summary: Get monitoring service status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Status of the monitoring service
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    active: !!monitoringService.closeStream,
    contractAddress: monitoringService.contractAddress,
    totalAlerts: monitoringService.alerts.length
  });
});

module.exports = router;
