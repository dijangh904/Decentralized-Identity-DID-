const { Server, Networks, TransactionBuilder, Operation, Asset } = require('stellar-sdk');
const { logger } = require('../middleware');
const redis = require('../utils/redis');

// Custom error classes for better error handling
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

class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

class StellarService {
  constructor() {
    this.server = new Server(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org');
    this.network = process.env.STELLAR_NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
    this.cachePrefix = 'stellar:';
    this.subscriptionChannels = {
      TRANSACTION_CREATED: 'transaction_created',
      TRANSACTION_UPDATED: 'transaction_updated',
      NETWORK_STATS_UPDATED: 'network_stats_updated'
    };
  }

  async getAccount(address) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}account:${address}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from Stellar network
      const account = await this.server.loadAccount(address);
      
      const accountData = {
        address: account.account_id(),
        publicKey: account.account_id(),
        balance: this.getTotalBalance(account.balances),
        sequence: account.sequence,
        signers: account.signers.map(signer => ({
          key: signer.key,
          weight: signer.weight,
          type: signer.type || 'ed25519_public_key'
        })),
        thresholds: {
          lowThreshold: account.thresholds.low_threshold,
          medThreshold: account.thresholds.med_threshold,
          highThreshold: account.thresholds.high_threshold
        },
        flags: {
          authRequired: account.flags.auth_required,
          authRevocable: account.flags.auth_revocable,
          authImmutable: account.flags.auth_immutable
        }
      };

      // Cache for 30 seconds
      await redis.setex(cacheKey, 30, JSON.stringify(accountData));
      
      return accountData;
    } catch (error) {
      logger.error('Error fetching Stellar account:', error);
      throw this.handleStellarError(error, 'Failed to fetch Stellar account');
    }
  }

  async getAccounts(filters = {}, options = {}) {
    try {
      const { minBalance, hasSigners } = filters;
      const { limit = 10, offset = 0 } = options;

      // This is a simplified implementation
      // In production, you might want to maintain a database of known accounts
      const accounts = [];
      
      // For demonstration, we'll return empty array
      // You would implement actual account discovery logic here
      
      return accounts;
    } catch (error) {
      logger.error('Error fetching Stellar accounts:', error);
      throw this.handleStellarError(error, 'Failed to fetch Stellar accounts');
    }
  }

  async getTransaction(hash) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}transaction:${hash}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from Stellar network
      const transaction = await this.server.transactions().transaction(hash);
      
      const transactionData = {
        id: transaction.id,
        hash: transaction.hash,
        sourceAccount: transaction.source_account,
        fee: parseInt(transaction.fee_paid),
        memo: transaction.memo,
        operations: transaction.operations.map(op => ({
          id: op.id,
          type: op.type,
          sourceAccount: op.source_account,
          details: op
        })),
        createdAt: new Date(transaction.created_at),
        successful: transaction.successful,
        status: this.getTransactionStatus(transaction)
      };

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(transactionData));
      
      return transactionData;
    } catch (error) {
      logger.error('Error fetching Stellar transaction:', error);
      throw this.handleStellarError(error, 'Failed to fetch Stellar transaction');
    }
  }

  async getTransactions(filters = {}, options = {}) {
    try {
      const { sourceAccount, status } = filters;
      const { limit = 10, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = options;

      let builder = this.server.transactions();
      
      if (sourceAccount) {
        builder = builder.forAccount(sourceAccount);
      }
      
      if (limit) {
        builder = builder.limit(limit);
      }
      
      if (offset) {
        builder = builder.cursor(offset.toString());
      }
      
      if (sortOrder === 'asc') {
        builder = builder.order('asc');
      }

      const transactions = await builder.call();
      
      let filteredTransactions = transactions.records;
      
      // Filter by status if specified
      if (status) {
        filteredTransactions = filteredTransactions.filter(tx => 
          this.getTransactionStatus(tx) === status
        );
      }

      return filteredTransactions.map(tx => ({
        id: tx.id,
        hash: tx.hash,
        sourceAccount: tx.source_account,
        fee: parseInt(tx.fee_paid),
        memo: tx.memo,
        operations: tx.operations.map(op => ({
          id: op.id,
          type: op.type,
          sourceAccount: op.source_account,
          details: op
        })),
        createdAt: new Date(tx.created_at),
        successful: tx.successful,
        status: this.getTransactionStatus(tx)
      }));
    } catch (error) {
      logger.error('Error fetching Stellar transactions:', error);
      throw this.handleStellarError(error, 'Failed to fetch Stellar transactions');
    }
  }

  async getTransactionCount(filters = {}) {
    try {
      const { sourceAccount, status } = filters;
      
      // This is a simplified implementation
      // In production, you would maintain a database of transaction counts
      return 0;
    } catch (error) {
      logger.error('Error fetching transaction count:', error);
      throw this.handleStellarError(error, 'Failed to fetch transaction count');
    }
  }

  async createTransaction(transactionData) {
    try {
      const { sourceAccount, operations, memo, fee = 100 } = transactionData;
      
      // Load source account
      const account = await this.server.loadAccount(sourceAccount);
      
      // Build transaction
      const transaction = new TransactionBuilder(account, {
        networkPassphrase: this.network,
        fee
      });

      // Add operations
      operations.forEach(op => {
        switch (op.type) {
          case 'payment':
            transaction.addOperation(Operation.payment({
              destination: op.destination,
              asset: op.asset ? new Asset(op.asset.code, op.asset.issuer) : Asset.native(),
              amount: op.amount
            }));
            break;
          case 'createAccount':
            transaction.addOperation(Operation.createAccount({
              destination: op.destination,
              startingBalance: op.startingBalance
            }));
            break;
          case 'manageData':
            transaction.addOperation(Operation.manageData({
              name: op.name,
              value: op.value
            }));
            break;
          // Add more operation types as needed
          default:
            throw new Error(`Unsupported operation type: ${op.type}`);
        }
      });

      if (memo) {
        transaction.addMemo(memo);
      }

      // Build the transaction
      const builtTransaction = transaction.setTimeout(30).build();
      
      // Return transaction details without signing
      return {
        id: `pending_${Date.now()}`,
        hash: null,
        sourceAccount,
        fee,
        memo: memo ? memo.value : null,
        operations: operations.map((op, index) => ({
          id: `op_${index}`,
          type: op.type,
          sourceAccount,
          details: op
        })),
        createdAt: new Date(),
        successful: false,
        status: 'PENDING',
        xdr: builtTransaction.toXDR()
      };
    } catch (error) {
      logger.error('Error creating Stellar transaction:', error);
      throw this.handleStellarError(error, 'Failed to create Stellar transaction');
    }
  }

  async submitTransaction(transactionXDR) {
    try {
      // Submit transaction to Stellar network
      const result = await this.server.submitTransaction(transactionXDR);
      
      const transactionData = {
        id: result.id,
        hash: result.hash,
        sourceAccount: result.source_account,
        fee: parseInt(result.fee_charged),
        memo: result.memo,
        operations: result.operations.map(op => ({
          id: op.id,
          type: op.type,
          sourceAccount: op.source_account,
          details: op
        })),
        createdAt: new Date(result.created_at),
        successful: result.successful,
        status: result.successful ? 'SUCCESS' : 'FAILED'
      };

      // Publish to subscription channel
      await this.publishTransactionEvent(this.subscriptionChannels.TRANSACTION_CREATED, transactionData);

      return transactionData;
    } catch (error) {
      logger.error('Error submitting Stellar transaction:', error);
      throw this.handleStellarError(error, 'Failed to submit Stellar transaction');
    }
  }

  async getNetworkStats() {
    try {
      // Fetch network statistics
      const [latestLedger, stats] = await Promise.all([
        this.server.ledgers().order('desc').limit(1).call(),
        this.getCustomStats()
      ]);

      return {
        latestLedger: latestLedger.records[0]?.sequence || 0,
        network: process.env.STELLAR_NETWORK || 'TESTNET',
        ...stats,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error fetching network stats:', error);
      throw this.handleStellarError(error, 'Failed to fetch network statistics');
    }
  }

  // Subscription methods
  subscribeToTransactionCreated(sourceAccount) {
    return {
      async *[Symbol.asyncIterator]() {
        const channel = sourceAccount
          ? `${this.subscriptionChannels.TRANSACTION_CREATED}:${sourceAccount}`
          : this.subscriptionChannels.TRANSACTION_CREATED;
        
        logger.info(`Subscribed to transaction created events for account: ${sourceAccount || 'all'}`);
      }
    };
  }

  subscribeToTransactionUpdated(hash) {
    return {
      async *[Symbol.asyncIterator]() {
        const channel = hash
          ? `${this.subscriptionChannels.TRANSACTION_UPDATED}:${hash}`
          : this.subscriptionChannels.TRANSACTION_UPDATED;
        
        logger.info(`Subscribed to transaction updated events for hash: ${hash || 'all'}`);
      }
    };
  }

  subscribeToNetworkStatsUpdated() {
    return {
      async *[Symbol.asyncIterator]() {
        logger.info('Subscribed to network stats updated events');
      }
    };
  }

  // Helper methods
  getTotalBalance(balances) {
    const nativeBalance = balances.find(b => b.asset_type === 'native');
    return nativeBalance ? parseFloat(nativeBalance.balance).toFixed(7) : '0.0000000';
  }

  getTransactionStatus(transaction) {
    if (transaction.successful) {
      return 'SUCCESS';
    } else if (transaction.result_xdr) {
      return 'FAILED';
    } else {
      return 'PENDING';
    }
  }

  async getCustomStats() {
    // This would fetch custom statistics from your database
    return {
      totalTransactions: 0,
      totalAccounts: 0,
      totalVolume: '0.0000000'
    };
  }

  async publishTransactionEvent(event, data) {
    try {
      // Publish to Redis pub/sub
      await redis.publish(event, JSON.stringify(data));
    } catch (error) {
      logger.error('Error publishing transaction event:', error);
    }
  }

  handleStellarError(error, defaultMessage) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};
      
      if (status === 404) {
        return new AccountNotFoundError('Account not found on the Stellar network');
      }
      
      if (status === 400 || status === 403 || status === 504) {
        let errorMsg = defaultMessage;
        
        if (data.extras && data.extras.result_codes) {
          const codes = data.extras.result_codes;
          
          if (codes.transaction === 'tx_bad_seq') {
            errorMsg = 'bad_sequence: Transaction has a bad sequence number';
          } else if (codes.transaction === 'tx_insufficient_balance' || (codes.operations && codes.operations.includes('op_underfunded'))) {
            errorMsg = 'insufficient balance to complete this operation';
          } else {
             let messages = [];
             if (data.title) messages.push(data.title);
             if (data.detail) messages.push(data.detail);
             let codesStr = [];
             if (codes.transaction) codesStr.push(`Transaction: ${codes.transaction}`);
             if (codes.operations && codes.operations.length > 0) {
               codesStr.push(`Operations: ${codes.operations.join(', ')}`);
             }
             if (codesStr.length > 0) {
               messages.push(`Result Codes: [${codesStr.join(' | ')}]`);
             }
             if (messages.length > 0) {
               errorMsg = messages.join('. ');
             }
          }
        }
        return new TransactionFailedError(errorMsg);
      }
      
      if (status >= 500) {
        return new NetworkError('Stellar network is currently experiencing issues');
      }
    }

    if (error.message) {
      if (error.message.includes('Network Error') || error.message.includes('timeout')) {
        return new NetworkError('timeout: Connection to Stellar network failed');
      }
      if (!error.message.includes('Request failed with status code')) {
        return new Error(`${defaultMessage}: ${error.message}`);
      }
    }

    return new Error(defaultMessage);
  }
}

module.exports = new StellarService();
