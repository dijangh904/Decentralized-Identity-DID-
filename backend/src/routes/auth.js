const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authService = require('../services/authService');
const { logger } = require('../middleware');
const rateLimit = require('express-rate-limit');

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 refresh attempts per window
    message: 'Too many refresh attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation schemas
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).when('walletAddress', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    walletAddress: Joi.string().pattern(/^G[A-Z0-9]{55}$/).when('password', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    profile: Joi.object({
        firstName: Joi.string().trim(),
        lastName: Joi.string().trim(),
        avatar: Joi.string().uri(),
        bio: Joi.string().max(500)
    }).optional()
});

const loginSchema = Joi.object({
    identifier: Joi.string().required(), // email or wallet address
    password: Joi.string().when('walletAuth', {
        is: true,
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    walletAuth: Joi.boolean().default(false)
});

const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required()
});

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
});

// Middleware to extract device info
const extractDeviceInfo = (req, res, next) => {
    req.deviceInfo = {
        userAgent: req.get('User-Agent') || '',
        ipAddress: req.ip || req.connection.remoteAddress,
        ...authService.extractDeviceInfo(req.get('User-Agent'))
    };
    next();
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, extractDeviceInfo, async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: error.details[0].message
            });
        }

        const result = await authService.register(value);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: result
        });
    } catch (error) {
        logger.logError('Registration endpoint error', error, {
            body: req.body,
            ipAddress: req.deviceInfo.ipAddress
        });

        res.status(400).json({
            success: false,
            error: 'Registration Failed',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user and return tokens
 * @access  Public
 */
router.post('/login', authLimiter, extractDeviceInfo, async (req, res) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: error.details[0].message
            });
        }

        const result = await authService.login(value, req.deviceInfo);

        // Set HTTP-only cookie for refresh token (more secure)
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: result.tokens.refreshExpiresIn,
            path: '/api/v1/auth'
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: result.user,
                tokens: {
                    accessToken: result.tokens.accessToken,
                    expiresIn: result.tokens.expiresIn,
                    tokenType: result.tokens.tokenType
                },
                sessionId: result.sessionId
            }
        });
    } catch (error) {
        logger.logError('Login endpoint error', error, {
            body: req.body,
            ipAddress: req.deviceInfo.ipAddress
        });

        res.status(401).json({
            success: false,
            error: 'Authentication Failed',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
router.post('/refresh', refreshLimiter, extractDeviceInfo, async (req, res) => {
    try {
        // Get refresh token from cookie or body
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: 'Missing Token',
                message: 'Refresh token is required'
            });
        }

        const result = await authService.refreshToken(refreshToken, req.deviceInfo);

        // Update refresh token cookie
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: result.tokens.refreshExpiresIn,
            path: '/api/v1/auth'
        });

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                tokens: {
                    accessToken: result.tokens.accessToken,
                    expiresIn: result.tokens.expiresIn,
                    tokenType: result.tokens.tokenType
                }
            }
        });
    } catch (error) {
        logger.logError('Token refresh endpoint error', error, {
            ipAddress: req.deviceInfo.ipAddress
        });

        // Clear invalid refresh token cookie
        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        res.status(401).json({
            success: false,
            error: 'Token Refresh Failed',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and revoke refresh token
 * @access  Public (with refresh token)
 */
router.post('/logout', extractDeviceInfo, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        const sessionId = req.body.sessionId;

        await authService.logout(refreshToken, sessionId);

        // Clear refresh token cookie
        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        logger.logError('Logout endpoint error', error);

        // Still clear cookie even if logout fails
        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        res.status(400).json({
            success: false,
            error: 'Logout Failed',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', async (req, res) => {
    try {
        // This endpoint should be protected by auth middleware
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const result = await authService.logoutAll(userId);

        // Clear refresh token cookie
        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        res.json({
            success: true,
            message: 'Logged out from all devices',
            data: result
        });
    } catch (error) {
        logger.logError('Logout all endpoint error', error);

        res.status(400).json({
            success: false,
            error: 'Logout All Failed',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const { error, value } = changePasswordSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: error.details[0].message
            });
        }

        const result = await authService.changePassword(userId, value.currentPassword, value.newPassword);

        // Clear refresh token cookie (all tokens are revoked)
        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        res.json({
            success: true,
            message: 'Password changed successfully',
            data: result
        });
    } catch (error) {
        logger.logError('Change password endpoint error', error);

        res.status(400).json({
            success: false,
            error: 'Password Change Failed',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Get active sessions for user
 * @access  Private
 */
router.get('/sessions', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const result = await authService.getActiveSessions(userId);

        res.json({
            success: true,
            message: 'Sessions retrieved successfully',
            data: result
        });
    } catch (error) {
        logger.logError('Get sessions endpoint error', error);

        res.status(400).json({
            success: false,
            error: 'Get Sessions Failed',
            message: error.message
        });
    }
});

/**
 * @route   DELETE /api/v1/auth/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { sessionId } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const result = await authService.revokeSession(userId, sessionId);

        res.json({
            success: true,
            message: 'Session revoked successfully',
            data: result
        });
    } catch (error) {
        logger.logError('Revoke session endpoint error', error);

        res.status(400).json({
            success: false,
            error: 'Session Revocation Failed',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/auth/stats
 * @desc    Get authentication statistics
 * @access  Private (Admin only)
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.roles?.includes('ADMIN');

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        // Only admins can get global stats, users get their own stats
        const targetUserId = isAdmin ? null : userId;

        const result = await authService.getStats(targetUserId);

        res.json({
            success: true,
            message: 'Statistics retrieved successfully',
            data: result
        });
    } catch (error) {
        logger.logError('Get auth stats endpoint error', error);

        res.status(400).json({
            success: false,
            error: 'Get Stats Failed',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/cleanup
 * @desc    Cleanup expired tokens (admin only)
 * @access  Private (Admin only)
 */
router.post('/cleanup', async (req, res) => {
    try {
        const isAdmin = req.user?.roles?.includes('ADMIN');

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Admin access required'
            });
        }

        const result = await authService.cleanupExpiredTokens();

        res.json({
            success: true,
            message: 'Token cleanup completed',
            data: result
        });
    } catch (error) {
        logger.logError('Token cleanup endpoint error', error);

        res.status(400).json({
            success: false,
            error: 'Cleanup Failed',
            message: error.message
        });
    }
});

module.exports = router;
