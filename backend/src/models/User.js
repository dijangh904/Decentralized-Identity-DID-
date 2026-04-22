const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * User Schema for authentication and DID management
 */
const userSchema = new mongoose.Schema({
  // Basic user information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() { return !this.walletAddress; }, // Password optional if using wallet auth
    minlength: 8,
    select: false // Don't include password in queries by default
  },
  
  // Stellar wallet integration
  walletAddress: {
    type: String,
    required: function() { return !this.password; }, // Wallet required if no password
    match: [/^G[A-Z0-9]{55}$/, 'Please enter a valid Stellar public key']
  },
  privateKey: {
    type: String,
    required: false, // Optional - may be stored client-side only
    select: false
  },
  
  // User profile
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatar: { type: String },
    bio: { type: String, maxlength: 500 }
  },
  
  // Authentication status
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Roles and permissions
  roles: [{
    type: String,
    enum: ['USER', 'ADMIN', 'VERIFIER', 'ISSUER'],
    default: 'USER'
  }],
  
  // DID ownership
  ownedDIDs: [{
    type: String,
    ref: 'DID'
  }],
  
  // Security settings
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    lastPasswordChange: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    loginSessions: [{
      sessionId: String,
      deviceInfo: String,
      ipAddress: String,
      userAgent: String,
      createdAt: { type: Date, default: Date.now },
      lastActive: { type: Date, default: Date.now }
    }]
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.privateKey;
      delete ret.security.twoFactorSecret;
      return ret;
    }
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ 'security.loginSessions.sessionId': 1 });
userSchema.index({ createdAt: -1 });

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.security.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods

/**
 * Compare password for authentication
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate access token
 */
userSchema.methods.generateAccessToken = function() {
  const payload = {
    userId: this._id,
    email: this.email,
    walletAddress: this.walletAddress,
    roles: this.roles,
    type: 'access'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    issuer: 'stellar-did-platform',
    audience: 'stellar-did-users'
  });
};

/**
 * Generate refresh token payload (token itself is stored separately)
 */
userSchema.methods.generateRefreshTokenPayload = function() {
  const payload = {
    userId: this._id,
    tokenVersion: this.security.tokenVersion || 0,
    type: 'refresh'
  };
  
  return {
    token: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'stellar-did-platform',
      audience: 'stellar-did-users'
    }),
    payload
  };
};

/**
 * Check if account is locked
 */
userSchema.methods.isLocked = function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
};

/**
 * Increment failed login attempts
 */
userSchema.methods.incFailedLogin = function() {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = parseInt(process.env.LOCK_TIME) || 2 * 60 * 60 * 1000; // 2 hours
  
  this.security.failedLoginAttempts += 1;
  
  if (this.security.failedLoginAttempts >= maxAttempts) {
    this.security.lockUntil = new Date(Date.now() + lockTime);
  }
  
  return this.save();
};

/**
 * Reset failed login attempts on successful login
 */
userSchema.methods.resetFailedLogin = function() {
  this.security.failedLoginAttempts = 0;
  this.security.lockUntil = undefined;
  this.lastLoginAt = new Date();
  return this.save();
};

/**
 * Add login session
 */
userSchema.methods.addLoginSession = function(sessionData) {
  const session = {
    sessionId: sessionData.sessionId,
    deviceInfo: sessionData.deviceInfo,
    ipAddress: sessionData.ipAddress,
    userAgent: sessionData.userAgent,
    createdAt: new Date(),
    lastActive: new Date()
  };
  
  this.security.loginSessions.push(session);
  
  // Keep only last 10 sessions
  if (this.security.loginSessions.length > 10) {
    this.security.loginSessions = this.security.loginSessions
      .sort((a, b) => b.lastActive - a.lastActive)
      .slice(0, 10);
  }
  
  return this.save();
};

/**
 * Remove login session
 */
userSchema.methods.removeLoginSession = function(sessionId) {
  this.security.loginSessions = this.security.loginSessions
    .filter(session => session.sessionId !== sessionId);
  return this.save();
};

/**
 * Update session activity
 */
userSchema.methods.updateSessionActivity = function(sessionId) {
  const session = this.security.loginSessions
    .find(s => s.sessionId === sessionId);
  
  if (session) {
    session.lastActive = new Date();
    return this.save();
  }
  
  return Promise.resolve(this);
};

/**
 * Increment token version (invalidates all refresh tokens)
 */
userSchema.methods.incrementTokenVersion = function() {
  if (!this.security.tokenVersion) {
    this.security.tokenVersion = 0;
  }
  this.security.tokenVersion += 1;
  return this.save();
};

// Static methods

/**
 * Find user by email or wallet address
 */
userSchema.statics.findByEmailOrWallet = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { walletAddress: identifier }
    ]
  }).select('+password');
};

/**
 * Find user with refresh token
 */
userSchema.statics.findWithRefreshToken = function(userId) {
  return this.findById(userId)
    .select('+security.tokenVersion')
    .populate('ownedDIDs');
};

module.exports = mongoose.model('User', userSchema);
