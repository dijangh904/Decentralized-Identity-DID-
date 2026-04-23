const { logger } = require('../middleware');
const DIDService = require('../services/didService');
const CredentialService = require('../services/credentialService');
const StellarService = require('../services/stellarService');
const ContractService = require('../services/contractService');

const resolvers = {
  Query: {
    // DID Queries
    did: async (_, { did }) => {
      try {
        return await DIDService.getDID(did);
      } catch (error) {
        logger.error('Error fetching DID:', error);
        throw new Error('Failed to fetch DID');
      }
    },

    dids: async (_, { owner, active, limit, offset, sortBy, sortOrder }) => {
      try {
        const filters = { owner, active };
        const options = { limit, offset, sortBy, sortOrder };
        return await DIDService.getDIDs(filters, options);
      } catch (error) {
        logger.error('Error fetching DIDs:', error);
        throw new Error('Failed to fetch DIDs');
      }
    },

    didCount: async (_, { active }) => {
      try {
        return await DIDService.getDIDCount({ active });
      } catch (error) {
        logger.error('Error fetching DID count:', error);
        throw new Error('Failed to fetch DID count');
      }
    },

    // Credential Queries
    credential: async (_, { id }) => {
      try {
        return await CredentialService.getCredential(id);
      } catch (error) {
        logger.error('Error fetching credential:', error);
        throw new Error('Failed to fetch credential');
      }
    },

    credentials: async (_, { 
      issuer, 
      subject, 
      credentialType, 
      revoked, 
      expired, 
      limit, 
      offset, 
      sortBy, 
      sortOrder 
    }) => {
      try {
        const filters = { issuer, subject, credentialType, revoked, expired };
        const options = { limit, offset, sortBy, sortOrder };
        return await CredentialService.getCredentials(filters, options);
      } catch (error) {
        logger.error('Error fetching credentials:', error);
        throw new Error('Failed to fetch credentials');
      }
    },

    credentialCount: async (_, { issuer, subject, credentialType, revoked, expired }) => {
      try {
        const filters = { issuer, subject, credentialType, revoked, expired };
        return await CredentialService.getCredentialCount(filters);
      } catch (error) {
        logger.error('Error fetching credential count:', error);
        throw new Error('Failed to fetch credential count');
      }
    },

    // Stellar Account Queries
    stellarAccount: async (_, { address }) => {
      try {
        return await StellarService.getAccount(address);
      } catch (error) {
        logger.error('Error fetching Stellar account:', error);
        throw new Error('Failed to fetch Stellar account');
      }
    },

    stellarAccounts: async (_, { limit, offset, minBalance, hasSigners }) => {
      try {
        const filters = { minBalance, hasSigners };
        const options = { limit, offset };
        return await StellarService.getAccounts(filters, options);
      } catch (error) {
        logger.error('Error fetching Stellar accounts:', error);
        throw new Error('Failed to fetch Stellar accounts');
      }
    },

    // Transaction Queries
    transaction: async (_, { hash }) => {
      try {
        return await StellarService.getTransaction(hash);
      } catch (error) {
        logger.error('Error fetching transaction:', error);
        throw new Error('Failed to fetch transaction');
      }
    },

    transactions: async (_, { 
      sourceAccount, 
      status, 
      limit, 
      offset, 
      sortBy, 
      sortOrder 
    }) => {
      try {
        const filters = { sourceAccount, status };
        const options = { limit, offset, sortBy, sortOrder };
        return await StellarService.getTransactions(filters, options);
      } catch (error) {
        logger.error('Error fetching transactions:', error);
        throw new Error('Failed to fetch transactions');
      }
    },

    transactionCount: async (_, { sourceAccount, status }) => {
      try {
        const filters = { sourceAccount, status };
        return await StellarService.getTransactionCount(filters);
      } catch (error) {
        logger.error('Error fetching transaction count:', error);
        throw new Error('Failed to fetch transaction count');
      }
    },

    // Contract Queries
    contractInfo: async () => {
      try {
        return await ContractService.getContractInfo();
      } catch (error) {
        logger.error('Error fetching contract info:', error);
        throw new Error('Failed to fetch contract info');
      }
    },

    contractData: async (_, { key }) => {
      try {
        return await ContractService.getContractData(key);
      } catch (error) {
        logger.error('Error fetching contract data:', error);
        throw new Error('Failed to fetch contract data');
      }
    },

    // Network Statistics
    networkStats: async () => {
      try {
        const stats = await Promise.all([
          DIDService.getDIDCount(),
          DIDService.getDIDCount({ active: true }),
          CredentialService.getCredentialCount(),
          CredentialService.getCredentialCount({ revoked: false }),
          StellarService.getTransactionCount()
        ]);

        return {
          totalDIDs: stats[0],
          activeDIDs: stats[1],
          totalCredentials: stats[2],
          activeCredentials: stats[3],
          totalTransactions: stats[4],
          network: process.env.STELLAR_NETWORK || 'TESTNET',
          lastUpdated: new Date()
        };
      } catch (error) {
        logger.error('Error fetching network stats:', error);
        throw new Error('Failed to fetch network statistics');
      }
    },

    // Search Queries
    searchDIDs: async (_, { query, limit }) => {
      try {
        return await DIDService.searchDIDs(query, limit);
      } catch (error) {
        logger.error('Error searching DIDs:', error);
        throw new Error('Failed to search DIDs');
      }
    },

    searchCredentials: async (_, { query, limit }) => {
      try {
        return await CredentialService.searchCredentials(query, limit);
      } catch (error) {
        logger.error('Error searching credentials:', error);
        throw new Error('Failed to search credentials');
      }
    }
  },

  Mutation: {
    // DID Mutations
    createDID: async (_, { 
      did, 
      publicKey, 
      serviceEndpoint, 
      verificationMethods, 
      services 
    }) => {
      try {
        const didData = {
          did,
          publicKey,
          serviceEndpoint,
          verificationMethods,
          services
        };
        return await DIDService.createDID(didData);
      } catch (error) {
        logger.error('Error creating DID:', error);
        throw new Error('Failed to create DID');
      }
    },

    updateDID: async (_, { 
      did, 
      publicKey, 
      serviceEndpoint, 
      verificationMethods, 
      services 
    }) => {
      try {
        const updateData = {
          publicKey,
          serviceEndpoint,
          verificationMethods,
          services
        };
        return await DIDService.updateDID(did, updateData);
      } catch (error) {
        logger.error('Error updating DID:', error);
        throw new Error('Failed to update DID');
      }
    },

    deactivateDID: async (_, { did }) => {
      try {
        return await DIDService.deactivateDID(did);
      } catch (error) {
        logger.error('Error deactivating DID:', error);
        throw new Error('Failed to deactivate DID');
      }
    },

    // Credential Mutations
    issueCredential: async (_, { 
      issuer, 
      subject, 
      credentialType, 
      claims, 
      expires, 
      credentialSchema, 
      proof 
    }) => {
      try {
        const credentialData = {
          issuer,
          subject,
          credentialType,
          claims,
          expires,
          credentialSchema,
          proof
        };
        return await CredentialService.issueCredential(credentialData);
      } catch (error) {
        logger.error('Error issuing credential:', error);
        throw new Error('Failed to issue credential');
      }
    },

    revokeCredential: async (_, { id }) => {
      try {
        return await CredentialService.revokeCredential(id);
      } catch (error) {
        logger.error('Error revoking credential:', error);
        throw new Error('Failed to revoke credential');
      }
    },

    batchRevokeCredentials: async (_, { ids }) => {
      try {
        const result = await CredentialService.batchRevokeCredentials(ids);
        return {
          successful: result.successful,
          failed: result.failed,
          errors: result.errors || []
        };
      } catch (error) {
        logger.error('Error batch revoking credentials:', error);
        throw new Error('Failed to batch revoke credentials');
      }
    },

    // Stellar Transaction Mutations
    createTransaction: async (_, { 
      sourceAccount, 
      operations, 
      memo, 
      fee 
    }) => {
      try {
        const transactionData = {
          sourceAccount,
          operations,
          memo,
          fee
        };
        return await StellarService.createTransaction(transactionData);
      } catch (error) {
        logger.error('Error creating transaction:', error);
        throw new Error('Failed to create transaction');
      }
    },

    submitTransaction: async (_, { transactionHash }) => {
      try {
        return await StellarService.submitTransaction(transactionHash);
      } catch (error) {
        logger.error('Error submitting transaction:', error);
        throw new Error('Failed to submit transaction');
      }
    },

    // Contract Mutations
    deployContract: async (_, { deployerSecret }) => {
      try {
        return await ContractService.deployContract(deployerSecret);
      } catch (error) {
        logger.error('Error deploying contract:', error);
        throw new Error('Failed to deploy contract');
      }
    },

    updateContractData: async (_, { key, value }) => {
      try {
        return await ContractService.updateContractData(key, value);
      } catch (error) {
        logger.error('Error updating contract data:', error);
        throw new Error('Failed to update contract data');
      }
    },

    // Admin Mutations
    transferAdmin: async (_, { newAdmin }) => {
      try {
        return await ContractService.transferAdmin(newAdmin);
      } catch (error) {
        logger.error('Error transferring admin:', error);
        throw new Error('Failed to transfer admin');
      }
    },

    pauseContract: async () => {
      try {
        return await ContractService.pauseContract();
      } catch (error) {
        logger.error('Error pausing contract:', error);
        throw new Error('Failed to pause contract');
      }
    },

    unpauseContract: async () => {
      try {
        return await ContractService.unpauseContract();
      } catch (error) {
        logger.error('Error unpausing contract:', error);
        throw new Error('Failed to unpause contract');
      }
    }
  },

  Subscription: {
    // DID Subscriptions
    didCreated: {
      subscribe: (_, { owner }) => {
        return DIDService.subscribeToDIDCreated(owner);
      }
    },

    didUpdated: {
      subscribe: (_, { did }) => {
        return DIDService.subscribeToDIDUpdated(did);
      }
    },

    didDeactivated: {
      subscribe: (_, { did }) => {
        return DIDService.subscribeToDIDDeactivated(did);
      }
    },

    // Credential Subscriptions
    credentialIssued: {
      subscribe: (_, { issuer, subject }) => {
        return CredentialService.subscribeToCredentialIssued(issuer, subject);
      }
    },

    credentialRevoked: {
      subscribe: (_, { issuer, subject }) => {
        return CredentialService.subscribeToCredentialRevoked(issuer, subject);
      }
    },

    // Transaction Subscriptions
    transactionCreated: {
      subscribe: (_, { sourceAccount }) => {
        return StellarService.subscribeToTransactionCreated(sourceAccount);
      }
    },

    transactionUpdated: {
      subscribe: (_, { hash }) => {
        return StellarService.subscribeToTransactionUpdated(hash);
      }
    },

    // Network Subscriptions
    networkStatsUpdated: {
      subscribe: () => {
        return StellarService.subscribeToNetworkStatsUpdated();
      }
    }
  }
};

module.exports = resolvers;
