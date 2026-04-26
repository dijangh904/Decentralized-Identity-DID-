const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKeyService');

/**
 * Generate a new API Key
 * POST /api/v1/api-keys
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, owner, permissions, expiresInDays } = req.body;
    const apiKey = await apiKeyService.generateApiKey(name, owner, permissions, expiresInDays);
    res.status(201).json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List API Keys for an owner
 * GET /api/v1/api-keys/:owner
 */
router.get('/:owner', async (req, res, next) => {
  try {
    const { owner } = req.params;
    const apiKeys = await apiKeyService.listApiKeys(owner);
    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Rotate an API Key
 * PUT /api/v1/api-keys/:id/rotate
 */
router.put('/:id/rotate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const apiKey = await apiKeyService.rotateApiKey(id);
    res.json({
      success: true,
      message: 'API Key rotated successfully',
      data: apiKey
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke an API Key
 * DELETE /api/v1/api-keys/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await apiKeyService.revokeApiKey(id);
    res.json({
      success: true,
      message: 'API Key revoked successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
