const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Refresh Token Schema for secure token storage and rotation
 */
const refreshTokenSchema = new mongoose.Schema({
  // Token identifier (hashed version of the actual token)
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User who owns this token
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session information
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Device and browser information
  deviceInfo: {
    userAgent: String,
    browser: String,
    os: String,
    device: String,
    ipAddress: String,
    location: {
      country: String,
      city: String,
      timezone: String
    }
  },
  
  // Token metadata
  tokenVersion: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Expiration and lifecycle
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  
  // Status
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  
  revokedAt: {
    type: Date
  },
  
  revokeReason: {
    type: String,
    enum: [
      'USER_LOGOUT',
      'SECURITY_BREACH',
      'TOKEN_ROTATION',
      'ACCOUNT_LOCKED',
      'PASSWORD_CHANGE',
      'ADMIN_REVOCATION',
      'SUSPICIOUS_ACTIVITY',
      'EXPIRED'
    ]
  },
  
  // Rotation tracking
  rotationCount: {
    type: Number,
    default: 0
  },
  
  parentTokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RefreshToken',
    default: null
  },
  
  childTokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RefreshToken',
    default: null
  },
  
  // Security metrics
  usageCount: {
    type: Number,
    default: 0
  },
  
  suspiciousActivity: {
    detected: {
      type: Boolean,
      default: false
    },
    reasons: [{
      type: String,
      enum: [
        'UNUSUAL_IP',
        'UNUSUAL_DEVICE',
        'RAPID_USAGE',
        'CONCURRENT_SESSIONS',
        'GEO_ANOMALY',
        'TIME_ANOMALY'
      ]
    }],
    detectedAt: Date,
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.tokenHash;
      return ret;
    }
  }
});

// Indexes for performance and security
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ sessionId: 1, isRevoked: 1 });
refreshTokenSchema.index({ expiresAt: 1, isRevoked: 1 });
refreshTokenSchema.index({ createdAt: -1 });
refreshTokenSchema.index({ 'suspiciousActivity.detected': 1 });

// TTL index for automatic cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
refreshTokenSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods

/**
 * Hash a refresh token for secure storage
 */
refreshTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Create a new refresh token
 */
refreshTokenSchema.statics.createToken = async function(tokenData) {
  const { token, userId, sessionId, deviceInfo, expiresAt } = tokenData;
  
  const tokenHash = this.hashToken(token);
  
  const refreshToken = new this({
    tokenHash,
    userId,
    sessionId,
    deviceInfo,
    expiresAt: new Date(expiresAt),
    tokenVersion: tokenData.tokenVersion || 0
  });
  
  return refreshToken.save();
};

/**
 * Find valid refresh token by hash
 */
refreshTokenSchema.statics.findValidToken = async function(tokenHash) {
  return this.findOne({
    tokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).populate('userId');
};

/**
 * Revoke token
 */
refreshTokenSchema.methods.revoke = function(reason = 'USER_LOGOUT') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokeReason = reason;
  return this.save();
};

/**
 * Mark as used
 */
refreshTokenSchema.methods.markAsUsed = function() {
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  return this.save();
};

/**
 * Detect suspicious activity
 */
refreshTokenSchema.methods.detectSuspiciousActivity = function(currentRequest) {
  const reasons = [];
  let riskScore = 0;
  
  // Check for unusual IP
  if (this.deviceInfo.ipAddress && currentRequest.ipAddress !== this.deviceInfo.ipAddress) {
    reasons.push('UNUSUAL_IP');
    riskScore += 30;
  }
  
  // Check for unusual device
  if (this.deviceInfo.userAgent && currentRequest.userAgent !== this.deviceInfo.userAgent) {
    reasons.push('UNUSUAL_DEVICE');
    riskScore += 25;
  }
  
  // Check for rapid usage (multiple requests in short time)
  const now = new Date();
  const timeDiff = now - this.lastUsedAt;
  if (timeDiff < 1000 && this.usageCount > 0) { // Less than 1 second since last use
    reasons.push('RAPID_USAGE');
    riskScore += 35;
  }
  
  // Check for concurrent sessions
  if (this.usageCount > 100) { // High usage count
    reasons.push('CONCURRENT_SESSIONS');
    riskScore += 20;
  }
  
  if (reasons.length > 0) {
    this.suspiciousActivity.detected = true;
    this.suspiciousActivity.reasons = reasons;
    this.suspiciousActivity.detectedAt = new Date();
    this.suspiciousActivity.riskScore = Math.min(riskScore, 100);
  }
  
  return this.suspiciousActivity.detected;
};

/**
 * Rotate token (create new one and revoke old)
 */
refreshTokenSchema.methods.rotate = async function(newTokenData) {
  const { token, expiresAt } = newTokenData;
  
  // Create new token as child
  const newTokenHash = this.constructor.hashToken(token);
  const newRefreshToken = new this.constructor({
    tokenHash: newTokenHash,
    userId: this.userId,
    sessionId: this.sessionId,
    deviceInfo: this.deviceInfo,
    expiresAt: new Date(expiresAt),
    tokenVersion: this.tokenVersion,
    parentTokenId: this._id,
    rotationCount: this.rotationCount + 1
  });
  
  // Save new token
  await newRefreshToken.save();
  
  // Link parent to child
  this.childTokenId = newRefreshToken._id;
  
  // Revoke old token
  await this.revoke('TOKEN_ROTATION');
  
  return newRefreshToken;
};

/**
 * Revoke all tokens for user
 */
refreshTokenSchema.statics.revokeAllForUser = async function(userId, reason = 'SECURITY_BREACH') {
  return this.updateMany(
    { 
      userId, 
      isRevoked: false 
    },
    { 
      $set: { 
        isRevoked: true, 
        revokedAt: new Date(), 
        revokeReason: reason 
      } 
    }
  );
};

/**
 * Revoke all tokens for session
 */
refreshTokenSchema.statics.revokeAllForSession = async function(sessionId, reason = 'USER_LOGOUT') {
  return this.updateMany(
    { 
      sessionId, 
      isRevoked: false 
    },
    { 
      $set: { 
        isRevoked: true, 
        revokedAt: new Date(), 
        revokeReason: reason 
      } 
    }
  );
};

/**
 * Cleanup expired tokens
 */
refreshTokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result.deletedCount;
};

/**
 * Get token statistics
 */
refreshTokenSchema.statics.getStatistics = async function(userId = null) {
  const matchCondition = userId ? { userId } : {};
  
  const stats = await this.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: 1 },
        activeTokens: {
          $sum: { $cond: [{ $eq: ['$isRevoked', false] }, 1, 0] }
        },
        revokedTokens: {
          $sum: { $cond: [{ $eq: ['$isRevoked', true] }, 1, 0] }
        },
        suspiciousTokens: {
          $sum: { $cond: [{ $eq: ['$suspiciousActivity.detected', true] }, 1, 0] }
        },
        avgUsageCount: { $avg: '$usageCount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalTokens: 0,
    activeTokens: 0,
    revokedTokens: 0,
    suspiciousTokens: 0,
    avgUsageCount: 0
  };
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
