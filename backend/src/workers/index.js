const { credentialVerificationQueue, blockchainInteractionQueue, crossChainBridgeQueue } = require('../config/queue');
const credentialService = require('../services/credentialService');
const stellarService = require('../services/stellarService');
const crossChainService = require('../services/crossChainService');
const { logger } = require('../middleware');

// Credential verification worker
credentialVerificationQueue.process('verify-credential', async (job) => {
  const { credential } = job.data;
  logger.info(`Processing credential verification job:`, { jobId: job.id, credentialId: credential.id });
  
  try {
    const result = await credentialService.verifyCredential(credential);
    job.progress(100);
    return result;
  } catch (error) {
    logger.error(`Credential verification failed:`, { jobId: job.id, error: error.message });
    throw error;
  }
});

// Stellar transaction submission worker
blockchainInteractionQueue.process('submit-stellar-transaction', async (job) => {
  const { transactionXDR } = job.data;
  logger.info(`Processing Stellar transaction submission job:`, { jobId: job.id });
  
  try {
    job.progress(50);
    const result = await stellarService.submitTransaction(transactionXDR);
    job.progress(100);
    return result;
  } catch (error) {
    logger.error(`Stellar transaction submission failed:`, { jobId: job.id, error: error.message });
    throw error;
  }
});

// Stellar account fetch worker
blockchainInteractionQueue.process('fetch-stellar-account', async (job) => {
  const { address } = job.data;
  logger.info(`Processing Stellar account fetch job:`, { jobId: job.id, address });
  
  try {
    job.progress(50);
    const result = await stellarService.getAccount(address);
    job.progress(100);
    return result;
  } catch (error) {
    logger.error(`Stellar account fetch failed:`, { jobId: job.id, error: error.message });
    throw error;
  }
});

// Cross-chain DID bridge worker
crossChainBridgeQueue.process('bridge-did', async (job) => {
  const { did, ownerAddress } = job.data;
  logger.info(`Processing DID bridge job:`, { jobId: job.id, did });
  
  try {
    job.progress(33);
    const result = await crossChainService.bridgeDIDToEthereum(did, ownerAddress);
    job.progress(100);
    return result;
  } catch (error) {
    logger.error(`DID bridge failed:`, { jobId: job.id, error: error.message });
    throw error;
  }
});

// Cross-chain credential bridge worker
crossChainBridgeQueue.process('bridge-credential', async (job) => {
  const { credentialId, dataHash } = job.data;
  logger.info(`Processing credential bridge job:`, { jobId: job.id, credentialId });
  
  try {
    job.progress(33);
    const result = await crossChainService.bridgeCredentialToEthereum(credentialId, dataHash);
    job.progress(100);
    return result;
  } catch (error) {
    logger.error(`Credential bridge failed:`, { jobId: job.id, error: error.message });
    throw error;
  }
});

// Cross-chain state verification worker
crossChainBridgeQueue.process('verify-cross-chain-state', async (job) => {
  const { did } = job.data;
  logger.info(`Processing cross-chain state verification job:`, { jobId: job.id, did });
  
  try {
    job.progress(50);
    const result = await crossChainService.verifyCrossChainState(did);
    job.progress(100);
    return result;
  } catch (error) {
    logger.error(`Cross-chain state verification failed:`, { jobId: job.id, error: error.message });
    throw error;
  }
});

logger.info('Job workers initialized successfully');
