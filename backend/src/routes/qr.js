const express = require("express");
const router = express.Router();
const qrService = require("../services/qrService");
const { validateEndpoint, validateContentType, validateRequestSize, validateRateLimit } = require("../middleware/inputValidation");

// Apply global validation middleware
router.use(validateContentType(['application/json']));
router.use(validateRequestSize(1024 * 1024)); // 1MB max

// Rate limiting for QR endpoints
const qrRateLimit = validateRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many QR requests, please try again later'
});

/**
 * @route   POST /api/v1/qr/generate
 * @desc    Generate QR code token with comprehensive validation
 * @access  Public
 */
router.post("/generate", qrRateLimit, validateEndpoint('generateQR'), (req, res) => {
  try {
    const { token, deepLink } = qrService.generateToken(req.body);
    return res.status(200).json({
      success: true,
      data: { token, deepLink },
      message: 'QR code generated successfully'
    });
  } catch (err) {
    if (err.validationErrors) {
      return res
        .status(400)
        .json({
          success: false,
          error: 'Validation Error',
          details: err.validationErrors
        });
    }
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate QR code'
    });
  }
});

/**
 * @route   POST /api/v1/qr/validate
 * @desc    Validate QR token with security checks
 * @access  Public
 */
router.post("/validate", qrRateLimit, validateEndpoint('validateQR'), (req, res) => {
  try {
    const { token } = req.body;
    const payload = qrService.validateToken(token);
    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Token validated successfully'
    });
  } catch (err) {
    return res
      .status(401)
      .json({
        success: false,
        error: 'Token Validation Failed',
        message: 'Token expired or tampered'
      });
  }
});

module.exports = router;
