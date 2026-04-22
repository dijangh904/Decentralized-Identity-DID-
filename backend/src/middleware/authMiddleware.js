const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('./logger');

/**
 * JWT Authentication Middleware
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Access token is required'
      });
    }

    // Verify the access token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        logger.logSecurity('invalid_access_token', {
          error: err.message,
          token: token.substring(0, 20) + '...',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token Expired',
            message: 'Access token has expired, please refresh your token'
          });
        }

        return res.status(403).json({
          success: false,
          error: 'Invalid Token',
          message: 'Access token is invalid'
        });
      }

      try {
        // Get fresh user data
        const user = await User.findById(decoded.userId);

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'User Not Found',
            message: 'User associated with this token no longer exists'
          });
        }

        // Check if user is still active
        if (!user.isActive) {
          return res.status(401).json({
            success: false,
            error: 'Account Deactivated',
            message: 'Your account has been deactivated'
          });
        }

        // Attach user to request object
        req.user = {
          id: user._id,
          email: user.email,
          walletAddress: user.walletAddress,
          roles: user.roles,
          profile: user.profile
        };

        logger.logDebug('Authentication successful', {
          userId: user._id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        next();
      } catch (dbError) {
        logger.logError('Database error during authentication', dbError);
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Authentication service temporarily unavailable'
        });
      }
    });
  } catch (error) {
    logger.logError('Authentication middleware error', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication service error'
    });
  }
};

/**
 * Role-based Authorization Middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.logSecurity('unauthorized_access_attempt', {
        userId: req.user.id,
        userRoles: userRoles,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
        ipAddress: req.ip
      });

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions to access this resource'
      });
    }

    next();
  };
};

/**
 * Optional Authentication Middleware
 * Attaches user to request if token is valid, but doesn't block if not
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        // Invalid token, continue without authentication
        return next();
      }

      try {
        const user = await User.findById(decoded.userId);

        if (user && user.isActive) {
          req.user = {
            id: user._id,
            email: user.email,
            walletAddress: user.walletAddress,
            roles: user.roles,
            profile: user.profile
          };
        }
      } catch (dbError) {
        // Database error, continue without authentication
      }

      next();
    });
  } catch (error) {
    // Error in middleware, continue without authentication
    next();
  }
};

/**
 * Resource Owner Middleware
 * Ensures user can only access their own resources
 */
const requireOwnership = (resourceIdParam = 'id', allowAdmin = true) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const resourceOwnerId = req.params[resourceIdParam];
    const userId = req.user.id.toString();
    const isAdmin = req.user.roles.includes('ADMIN');

    // Allow admins if configured
    if (allowAdmin && isAdmin) {
      return next();
    }

    // Check if user owns the resource
    if (resourceOwnerId !== userId) {
      logger.logSecurity('unauthorized_resource_access', {
        userId: req.user.id,
        resourceOwnerId,
        path: req.path,
        method: req.method,
        ipAddress: req.ip
      });

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Rate Limiting per User
 */
const userRateLimit = (rateLimitMiddleware) => {
  return (req, res, next) => {
    if (req.user) {
      // Use user ID as key for rate limiting
      req.rateLimitKey = `user:${req.user.id}`;
    } else {
      // Use IP for unauthenticated requests
      req.rateLimitKey = `ip:${req.ip}`;
    }

    rateLimitMiddleware(req, res, next);
  };
};

/**
 * Two-Factor Authentication Check
 */
const require2FA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Check if user has 2FA enabled
  if (!req.user.security?.twoFactorEnabled) {
    return next(); // 2FA not required, continue
  }

  // Check for 2FA token in headers
  const twoFactorToken = req.headers['x-2fa-token'];

  if (!twoFactorToken) {
    return res.status(403).json({
      success: false,
      error: '2FA Required',
      message: 'Two-factor authentication token is required'
    });
  }

  // Here you would validate the 2FA token
  // For now, we'll assume it's valid
  // In production, implement proper TOTP validation

  next();
};

module.exports = {
  authenticateToken,
  authorize,
  optionalAuth,
  requireOwnership,
  userRateLimit,
  require2FA
};

// Legacy export for backward compatibility
module.exports.authMiddleware = authenticateToken;
