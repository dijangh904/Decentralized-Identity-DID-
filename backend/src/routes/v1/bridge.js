const express = require('express');
const router = express.Router();
const CrossChainService = require('../services/crossChainService');
const { authMiddleware } = require('../middleware');
const logger = require('../utils/logger');

const crossChainService = new CrossChainService();

/**
 * @route   POST /api/bridge/did
 * @desc    Bridge a Stellar DID to Ethereum
 * @access  Private
 */
router.post('/did', authMiddleware, async (req, res) => {
  try {
    const { did, ownerAddress } = req.body;

    if (!did || !ownerAddress) {
      return res.status(400).json({ error: 'Please provide did and ownerAddress' });
    }

    const receipt = await crossChainService.bridgeDIDToEthereum(did, ownerAddress);
    
    res.json({
      success: true,
      message: 'DID bridged successfully',
      transactionHash: receipt.hash
    });
  } catch (error) {
    logger.error('Bridge DID Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/bridge/credential
 * @desc    Bridge a Verifiable Credential to Ethereum
 * @access  Private
 */
router.post('/credential', authMiddleware, async (req, res) => {
  try {
    const { credentialId, dataHash } = req.body;

    if (!credentialId || !dataHash) {
      return res.status(400).json({ error: 'Please provide credentialId and dataHash' });
    }

    const receipt = await crossChainService.bridgeCredentialToEthereum(credentialId, dataHash);
    
    res.json({
      success: true,
      message: 'Credential bridged successfully',
      transactionHash: receipt.hash
    });
  } catch (error) {
    logger.error('Bridge Credential Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/bridge/status/:did
 * @desc    Check cross-chain status of a DID
 * @access  Private
 */
router.get('/status/:did', authMiddleware, async (req, res) => {
  try {
    const { did } = req.params;
    
    const status = await crossChainService.verifyCrossChainState(did);
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Bridge Status Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
