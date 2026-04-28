const { ethers } = require('ethers');
const logger = require('../utils/logger');
const ContractService = require('./contractService');
const { crossChainBridgeQueue } = require('../config/queue');

class CrossChainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.EVM_RPC_URL || 'https://rpc2.sepolia.org');

    // We assume the deployer's private key is provided in the environment
    const privateKey = process.env.EVM_PRIVATE_KEY || '0x0123456789012345678901234567890123456789012345678901234567890123';
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    this.ethereumContractAddress = process.env.EVM_DID_REGISTRY_ADDRESS;

    // Minimal ABI for bridging operations
    const abi = [
      "function bridgeDID(string did, address ownerAddress, string publicKey, string serviceEndpoint) external returns (bool)",
      "function bridgeCredential(bytes32 credentialId, string issuer, string subject, string credentialType, uint256 expires, bytes32 dataHash) external returns (bytes32)",
      "function getDIDDocument(string did) external view returns (tuple(string did, address owner, string publicKey, uint256 created, uint256 updated, bool active, string serviceEndpoint))",
      "function getCredential(bytes32 credentialId) external view returns (tuple(bytes32 id, string issuer, string subject, string credentialType, uint256 issued, uint256 expires, bytes32 dataHash, bool revoked))"
    ];

    if (this.ethereumContractAddress) {
      this.ethereumContract = new ethers.Contract(this.ethereumContractAddress, abi, this.wallet);
    } else {
      logger.warn('EVM_DID_REGISTRY_ADDRESS is not set. Cross-chain operations will fail.');
    }

    this.stellarContractService = new ContractService();
  }

  /**
   * Bridge a DID from Stellar to Ethereum
   */
  async bridgeDIDToEthereum(did, ownerAddress) {
    try {
      logger.info('Bridging DID to Ethereum', { did, ownerAddress });

      // 1. Fetch DID from Stellar
      const didDocument = await this.stellarContractService.getDID(did);
      if (!didDocument) {
        throw new Error(`DID ${did} not found on Stellar`);
      }

      if (!this.ethereumContract) {
        throw new Error('Ethereum contract not initialized');
      }

      // 2. Call bridge function on Ethereum
      const tx = await this.ethereumContract.bridgeDID(
        didDocument.did,
        ownerAddress,
        didDocument.publicKey,
        didDocument.serviceEndpoint || ""
      );

      logger.info('Waiting for bridge transaction to be mined...', { txHash: tx.hash });
      const receipt = await tx.wait();

      logger.info('DID bridged successfully', { transactionHash: receipt.hash });
      return receipt;
    } catch (error) {
      logger.error('Failed to bridge DID to Ethereum:', error);
      throw new Error(`Bridge DID failed: ${error.message}`);
    }
  }

  /**
   * Bridge a Verifiable Credential from Stellar to Ethereum
   */
  async bridgeCredentialToEthereum(credentialId, dataHash) {
    try {
      logger.info('Bridging Credential to Ethereum', { credentialId });

      // 1. Fetch credential from Stellar
      const credential = await this.stellarContractService.getCredential(credentialId);
      if (!credential) {
        throw new Error(`Credential ${credentialId} not found on Stellar`);
      }

      if (!this.ethereumContract) {
        throw new Error('Ethereum contract not initialized');
      }

      // 2. Call bridge function on Ethereum
      // Convert credentialId string to bytes32 format if necessary
      let bytes32Id = credentialId;
      if (!ethers.isHexString(bytes32Id)) {
        bytes32Id = ethers.id(credentialId);
      }

      let bytes32Hash = dataHash;
      if (!ethers.isHexString(bytes32Hash)) {
        bytes32Hash = ethers.id(dataHash || credential.claims);
      }

      const tx = await this.ethereumContract.bridgeCredential(
        bytes32Id,
        credential.issuer,
        credential.subject,
        credential.type || credential.credentialType,
        0, // Set expires to 0 or derive from credential
        bytes32Hash
      );

      logger.info('Waiting for credential bridge transaction to be mined...', { txHash: tx.hash });
      const receipt = await tx.wait();

      logger.info('Credential bridged successfully', { transactionHash: receipt.hash });
      return receipt;
    } catch (error) {
      logger.error('Failed to bridge Credential to Ethereum:', error);
      throw new Error(`Bridge Credential failed: ${error.message}`);
    }
  }

  /**
   * Check cross-chain state
   */
  async verifyCrossChainState(did) {
    try {
      const stellarDID = await this.stellarContractService.getDID(did);

      let ethereumDID = null;
      if (this.ethereumContract) {
        try {
          const result = await this.ethereumContract.getDIDDocument(did);
          if (result.did === did) {
            ethereumDID = result;
          }
        } catch (err) {
          logger.debug('DID not found on Ethereum side', { error: err.message });
        }
      }

      return {
        did,
        stellar: !!stellarDID,
        ethereum: !!ethereumDID,
        synced: !!stellarDID && !!ethereumDID
      };
    } catch (error) {
      logger.error('Failed to verify cross-chain state:', error);
      throw new Error(`Verify cross-chain state failed: ${error.message}`);
    }
  }

  async bridgeDIDToEthereumAsync(did, ownerAddress) {
    try {
      const job = await crossChainBridgeQueue.add('bridge-did', { did, ownerAddress }, {
        priority: 1,
        removeOnComplete: false
      });

      logger.info('DID bridge job queued:', { jobId: job.id, did });

      return {
        jobId: job.id,
        status: 'queued',
        message: 'DID bridge queued for processing'
      };
    } catch (error) {
      logger.error('Error queuing DID bridge:', error);
      throw error;
    }
  }

  async bridgeCredentialToEthereumAsync(credentialId, dataHash) {
    try {
      const job = await crossChainBridgeQueue.add('bridge-credential', { credentialId, dataHash }, {
        priority: 1,
        removeOnComplete: false
      });

      logger.info('Credential bridge job queued:', { jobId: job.id, credentialId });

      return {
        jobId: job.id,
        status: 'queued',
        message: 'Credential bridge queued for processing'
      };
    } catch (error) {
      logger.error('Error queuing credential bridge:', error);
      throw error;
    }
  }

  async verifyCrossChainStateAsync(did) {
    try {
      const job = await crossChainBridgeQueue.add('verify-cross-chain-state', { did }, {
        priority: 2,
        removeOnComplete: false
      });

      logger.info('Cross-chain state verification job queued:', { jobId: job.id, did });

      return {
        jobId: job.id,
        status: 'queued',
        message: 'Cross-chain state verification queued for processing'
      };
    } catch (error) {
      logger.error('Error queuing cross-chain state verification:', error);
      throw error;
    }
  }
}

module.exports = CrossChainService;
