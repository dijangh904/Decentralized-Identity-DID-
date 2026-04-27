const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true,
    index: true
  },
  permissions: {
    type: [String],
    default: ['read']
  },
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active'
  },
  expiresAt: {
    type: Date
  },
  lastUsedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to generate a new key
apiKeySchema.statics.generateKey = function() {
  return crypto.randomBytes(32).toString('hex');
};

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
