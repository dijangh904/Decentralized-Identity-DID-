let DIDContract;
try {
  DIDContract = require('../../contracts/stellar/DIDContract');
} catch (err) {
  // If contract file is missing, use a dummy contract object for development
  console.warn('⚠️  DIDContract file not found, using dummy contract object for development');
  
  // Create a dummy class that can be instantiated
  DIDContract = class DummyContract {
    constructor(horizonUrl) {
      this.horizonUrl = horizonUrl;
      this.contractAddress = null;
      this.methods = {};
      this.spec = {};
      this.contractId = 'dummy-contract-id';
    }
  };
}

const StellarSDK = require('stellar-sdk');
const logger = require('../middleware').logger;
const stellarConnection = require('../utils/stellarConnection');
const { createBreaker } = require('../utils/circuitBreaker');

// Custom error classes for better error handling
class ContractAddressNotSetError extends Error {
  constructor(message = 'Contract address not set') {
    super(message);
    this.name = 'ContractAddressNotSet';
  }
}

class ContractDeploymentFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractDeploymentFailed';
  }
}

class DIDRegistrationFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DIDRegistrationFailed';
  }
}

class DIDUpdateFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DIDUpdateFailed';
  }
}

class CredentialIssuanceFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CredentialIssuanceFailed';
  }
}

class TransactionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransactionFailed';
  }
}

class AccountNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccountNotFound';
  }
}

class ContractService {
  constructor() {
    this.contract = new DIDContract(process.env.STELLAR_HORIZON_URL);
    this.contractAddress = process.env.DID_CONTRACT_ADDRESS;
    
    if (this.contractAddress) {
      this.contract.contractAddress = this.contractAddress;
    }

    // Initialize breakers
    this.deployBreaker = createBreaker(this.contract.deploy.bind(this.contract));
    this.registerDIDBreaker = createBreaker(this.contract.registerDID.bind(this.contract));
    this.updateDIDBreaker = createBreaker(this.contract.updateDID.bind(this.contract));
    this.issueCredentialBreaker = createBreaker(this.contract.issueCredential.bind(this.contract));
    this.revokeCredentialBreaker = createBreaker(this.contract.revokeCredential.bind(this.contract));
    this.getDIDBreaker = createBreaker(this.contract.getDID.bind(this.contract));
    this.getCredentialBreaker = createBreaker(this.contract.getCredential.bind(this.contract));
    this.getOwnerDIDsBreaker = createBreaker(this.contract.getOwnerDIDs.bind(this.contract));
    this.verifyCredentialBreaker = createBreaker(this.contract.verifyCredential.bind(this.contract));
    this.loadAccountBreaker = createBreaker(stellarConnection.loadAccount.bind(stellarConnection));
  }

  /**
   * Deploy DID registry contract
   */
  async deployContract(deployerSecret) {
    try {
      logger.info('Deploying DID registry contract...');
      
      const result = await this.deployBreaker.fire(deployerSecret);
      
      logger.info('Contract deployed successfully', {
        contractAddress: result.contractAddress,
        transactionHash: result.transactionHash
      });
      
      return result;
    } catch (error) {
      logger.error('Contract deployment failed:', error);
      throw new ContractDeploymentFailedError(error.message);
    }
  }

  /**
   * Register a new DID on the blockchain
   */
  async registerDID(did, publicKey, serviceEndpoint, signerSecret) {
    try {
      logger.info('Registering DID on contract', { did });
      
      if (!this.contract.contractAddress) {
        throw new ContractAddressNotSetError();
      }

      const result = await this.registerDIDBreaker.fire(
        did,
        publicKey,
        serviceEndpoint,
        signerSecret
      );
      
      logger.info('DID registered successfully', {
        did,
        transactionHash: result.hash
      });
      
      return result;
    } catch (error) {
      logger.error('DID registration failed:', error);
      throw new DIDRegistrationFailedError(error.message);
    }
  }

  /**
   * Update DID document on blockchain
   */
  async updateDID(did, updates, signerSecret) {
    try {
      logger.info('Updating DID on contract', { did });
      
      const result = await this.updateDIDBreaker.fire(did, updates, signerSecret);
      
      logger.info('DID updated successfully', {
        did,
        transactionHash: result.hash
      });
      
      return result;
    } catch (error) {
      logger.error('DID update failed:', error);
      throw new DIDUpdateFailedError(error.message);
    }
  }

  /**
   * Issue verifiable credential on blockchain
   */
  async issueCredential(issuerDID, subjectDID, credentialType, claims, signerSecret) {
    try {
      logger.info('Issuing credential on contract', {
        issuerDID,
        subjectDID,
        credentialType
      });
      
      const result = await this.issueCredentialBreaker.fire(
        issuerDID,
        subjectDID,
        credentialType,
        claims,
        signerSecret
      );
      
      logger.info('Credential issued successfully', {
        credentialId: result.credential.id,
        transactionHash: result.transaction.hash
      });
      
      return result;
    } catch (error) {
      logger.error('Credential issuance failed:', error);
      throw new CredentialIssuanceFailedError(error.message);
    }
  }

  /**
   * Revoke credential on blockchain
   */
  async revokeCredential(credentialId, signerSecret) {
    try {
      logger.info('Revoking credential on contract', { credentialId });
      
      const result = await this.revokeCredentialBreaker.fire(credentialId, signerSecret);
      
      logger.info('Credential revoked successfully', {
        credentialId,
        transactionHash: result.hash
      });
      
      return result;
    } catch (error) {
      logger.error('Credential revocation failed:', error);
      throw new Error(`Credential revocation failed: ${error.message}`);
    }
  }

  /**
   * Get DID document from blockchain
   */
  async getDID(did) {
    try {
      const didDocument = await this.getDIDBreaker.fire(did);
      
      if (didDocument) {
        logger.debug('DID retrieved from blockchain', { did });
      } else {
        logger.debug('DID not found on blockchain', { did });
      }
      
      return didDocument;
    } catch (error) {
      logger.error('Failed to get DID from blockchain:', error);
      throw new Error(`Failed to get DID: ${error.message}`);
    }
  }

  /**
   * Get credential from blockchain
   */
  async getCredential(credentialId) {
    try {
      const credential = await this.getCredentialBreaker.fire(credentialId);
      
      if (credential) {
        logger.debug('Credential retrieved from blockchain', { credentialId });
      } else {
        logger.debug('Credential not found on blockchain', { credentialId });
      }
      
      return credential;
    } catch (error) {
      logger.error('Failed to get credential from blockchain:', error);
      throw new Error(`Failed to get credential: ${error.message}`);
    }
  }

  /**
   * Get all DIDs for an owner
   */
  async getOwnerDIDs(ownerPublicKey) {
    try {
      const dids = await this.getOwnerDIDsBreaker.fire(ownerPublicKey);
      
      logger.debug('Retrieved owner DIDs', {
        ownerPublicKey,
        count: dids.length
      });
      
      return dids;
    } catch (error) {
      logger.error('Failed to get owner DIDs:', error);
      throw new Error(`Failed to get owner DIDs: ${error.message}`);
    }
  }

  /**
   * Verify credential on blockchain
   */
  async verifyCredential(credentialId) {
    try {
      const verification = await this.verifyCredentialBreaker.fire(credentialId);
      
      logger.info('Credential verification completed', {
        credentialId,
        valid: verification.valid
      });
      
      return verification;
    } catch (error) {
      logger.error('Credential verification failed:', error);
      throw new Error(`Credential verification failed: ${error.message}`);
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo() {
    try {
      const info = await this.contract.getContractInfo();
      
      logger.debug('Contract info retrieved', info);
      
      return info;
    } catch (error) {
      logger.error('Failed to get contract info:', error);
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * Create Stellar account
   */
  async createAccount() {
    try {
      const pair = StellarSDK.Keypair.random();
      
      logger.info('New Stellar account created', {
        publicKey: pair.publicKey()
      });
      
      return {
        publicKey: pair.publicKey(),
        secretKey: pair.secret()
      };
    } catch (error) {
      logger.error('Failed to create Stellar account:', error);
      throw new Error(`Failed to create account: ${error.message}`);
    }
  }

  /**
   * Fund testnet account
   */
  async fundTestnetAccount(publicKey) {
    try {
      if (process.env.STELLAR_NETWORK !== 'TESTNET') {
        throw new Error('Friendbot only available on testnet');
      }

      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      const result = await response.json();
      
      logger.info('Testnet account funded', { publicKey });
      
      return result;
    } catch (error) {
      logger.error('Failed to fund testnet account:', error);
      throw new Error(`Failed to fund account: ${error.message}`);
    }
  }

  /**
   * Get account information
   */
  async getAccount(publicKey) {
    try {
      const server = new StellarSDK.Horizon.Server(
        process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
      );
      
      const account = await this.loadAccountBreaker.fire(publicKey);
      
      logger.debug('Account information retrieved', { publicKey });
      
      return {
        accountId: account.account_id(),
        sequence: account.sequence,
        balances: account.balances,
        data: account.data_attr,
        signers: account.signers,
        thresholds: account.thresholds
      };
    } catch (error) {
      logger.error('Failed to get account information:', error);
      throw new Error(`Failed to get account: ${error.message}`);
    }
  }

  /**
   * Validate Stellar address
   */
  validateStellarAddress(address) {
    try {
      StellarSDK.StrKey.decodeEd25519PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract public key from DID
   */
  extractPublicKeyFromDID(did) {
    if (!did.startsWith('did:stellar:')) {
      throw new Error('Invalid DID method. Expected did:stellar:');
    }
    
    const publicKey = did.split('did:stellar:')[1];
    
    if (!this.validateStellarAddress(publicKey)) {
      throw new Error('Invalid Stellar public key in DID');
    }
    
    return publicKey;
  }
}

module.exports = ContractService;
