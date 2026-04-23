const { Server } = require('stellar-sdk');
const { logger } = require('../middleware');

class MonitoringService {
  constructor() {
    this.server = new Server(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org');
    this.contractAddress = process.env.DID_CONTRACT_ADDRESS;
    this.wsManager = null;
    this.closeStream = null;
    this.alerts = [];
    this.transactionHistory = [];
    
    // Configurable thresholds
    this.HIGH_VOLUME_THRESHOLD = 10;
    this.TIME_WINDOW_MS = 60 * 1000; // 1 minute
  }

  setWsManager(wsManager) {
    this.wsManager = wsManager;
  }

  startMonitoring() {
    if (!this.contractAddress) {
      logger.warn('DID_CONTRACT_ADDRESS not set. MonitoringService is inactive.');
      return;
    }

    logger.info(`Starting contract monitoring for address: ${this.contractAddress}`);

    this.closeStream = this.server.transactions()
      .forAccount(this.contractAddress)
      .cursor('now')
      .stream({
        onmessage: (transaction) => this.handleTransaction(transaction),
        onerror: (error) => {
          logger.error('Error in monitoring stream:', error);
        }
      });
  }

  stopMonitoring() {
    if (this.closeStream) {
      this.closeStream();
      this.closeStream = null;
      logger.info('Monitoring stream stopped.');
    }
  }

  getAlerts() {
    return this.alerts;
  }

  handleTransaction(transaction) {
    logger.debug(`Monitoring: Received transaction ${transaction.hash}`);
    const now = Date.now();

    // 1. Detect Failed Transactions
    if (!transaction.successful) {
      this.createAlert({
        type: 'FAILED_TRANSACTION',
        severity: 'high',
        message: `Failed transaction detected targeting the contract`,
        transactionHash: transaction.hash,
        sourceAccount: transaction.source_account,
        timestamp: new Date(now)
      });
    }

    // 2. High Volume Detection
    this.transactionHistory.push({ hash: transaction.hash, timestamp: now });
    
    // Clean up old transactions from history
    this.transactionHistory = this.transactionHistory.filter(
      (tx) => now - tx.timestamp < this.TIME_WINDOW_MS
    );

    if (this.transactionHistory.length > this.HIGH_VOLUME_THRESHOLD) {
      this.createAlert({
        type: 'HIGH_VOLUME',
        severity: 'medium',
        message: `High volume of transactions detected: ${this.transactionHistory.length} transactions in the last minute.`,
        timestamp: new Date(now)
      });
      // Reset history to avoid spamming alerts every single tx
      this.transactionHistory = [];
    }
  }

  createAlert(alertData) {
    const alert = {
      id: `alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ...alertData
    };

    // Store alert in memory (keep only last 100)
    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts.pop();
    }

    logger.warn(`[CONTRACT ALERT] ${alert.type}: ${alert.message}`);

    // Broadcast via WebSocket
    if (this.wsManager) {
      this.wsManager.broadcast('contract:alert', alert);
    }
  }
}

module.exports = new MonitoringService();
