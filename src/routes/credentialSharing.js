const express = require('express');
const CredentialSharingService = require('../services/credentialSharingService');

const router = express.Router();
const sharingService = new CredentialSharingService();

/**
 * POST /api/sharing/share
 * Share a credential with a third party
 */
router.post('/share', async (req, res) => {
  try {
    const { 
      credentialId, 
      sharedByDID, 
      sharedWithDID, 
      expiresIn, 
      maxAccessCount, 
      purpose 
    } = req.body;

    // Validate required fields
    if (!credentialId || !sharedByDID || !sharedWithDID) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: credentialId, sharedByDID, sharedWithDID'
      });
    }

    const result = await sharingService.shareCredential(
      credentialId,
      sharedByDID,
      sharedWithDID,
      {
        expiresIn,
        maxAccessCount,
        purpose
      }
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Share credential error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sharing/access
 * Access a shared credential
 */
router.post('/access', async (req, res) => {
  try {
    const { sharingId, accessToken, requestorDID } = req.body;

    // Validate required fields
    if (!sharingId || !accessToken || !requestorDID) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sharingId, accessToken, requestorDID'
      });
    }

    const result = await sharingService.accessSharedCredential(
      sharingId,
      accessToken,
      requestorDID
    );

    res.json(result);
  } catch (error) {
    console.error('Access shared credential error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sharing/revoke
 * Revoke a shared credential
 */
router.post('/revoke', async (req, res) => {
  try {
    const { sharingId, sharedByDID } = req.body;

    // Validate required fields
    if (!sharingId || !sharedByDID) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sharingId, sharedByDID'
      });
    }

    const result = await sharingService.revokeSharedCredential(
      sharingId,
      sharedByDID
    );

    res.json(result);
  } catch (error) {
    console.error('Revoke shared credential error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sharing/my-shares
 * Get all credentials shared by a DID
 */
router.get('/my-shares', async (req, res) => {
  try {
    const { did } = req.query;

    if (!did) {
      return res.status(400).json({
        success: false,
        error: 'DID query parameter is required'
      });
    }

    const result = await sharingService.getSharedCredentials(did, 'sharedBy');

    res.json(result);
  } catch (error) {
    console.error('Get my shares error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sharing/shared-with-me
 * Get all credentials shared with a DID
 */
router.get('/shared-with-me', async (req, res) => {
  try {
    const { did } = req.query;

    if (!did) {
      return res.status(400).json({
        success: false,
        error: 'DID query parameter is required'
      });
    }

    const result = await sharingService.getSharedCredentials(did, 'sharedWith');

    res.json(result);
  } catch (error) {
    console.error('Get shared with me error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sharing/extend
 * Extend expiration of a shared credential
 */
router.post('/extend', async (req, res) => {
  try {
    const { sharingId, sharedByDID, additionalSeconds } = req.body;

    // Validate required fields
    if (!sharingId || !sharedByDID || !additionalSeconds) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sharingId, sharedByDID, additionalSeconds'
      });
    }

    if (additionalSeconds <= 0) {
      return res.status(400).json({
        success: false,
        error: 'additionalSeconds must be greater than 0'
      });
    }

    const result = await sharingService.extendSharingExpiration(
      sharingId,
      sharedByDID,
      additionalSeconds
    );

    res.json(result);
  } catch (error) {
    console.error('Extend sharing expiration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sharing/cleanup
 * Clean up expired sharing records (admin endpoint)
 */
router.post('/cleanup', (req, res) => {
  try {
    const result = sharingService.cleanupExpiredShares();
    res.json(result);
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sharing/statistics
 * Get sharing statistics (admin endpoint)
 */
router.get('/statistics', (req, res) => {
  try {
    const result = sharingService.getStatistics();
    res.json(result);
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
