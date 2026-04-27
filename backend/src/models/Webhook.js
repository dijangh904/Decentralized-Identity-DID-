const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  events: [{
    type: String,
    enum: ['credential.issued', 'credential.revoked', 'credential.verified'],
    required: true,
  }],
  secret: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  retryConfig: {
    maxRetries: { type: Number, default: 3 },
    retryDelay: { type: Number, default: 1000 }, // ms
  },
  metadata: {
    type: Map,
    of: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Webhook', webhookSchema);
