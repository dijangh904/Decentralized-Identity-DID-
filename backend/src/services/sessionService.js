const Session = require('../models/Session');
const jwt = require('jsonwebtoken');
const { logger } = require('../middleware');

const MAX_CONCURRENT_SESSIONS = 5;
const SESSION_DURATION = '24h';

class SessionService {
  /**
   * Create a new session for a user
   */
  async createSession(userId, deviceInfo, ipAddress) {
    try {
      // Enforce concurrent session limit
      const activeSessionsCount = await Session.countDocuments({ userId, isValid: true });
      
      if (activeSessionsCount >= MAX_CONCURRENT_SESSIONS) {
        // Invalidate oldest session if limit reached
        const oldestSession = await Session.findOne({ userId, isValid: true }).sort({ createdAt: 1 });
        if (oldestSession) {
          oldestSession.isValid = false;
          await oldestSession.save();
          logger.info(`Invalidated oldest session for user ${userId} due to limit`);
        }
      }

      // Generate JWT
      const token = jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: SESSION_DURATION }
      );

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const session = new Session({
        userId,
        token,
        deviceInfo,
        ipAddress,
        expiresAt,
        isValid: true
      });

      await session.save();
      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Validate a session token
   */
  async validateSession(token) {
    try {
      const session = await Session.findOne({ token, isValid: true });
      
      if (!session) {
        return null;
      }

      // Check if expired
      if (session.expiresAt < new Date()) {
        session.isValid = false;
        await session.save();
        return null;
      }

      // Update last activity
      session.lastActivity = new Date();
      await session.save();

      return session;
    } catch (error) {
      logger.error('Error validating session:', error);
      return null;
    }
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(token) {
    return Session.findOneAndUpdate({ token }, { isValid: false });
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId) {
    return Session.updateMany({ userId }, { isValid: false });
  }
}

module.exports = new SessionService();
