/**
 * Stellar DID Smart Contract Implementation
 * 
 * This represents the smart contract layer for Stellar DID operations.
 * Stellar uses a different smart contract model than Ethereum.
 */

const StellarSDK = require('stellar-sdk');

class DIDContract {
  constructor(serverUrl = 'https://horizon-testnet.stellar.org') {
    this.server = new StellarSDK.Horizon.Server(serverUrl);
    this.contractAddress = null; // Will be set during deployment
  }

  /**
   * Deploy the DID registry contract
   */
  async deploy(deployerSecret) {
    try {
      const deployerKeypair = StellarSDK.Keypair.fromSecret(deployerSecret);
      const deployerAccount = await this.server.loadAccount(deployerKeypair.publicKey());

      // Create contract account
      const contractKeypair = StellarSDK.Keypair.random();
      
      const transaction = new StellarSDK.TransactionBuilder(deployerAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.createAccount({
          destination: contractKeypair.publicKey(),
          startingBalance: '2.5' // Minimum balance for contract
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: 'contract_type',
          value: 'stellar_did_registry_v1'
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: 'contract_version',
          value: '1.0.0'
        }))
        .addOperation(StellarSDK.Operation.setOptions({
          masterWeight: 0, // Remove master key
          lowThreshold: 1,
          mediumThreshold: 1,
          highThreshold: 1
        }))
        .setTimeout(30)
        .build();

      transaction.sign(deployerKeypair);
      const result = await this.server.submitTransaction(transaction);

      this.contractAddress = contractKeypair.publicKey();
      
      return {
        contractAddress: this.contractAddress,
        transactionHash: result.hash,
        contractSecret: contractKeypair.secret() // Return for testing
      };
    } catch (error) {
      throw new Error(`Contract deployment failed: ${error.message}`);
    }
  }

  /**
   * Register a new DID on the contract
   */
  async registerDID(did, publicKey, serviceEndpoint, signerSecret) {
    if (!did || !publicKey || !signerSecret) {
      throw new Error('DID, publicKey, and signerSecret are required');
    }
    if (!did.startsWith('did:')) {
      throw new Error('DID must start with "did:"');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Check DID doesn't already exist
      const existing = contractAccount.data_attr[`did_${did}`];
      if (existing) {
        throw new Error('DID already exists');
      }

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE * 3,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `did_${did}`,
          value: JSON.stringify({
            did,
            publicKey,
            serviceEndpoint,
            owner: signerKeypair.publicKey(),
            created: new Date().toISOString(),
            active: true
          })
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `did_owner_${did}`,
          value: signerKeypair.publicKey()
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `did_created_${did}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      // Sign with contract account (multi-sig setup required)
      // For now, we'll use the signer as proxy
      transaction.sign(signerKeypair);
      
      const result = await this.server.submitTransaction(transaction);
      return result;
    } catch (error) {
      throw new Error(`DID registration failed: ${error.message}`);
    }
  }

  /**
   * Update DID document
   */
  async updateDID(did, updates, signerSecret) {
    if (!did || !signerSecret) {
      throw new Error('DID and signerSecret are required');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Get current DID data
      const currentData = await this.getDID(did);

      if (!currentData) {
        throw new Error('DID not found');
      }

      // Ownership check: only the DID owner can update it
      if (currentData.owner !== signerKeypair.publicKey()) {
        throw new Error('Unauthorized: only the DID owner can update this DID');
      }

      const updatedData = {
        ...currentData,
        ...updates,
        updated: new Date().toISOString()
      };

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `did_${did}`,
          value: JSON.stringify(updatedData)
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `did_updated_${did}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      transaction.sign(signerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return result;
    } catch (error) {
      throw new Error(`DID update failed: ${error.message}`);
    }
  }

  /**
   * Issue a verifiable credential
   */
  async issueCredential(issuerDID, subjectDID, credentialType, claims, signerSecret) {
    if (!issuerDID || !subjectDID || !credentialType || !signerSecret) {
      throw new Error('issuerDID, subjectDID, credentialType, and signerSecret are required');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Verify the issuer DID exists and the signer is its owner
      const issuerDoc = await this.getDID(issuerDID);
      if (!issuerDoc) {
        throw new Error('Issuer DID not found');
      }
      if (issuerDoc.owner !== signerKeypair.publicKey()) {
        throw new Error('Unauthorized: signer is not the owner of the issuer DID');
      }

      const credentialId = this.generateCredentialId(issuerDID, subjectDID, credentialType);
      
      const credential = {
        id: credentialId,
        issuer: issuerDID,
        subject: subjectDID,
        type: credentialType,
        claims,
        issued: new Date().toISOString(),
        revoked: false
      };

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE * 2,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_${credentialId}`,
          value: JSON.stringify(credential)
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_issued_${credentialId}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      transaction.sign(signerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return { credential, transaction: result };
    } catch (error) {
      throw new Error(`Credential issuance failed: ${error.message}`);
    }
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(credentialId, signerSecret) {
    if (!credentialId || !signerSecret) {
      throw new Error('credentialId and signerSecret are required');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Get current credential
      const credential = await this.getCredential(credentialId);

      if (!credential) {
        throw new Error('Credential not found');
      }

      if (credential.revoked) {
        throw new Error('Credential is already revoked');
      }

      // Issuer ownership check: only the issuer's DID owner can revoke
      const issuerDoc = await this.getDID(credential.issuer);
      if (!issuerDoc) {
        throw new Error('Issuer DID not found');
      }
      if (issuerDoc.owner !== signerKeypair.publicKey()) {
        throw new Error('Unauthorized: only the credential issuer can revoke this credential');
      }

      const updatedCredential = {
        ...credential,
        revoked: true,
        revokedAt: new Date().toISOString()
      };

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_${credentialId}`,
          value: JSON.stringify(updatedCredential)
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_revoked_${credentialId}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      transaction.sign(signerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return result;
    } catch (error) {
      throw new Error(`Credential revocation failed: ${error.message}`);
    }
  }

  /**
   * Get DID document from contract
   */
  async getDID(did) {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      const didData = account.data_attr[`did_${did}`];
      
      if (!didData) {
        return null;
      }

      return JSON.parse(didData);
    } catch (error) {
      throw new Error(`Failed to get DID: ${error.message}`);
    }
  }

  /**
   * Get credential from contract
   */
  async getCredential(credentialId) {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      const credentialData = account.data_attr[`credential_${credentialId}`];
      
      if (!credentialData) {
        return null;
      }

      return JSON.parse(credentialData);
    } catch (error) {
      throw new Error(`Failed to get credential: ${error.message}`);
    }
  }

  /**
   * Get all DIDs for an owner
   */
  async getOwnerDIDs(ownerPublicKey) {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      const dids = [];
      
      // Find all DID entries for this owner
      Object.keys(account.data_attr).forEach(key => {
        if (key.startsWith('did_owner_')) {
          const did = key.replace('did_owner_', '');
          const didData = account.data_attr[`did_${did}`];
          
          if (didData) {
            const parsed = JSON.parse(didData);
            if (parsed.owner === ownerPublicKey) {
              dids.push(parsed);
            }
          }
        }
      });

      return dids;
    } catch (error) {
      throw new Error(`Failed to get owner DIDs: ${error.message}`);
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo() {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      
      return {
        address: this.contractAddress,
        type: account.data_attr.contract_type,
        version: account.data_attr.contract_version,
        dataEntries: Object.keys(account.data_attr).length
      };
    } catch (error) {
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * Generate unique credential ID
   */
  generateCredentialId(issuerDID, subjectDID, credentialType) {
    const crypto = require('crypto');
    const data = `${issuerDID}${subjectDID}${credentialType}${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Verify credential signature (mock implementation)
   */
  async verifyCredential(credentialId) {
    try {
      const credential = await this.getCredential(credentialId);
      
      if (!credential) {
        return { valid: false, error: 'Credential not found' };
      }

      if (credential.revoked) {
        return { valid: false, error: 'Credential has been revoked' };
      }

      // Additional verification logic would go here
      // For now, just check if it exists and isn't revoked
      
      return { 
        valid: true, 
        credential,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = DIDContract;
