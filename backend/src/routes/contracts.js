const express = require('express');
const Joi = require('joi');
const ContractService = require('../services/contractService');
const { authMiddleware, logger } = require('../middleware');
const { validateEndpoint, sanitizeParams } = require('../middleware/inputValidation');

const router = express.Router();
const contractService = new ContractService();

// Validation schemas
const deployContractSchema = Joi.object({
  deployerSecret: Joi.string().required().min(56).max(56)
});

const registerDIDSchema = Joi.object({
  did: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  publicKey: Joi.string().required().min(56).max(56),
  serviceEndpoint: Joi.string().uri().optional(),
  signerSecret: Joi.string().required().min(56).max(56)
});

const updateDIDSchema = Joi.object({
  did: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  updates: Joi.object({
    publicKey: Joi.string().min(56).max(56).optional(),
    serviceEndpoint: Joi.string().uri().optional()
  }).required(),
  signerSecret: Joi.string().required().min(56).max(56)
});

const issueCredentialSchema = Joi.object({
  issuerDID: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  subjectDID: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  credentialType: Joi.string().required(),
  claims: Joi.object().required(),
  signerSecret: Joi.string().required().min(56).max(56)
});

/**
 * @openapi
 * tags:
 *   name: Contracts
 *   description: Smart contract operations for DID and Credentials on Stellar
 */

/**
 * @openapi
 * /contracts/deploy:
 *   post:
 *     summary: Deploy DID registry contract
 *     tags: [Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deployerSecret]
 *             properties:
 *               deployerSecret:
 *                 type: string
 *                 description: Stellar secret key of the deployer
 *     responses:
 *       201:
 *         description: Contract deployed successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/deploy', async (req, res, next) => {
  // ... (implementation remains the same)
  try {
    const { error, value } = deployContractSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { deployerSecret } = value;
    
    logger.info('Deploying DID registry contract');
    
    const result = await contractService.deployContract(deployerSecret);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Contract deployed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/register-did:
 *   post:
 *     summary: Register a new DID on the blockchain
 *     tags: [Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [did, publicKey, signerSecret]
 *             properties:
 *               did:
 *                 type: string
 *               publicKey:
 *                 type: string
 *               serviceEndpoint:
 *                 type: string
 *               signerSecret:
 *                 type: string
 *     responses:
 *       201:
 *         description: DID registered successfully
 */
router.post('/register-did', validateEndpoint('registerDID'), async (req, res, next) => {
  try {
    const { did, publicKey, serviceEndpoint, signerSecret } = req.body;
    
    logger.info('Registering DID on blockchain', { did });
    
    const result = await contractService.registerDID(
      did,
      publicKey,
      serviceEndpoint,
      signerSecret
    );
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'DID registered successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/update-did:
 *   put:
 *     summary: Update DID document on blockchain
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: DID updated successfully
 */
router.put('/update-did', async (req, res, next) => {
  try {
    const { error, value } = updateDIDSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { did, updates, signerSecret } = value;
    
    logger.info('Updating DID on blockchain', { did });
    
    const result = await contractService.updateDID(did, updates, signerSecret);
    
    res.json({
      success: true,
      data: result,
      message: 'DID updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/issue-credential:
 *   post:
 *     summary: Issue verifiable credential on blockchain
 *     tags: [Contracts]
 *     responses:
 *       201:
 *         description: Credential issued successfully
 */
router.post('/issue-credential', validateEndpoint('issueCredential'), async (req, res, next) => {
  try {
    const { issuerDID, subjectDID, credentialType, claims, signerSecret } = req.body;
    
    logger.info('Issuing credential on blockchain', {
      issuerDID,
      subjectDID,
      credentialType
    });
    
    const result = await contractService.issueCredential(
      issuerDID,
      subjectDID,
      credentialType,
      claims,
      signerSecret
    );
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Credential issued successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/revoke-credential:
 *   post:
 *     summary: Revoke credential on blockchain
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: Credential revoked successfully
 */
router.post('/revoke-credential', validateEndpoint('revokeCredential'), async (req, res, next) => {
  try {
    const { credentialId, signerSecret } = req.body;
    
    logger.info('Revoking credential on blockchain', { credentialId });
    
    const result = await contractService.revokeCredential(credentialId, signerSecret);
    
    res.json({
      success: true,
      data: result,
      message: 'Credential revoked successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/did/{did}:
 *   get:
 *     summary: Get DID document from blockchain
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: DID retrieved successfully
 *       404:
 *         description: DID not found
 */
router.get('/did/:did', sanitizeParams, async (req, res, next) => {
  try {
    const { did } = req.params;
    
    // Validate DID format
    if (!did.match(/^did:stellar:G[A-Z0-9]{55}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DID format'
      });
    }
    
    logger.debug('Getting DID from blockchain', { did });
    
    const didDocument = await contractService.getDID(did);
    
    if (!didDocument) {
      return res.status(404).json({
        success: false,
        error: 'DID not found'
      });
    }
    
    res.json({
      success: true,
      data: didDocument,
      message: 'DID retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/credential/{credentialId}:
 *   get:
 *     summary: Get credential from blockchain
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential retrieved successfully
 */
router.get('/credential/:credentialId', sanitizeParams, async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    
    logger.debug('Getting credential from blockchain', { credentialId });
    
    const credential = await contractService.getCredential(credentialId);
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found'
      });
    }
    
    res.json({
      success: true,
      data: credential,
      message: 'Credential retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/owner-dids/{publicKey}:
 *   get:
 *     summary: Get all DIDs for an owner
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Owner DIDs retrieved successfully
 */
router.get('/owner-dids/:publicKey', async (req, res, next) => {
  try {
    const { publicKey } = req.params;
    
    // Validate Stellar address
    if (!contractService.validateStellarAddress(publicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar public key'
      });
    }
    
    logger.debug('Getting owner DIDs', { publicKey });
    
    const dids = await contractService.getOwnerDIDs(publicKey);
    
    res.json({
      success: true,
      data: dids,
      count: dids.length,
      message: 'Owner DIDs retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/verify-credential:
 *   post:
 *     summary: Verify credential on blockchain
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: Credential verified successfully
 */
router.post('/verify-credential', validateEndpoint('verifyCredential'), async (req, res, next) => {
  try {
    const { credentialId } = req.body;
    
    logger.info('Verifying credential on blockchain', { credentialId });
    
    const verification = await contractService.verifyCredential(credentialId);
    
    res.json({
      success: true,
      data: verification,
      message: verification.valid ? 
        'Credential verified successfully' : 
        'Credential verification failed'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/info:
 *   get:
 *     summary: Get contract information
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: Contract information retrieved successfully
 */
router.get('/info', async (req, res, next) => {
  try {
    logger.debug('Getting contract information');
    
    const info = await contractService.getContractInfo();
    
    res.json({
      success: true,
      data: info,
      message: 'Contract information retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/create-account:
 *   post:
 *     summary: Create new Stellar account
 *     tags: [Contracts]
 *     responses:
 *       201:
 *         description: Account created successfully
 */
router.post('/create-account', async (req, res, next) => {
  try {
    logger.info('Creating new Stellar account');
    
    const account = await contractService.createAccount();
    
    res.status(201).json({
      success: true,
      data: account,
      message: 'Account created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/fund-account:
 *   post:
 *     summary: Fund testnet account
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: Account funded successfully
 */
router.post('/fund-account', validateEndpoint('fundAccount'), async (req, res, next) => {
  try {
    const { publicKey } = req.body;
    
    logger.info('Funding testnet account', { publicKey });
    
    const result = await contractService.fundTestnetAccount(publicKey);
    
    res.json({
      success: true,
      data: result,
      message: 'Account funded successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/account/{publicKey}:
 *   get:
 *     summary: Get account information
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account information retrieved successfully
 */
router.get('/account/:publicKey', async (req, res, next) => {
  try {
    const { publicKey } = req.params;
    
    logger.debug('Getting account information', { publicKey });
    
    const account = await contractService.getAccount(publicKey);
    
    res.json({
      success: true,
      data: account,
      message: 'Account information retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;


module.exports = router;

