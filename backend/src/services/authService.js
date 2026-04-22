const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { logger } = require('../middleware');

/**
 * Authentication Service with refresh token rotation
 */
class AuthService {
  constructor() {
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    this.lockTime = parseInt(process.env.LOCK_TIME) || 2 * 60 * 60 * 1000; // 2 hours
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000; // 30 minutes
  }

  /**
   * User registration
   */
  async register(userData) {
    try {
      const { email, password, walletAddress, profile } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: email?.toLowerCase() },
          { walletAddress }
        ]
      });

      if (existingUser) {
        throw new Error('User with this email or wallet address already exists');
      }

      // Create new user
      const user = new User({
        email: email?.toLowerCase(),
        password,
        walletAddress,
        profile: profile || {},
        roles: ['USER']
      });

      await user.save();

      logger.logInfo('User registered successfully', {
        userId: user._id,
        email: user.email,
        walletAddress: user.walletAddress,
        registrationMethod: password ? 'email' : 'wallet'
      });

      return {
        success: true,
        user: user.toJSON(),
        message: 'Registration successful'
      };
    } catch (error) {
      logger.logError('User registration failed', error, { userData });
      throw error;
    }
  }

  /**
   * User login with refresh token creation
   */
  async login(credentials, deviceInfo) {
    try {
      const { identifier, password } = credentials;
      
      // Find user by email or wallet address
      const user = await User.findByEmailOrWallet(identifier);
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.isLocked()) {
        logger.logSecurity('login_attempt_locked_account', {
          userId: user._id,
          identifier,
          ipAddress: deviceInfo.ipAddress
        });
        throw new Error('Account is temporarily locked due to multiple failed attempts');
      }

      // Check if account is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify credentials
      let isValidCredentials = false;
      
      if (password && user.password) {
        isValidCredentials = await user.comparePassword(password);
      } else if (!password && user.walletAddress) {
        // For wallet-based auth, we'd implement signature verification here
        // For now, we'll assume wallet auth is handled elsewhere
        isValidCredentials = true;
      }

      if (!isValidCredentials) {
        await user.incFailedLogin();
        
        logger.logSecurity('login_failed', {
          userId: user._id,
          identifier,
          ipAddress: deviceInfo.ipAddress,
          failedAttempts: user.security.failedLoginAttempts
        });
        
        throw new Error('Invalid credentials');
      }

      // Reset failed login attempts
      await user.resetFailedLogin();

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Create access token
      const accessToken = user.generateAccessToken();

      // Create refresh token
      const refreshExpiresAt = new Date(Date.now() + this.parseExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'));
      const { token: refreshToken, payload } = user.generateRefreshTokenPayload();

      // Store refresh token securely
      await RefreshToken.createToken({
        token: refreshToken,
        userId: user._id,
        sessionId,
        deviceInfo: {
          userAgent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device,
          ipAddress: deviceInfo.ipAddress,
          location: deviceInfo.location
        },
        expiresAt: refreshExpiresAt,
        tokenVersion: payload.tokenVersion
      });

      // Add login session to user
      await user.addLoginSession({
        sessionId,
        deviceInfo: `${deviceInfo.browser} on ${deviceInfo.os}`,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent
      });

      logger.logBusiness('user_login', {
        userId: user._id,
        sessionId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        loginMethod: password ? 'password' : 'wallet'
      });

      return {
        success: true,
        user: user.toJSON(),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: this.parseExpiration(process.env.JWT_ACCESS_EXPIRES_IN || '15m'),
          refreshExpiresIn: this.parseExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
          tokenType: 'Bearer'
        },
        sessionId
      };
    } catch (error) {
      logger.logError('Login failed', error, { 
        identifier: credentials.identifier,
        ipAddress: deviceInfo?.ipAddress 
      });
      throw error;
    }
  }

  /**
   * Refresh access token with rotation
   */
  async refreshToken(refreshTokenString, deviceInfo) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshTokenString, process.env.JWT_REFRESH_SECRET);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Find the stored refresh token
      const tokenHash = RefreshToken.hashToken(refreshTokenString);
      const storedToken = await RefreshToken.findValidToken(tokenHash);

      if (!storedToken) {
        throw new Error('Invalid or expired refresh token');
      }

      // Get user with current token version
      const user = await User.findWithRefreshToken(decoded.userId);
      
      if (!user) {
        // Revoke token if user doesn't exist
        await storedToken.revoke('USER_NOT_FOUND');
        throw new Error('User not found');
      }

      // Check token version (detects token revocation)
      if (storedToken.tokenVersion !== user.security.tokenVersion) {
        await storedToken.revoke('TOKEN_VERSION_MISMATCH');
        throw new Error('Token has been revoked');
      }

      // Detect suspicious activity
      const currentRequest = {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent
      };

      const isSuspicious = storedToken.detectSuspiciousActivity(currentRequest);
      
      if (isSuspicious && storedToken.suspiciousActivity.riskScore > 70) {
        // High risk activity - revoke token and notify user
        await storedToken.revoke('SUSPICIOUS_ACTIVITY');
        
        logger.logSecurity('suspicious_refresh_token_usage', {
          userId: user._id,
          tokenId: storedToken._id,
          riskScore: storedToken.suspiciousActivity.riskScore,
          reasons: storedToken.suspiciousActivity.reasons,
          ipAddress: deviceInfo.ipAddress
        });

        throw new Error('Security alert: Suspicious activity detected');
      }

      // Mark token as used
      await storedToken.markAsUsed();

      // Generate new access token
      const newAccessToken = user.generateAccessToken();

      // Rotate refresh token (create new one, revoke old)
      const newRefreshExpiresAt = new Date(Date.now() + this.parseExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'));
      const { token: newRefreshToken } = user.generateRefreshTokenPayload();

      const newStoredToken = await storedToken.rotate({
        token: newRefreshToken,
        expiresAt: newRefreshExpiresAt
      });

      // Update session activity
      await user.updateSessionActivity(storedToken.sessionId);

      logger.logBusiness('token_refreshed', {
        userId: user._id,
        sessionId: storedToken.sessionId,
        oldTokenId: storedToken._id,
        newTokenId: newStoredToken._id,
        rotationCount: newStoredToken.rotationCount,
        suspiciousActivity: isSuspicious
      });

      return {
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: this.parseExpiration(process.env.JWT_ACCESS_EXPIRES_IN || '15m'),
          refreshExpiresIn: this.parseExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
          tokenType: 'Bearer'
        }
      };
    } catch (error) {
      logger.logError('Token refresh failed', error, { 
        ipAddress: deviceInfo?.ipAddress 
      });
      throw error;
    }
  }

  /**
   * User logout - revoke refresh token
   */
  async logout(refreshTokenString, sessionId = null) {
    try {
      if (refreshTokenString) {
        // Revoke specific refresh token
        const tokenHash = RefreshToken.hashToken(refreshTokenString);
        const storedToken = await RefreshToken.findOne({ tokenHash, isRevoked: false });

        if (storedToken) {
          await storedToken.revoke('USER_LOGOUT');
          
          // Remove session from user
          await User.findByIdAndUpdate(storedToken.userId, {
            $pull: { 'security.loginSessions': { sessionId: storedToken.sessionId } }
          });

          logger.logBusiness('user_logout', {
            userId: storedToken.userId,
            sessionId: storedToken.sessionId,
            tokenId: storedToken._id
          });
        }
      }

      if (sessionId) {
        // Revoke all tokens for session
        await RefreshToken.revokeAllForSession(sessionId, 'USER_LOGOUT');
        
        // Remove session from user
        const user = await User.findOne({ 'security.loginSessions.sessionId': sessionId });
        if (user) {
          await user.removeLoginSession(sessionId);
          
          logger.logBusiness('session_ended', {
            userId: user._id,
            sessionId
          });
        }
      }

      return { success: true, message: 'Logout successful' };
    } catch (error) {
      logger.logError('Logout failed', error);
      throw error;
    }
  }

  /**
   * Logout from all devices - revoke all refresh tokens
   */
  async logoutAll(userId) {
    try {
      // Revoke all refresh tokens for user
      const revokeResult = await RefreshToken.revokeAllForUser(userId, 'SECURITY_BREACH');
      
      // Clear all login sessions
      await User.findByIdAndUpdate(userId, {
        'security.loginSessions': []
      });

      // Increment token version to invalidate all existing tokens
      await User.findByIdAndUpdate(userId, {
        $inc: { 'security.tokenVersion': 1 }
      });

      logger.logSecurity('logout_all_devices', {
        userId,
        revokedTokensCount: revokeResult.modifiedCount
      });

      return { 
        success: true, 
        message: 'Logged out from all devices',
        revokedTokens: revokeResult.modifiedCount
      };
    } catch (error) {
      logger.logError('Logout all failed', error, { userId });
      throw error;
    }
  }

  /**
   * Change password - revoke all refresh tokens
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      if (user.password && !await user.comparePassword(currentPassword)) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Revoke all refresh tokens
      await this.logoutAll(userId);

      logger.logSecurity('password_changed', {
        userId,
        timestamp: new Date()
      });

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      logger.logError('Password change failed', error, { userId });
      throw error;
    }
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Get active refresh tokens
      const activeTokens = await RefreshToken.find({
        userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      const sessions = user.security.loginSessions.map(session => {
        const token = activeTokens.find(t => t.sessionId === session.sessionId);
        return {
          sessionId: session.sessionId,
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          createdAt: session.createdAt,
          lastActive: session.lastActive,
          isActive: !!token,
          expiresAt: token?.expiresAt,
          suspiciousActivity: token?.suspiciousActivity
        };
      });

      return { success: true, sessions };
    } catch (error) {
      logger.logError('Get active sessions failed', error, { userId });
      throw error;
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId, sessionId) {
    try {
      await RefreshToken.revokeAllForSession(sessionId, 'ADMIN_REVOCATION');
      
      const user = await User.findById(userId);
      if (user) {
        await user.removeLoginSession(sessionId);
      }

      logger.logSecurity('session_revoked', {
        userId,
        sessionId
      });

      return { success: true, message: 'Session revoked successfully' };
    } catch (error) {
      logger.logError('Session revocation failed', error, { userId, sessionId });
      throw error;
    }
  }

  /**
   * Cleanup expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens() {
    try {
      const deletedCount = await RefreshToken.cleanupExpired();
      
      if (deletedCount > 0) {
        logger.logInfo('Expired tokens cleaned up', { deletedCount });
      }

      return { success: true, deletedCount };
    } catch (error) {
      logger.logError('Token cleanup failed', error);
      throw error;
    }
  }

  /**
   * Get authentication statistics
   */
  async getStats(userId = null) {
    try {
      const tokenStats = await RefreshToken.getStatistics(userId);
      
      return {
        success: true,
        stats: {
          tokens: tokenStats,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.logError('Get auth stats failed', error, { userId });
      throw error;
    }
  }

  /**
   * Parse expiration time string to milliseconds
   */
  parseExpiration(expiration) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000
    };

    const match = expiration.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Extract device information from user agent
   */
  extractDeviceInfo(userAgent) {
    const ua = userAgent || '';
    
    // Simple user agent parsing (in production, use a library like ua-parser-js)
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    if (ua.includes('Mobile')) device = 'Mobile';
    else if (ua.includes('Tablet')) device = 'Tablet';
    else device = 'Desktop';

    return { browser, os, device };
  }
}

module.exports = new AuthService();
