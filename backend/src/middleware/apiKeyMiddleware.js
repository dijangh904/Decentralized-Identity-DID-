const apiKeyService = require('../services/apiKeyService');
const { logger } = require('./index');

/**
 * Middleware to validate API Key from headers
 */
const validateApiKey = async (req, res, next) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API Key is missing'
    });
  }

  try {
    const validatedKey = await apiKeyService.validateApiKey(apiKey);

    if (!validatedKey) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Invalid or expired API Key'
      });
    }

    // Attach API key info to request
    req.apiKey = validatedKey;
    next();
  } catch (error) {
    logger.error(`API Key validation error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to validate API Key'
    });
  }
};

module.exports = {
  validateApiKey
};
