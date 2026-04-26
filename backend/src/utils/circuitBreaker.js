const CircuitBreaker = require('opossum');
const { logger } = require('../middleware');

const options = {
  timeout: 5000, // If our function takes longer than 5 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 30000 // After 30 seconds, try again.
};

/**
 * Creates a circuit breaker for a given function
 * @param {Function} fn - The function to wrap
 * @param {Object} customOptions - Overrides for default options
 * @returns {CircuitBreaker}
 */
const createBreaker = (fn, customOptions = {}) => {
  const breaker = new CircuitBreaker(fn, { ...options, ...customOptions });

  breaker.on('open', () => {
    logger.warn(`Circuit breaker OPEN for ${fn.name || 'anonymous function'}`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker HALF_OPEN for ${fn.name || 'anonymous function'}`);
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker CLOSED for ${fn.name || 'anonymous function'}`);
  });

  breaker.on('fallback', (result) => {
    logger.info(`Circuit breaker FALLBACK triggered for ${fn.name || 'anonymous function'}`);
  });

  return breaker;
};

module.exports = { createBreaker };
