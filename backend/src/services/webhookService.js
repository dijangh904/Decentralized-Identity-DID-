const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const { logger } = require('../middleware');

class WebhookService {
  /**
   * Triggers webhooks for a specific event
   * @param {string} event The event name
   * @param {object} data The event payload
   */
  async trigger(event, data) {
    try {
      const webhooks = await Webhook.find({ events: event, active: true });
      
      const deliveries = webhooks.map(webhook => this.deliver(webhook, event, data));
      await Promise.allSettled(deliveries);
    } catch (error) {
      logger.error('Error triggering webhooks:', error);
    }
  }

  /**
   * Delivers a single webhook with retry logic and signature
   */
  async deliver(webhook, event, data, attempt = 1) {
    const payload = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
      webhookId: webhook._id,
    });

    const signature = this.generateSignature(payload, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Attempt': attempt.toString(),
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      logger.info(`Webhook delivered successfully: ${webhook.url} (Event: ${event})`);
    } catch (error) {
      logger.warn(`Webhook delivery failed: ${webhook.url} (Attempt ${attempt}/${webhook.retryConfig.maxRetries}): ${error.message}`);
      
      if (attempt < webhook.retryConfig.maxRetries) {
        const delay = webhook.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        setTimeout(() => this.deliver(webhook, event, data, attempt + 1), delay);
      } else {
        logger.error(`Webhook delivery failed after maximum retries: ${webhook.url}`);
      }
    }
  }

  /**
   * Generates a HMAC signature for the payload
   */
  generateSignature(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verifies a webhook signature (for client-side use or testing)
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

module.exports = new WebhookService();
