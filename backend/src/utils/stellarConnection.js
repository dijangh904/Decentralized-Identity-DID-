const StellarSDK = require('stellar-sdk');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const CircuitBreaker = require('opossum');
const { logger } = require('../middleware');

class StellarConnectionManager {
  constructor() {
    this.horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    
    // Configure axios with retry logic
    this.axiosInstance = axios.create();
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
      },
      onRetry: (retryCount, error) => {
        logger.warn(`Retrying Stellar Horizon request (${retryCount}): ${error.message}`);
      }
    });

    // Initialize Horizon server with custom axios instance
    this.server = new StellarSDK.Horizon.Server(this.horizonUrl, {
      allowHttp: true,
      appName: 'stellar-did-platform'
    });

    // Circuit Breaker options
    const breakerOptions = {
      timeout: 10000, // If our function takes longer than 10 seconds, trigger a failure
      errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
      resetTimeout: 30000 // After 30 seconds, try again
    };

    // Create circuit breakers for common operations
    this.loadAccountBreaker = new CircuitBreaker(this._loadAccount.bind(this), breakerOptions);
    this.submitTransactionBreaker = new CircuitBreaker(this._submitTransaction.bind(this), breakerOptions);

    this.loadAccountBreaker.on('open', () => logger.error('Stellar LoadAccount Circuit Breaker OPEN'));
    this.loadAccountBreaker.on('halfOpen', () => logger.info('Stellar LoadAccount Circuit Breaker HALF_OPEN'));
    this.loadAccountBreaker.on('close', () => logger.info('Stellar LoadAccount Circuit Breaker CLOSED'));

    // Network setup
    if (process.env.STELLAR_NETWORK === 'PUBLIC') {
      StellarSDK.Network.usePublicNetwork();
    } else {
      StellarSDK.Network.useTestNetwork();
    }
  }

  async _loadAccount(publicKey) {
    return await this.server.loadAccount(publicKey);
  }

  async _submitTransaction(transaction) {
    return await this.server.submitTransaction(transaction);
  }

  /**
   * Load account with circuit breaker and retries
   */
  async loadAccount(publicKey) {
    try {
      return await this.loadAccountBreaker.fire(publicKey);
    } catch (error) {
      logger.error(`Failed to load Stellar account ${publicKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit transaction with circuit breaker and retries
   */
  async submitTransaction(transaction) {
    try {
      return await this.submitTransactionBreaker.fire(transaction);
    } catch (error) {
      logger.error(`Failed to submit Stellar transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get server instance
   */
  getServer() {
    return this.server;
  }
}

module.exports = new StellarConnectionManager();
