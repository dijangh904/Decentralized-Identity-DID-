const sessionService = require('../services/sessionService');
const { logger } = require('./logger');

/**
 * Authentication Middleware
 * Verifies the session token and checks for validity
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const session = await sessionService.validateSession(token);

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session'
      });
    }

    // Attach user information to request
    req.user = {
      id: session.userId,
      sessionId: session._id
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate request'
    });
  }
};

module.exports = authMiddleware;
