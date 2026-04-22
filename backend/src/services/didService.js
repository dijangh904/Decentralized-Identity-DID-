const { logger } = require('../middleware');
const { formatErrorResponse } = require('../utils/errorMessages');
const enhancedCache = require('./enhancedCacheService');

class DIDService {
  constructor() {
    this.cachePrefix = 'did:';
    this.subscriptionChannels = {
      DID_CREATED: 'did_created',
      DID_UPDATED: 'did_updated',
      DID_DEACTIVATED: 'did_deactivated'
    };
  }

  async getDID(did) {
    try {
      // Use enhanced cache with intelligent TTL
      return await enhancedCache.wrap('did', did, async () => {
        // Fetch from database/blockchain
        const didDocument = await this.fetchDIDFromSource(did);

        if (!didDocument) {
          throw new Error('DID not found');
        }

        return didDocument;
      }, {
        dataType: 'did',
        status: 'default' // Will be inferred from data
      });
    } catch (error) {
      logger.error('Error fetching DID:', error);
      throw error;
    }
  }

  async getDIDs(filters = {}, options = {}) {
    try {
      const { owner, active } = filters;
      const { limit = 10, offset = 0, sortBy = 'created', sortOrder = 'desc' } = options;

      // Build query based on filters
      const query = {};
      if (owner) query.owner = owner;
      if (active !== undefined) query.active = active;

      // Fetch from database with pagination and sorting
      const dids = await this.fetchDIDsFromSource(query, { limit, offset, sortBy, sortOrder });

      // Add verification methods and services
      const enrichedDIDs = await Promise.all(
        dids.map(async (did) => {
          const verificationMethods = await this.getVerificationMethods(did.did);
          const services = await this.getServices(did.did);
          return {
            ...did,
            verificationMethods,
            services
          };
        })
      );

      return enrichedDIDs;
    } catch (error) {
      logger.error('Error fetching DIDs:', error);
      throw error;
    }
  }

  async getDIDCount(filters = {}) {
    try {
      const { owner, active } = filters;
      const query = {};
      if (owner) query.owner = owner;
      if (active !== undefined) query.active = active;

      return await this.countDIDsFromSource(query);
    } catch (error) {
      logger.error('Error fetching DID count:', error);
      throw error;
    }
  }

  async createDID(didData) {
    try {
      const { did, publicKey, serviceEndpoint, verificationMethods, services } = didData;

      // Validate DID format
      if (!this.validateDIDFormat(did)) {
        throw new Error('Invalid DID format');
      }

      // Check if DID already exists
      const existing = await this.getDID(did).catch(() => null);
      if (existing) {
        throw new Error('DID already exists');
      }

      // Create DID document
      const didDocument = {
        id: did,
        did,
        owner: didData.owner || this.extractOwnerFromDID(did),
        publicKey,
        created: new Date(),
        updated: new Date(),
        active: true,
        serviceEndpoint
      };

      // Save to database/blockchain
      const created = await this.saveDIDToSource(didDocument);

      // Save verification methods and services
      if (verificationMethods && verificationMethods.length > 0) {
        await this.saveVerificationMethods(did, verificationMethods);
      }

      if (services && services.length > 0) {
        await this.saveServices(did, services);
      }

      // Cache the new DID with intelligent TTL
      await enhancedCache.set('did', did, created, enhancedCache.getTTLForType('did', 'active'));

      // Cache verification methods and services
      if (verificationMethods) {
        await enhancedCache.set('verification', did, verificationMethods, enhancedCache.getTTLForType('verification', 'active'));
      }
      if (services) {
        await enhancedCache.set('service', did, services, enhancedCache.getTTLForType('service', 'active'));
      }

      // Publish to subscription channel
      await this.publishDIDEvent(this.subscriptionChannels.DID_CREATED, created);

      logger.info('DID created successfully:', { did, owner: created.owner });
      return created;
    } catch (error) {
      logger.error('Error creating DID:', error);
      throw error;
    }
  }

  async updateDID(did, updateData) {
    try {
      const existing = await this.getDID(did);
      if (!existing) {
        throw new Error('DID not found');
      }

      if (!existing.active) {
        throw new Error('Cannot update inactive DID');
      }

      // Invalidate existing cache entries
      await enhancedCache.invalidateRelated([
        { namespace: 'did', id: did, relationType: 'did' }
      ]);

      // Update fields
      const updated = {
        ...existing,
        ...updateData,
        updated: new Date()
      };

      // Save to database/blockchain
      await this.saveDIDToSource(updated);

      // Update verification methods and services if provided
      if (updateData.verificationMethods) {
        await this.saveVerificationMethods(did, updateData.verificationMethods);
        await enhancedCache.set('verification', did, updateData.verificationMethods, enhancedCache.getTTLForType('verification', 'active'));
      }

      if (updateData.services) {
        await this.saveServices(did, updateData.services);
        await enhancedCache.set('service', did, updateData.services, enhancedCache.getTTLForType('service', 'active'));
      }

      // Cache updated DID with intelligent TTL
      const status = updated.active ? 'active' : 'inactive';
      await enhancedCache.set('did', did, updated, enhancedCache.getTTLForType('did', status));

      // Publish to subscription channel
      await this.publishDIDEvent(this.subscriptionChannels.DID_UPDATED, updated);

      logger.info('DID updated successfully:', { did });
      return updated;
    } catch (error) {
      logger.error('Error updating DID:', error);
      throw error;
    }
  }

  async deactivateDID(did) {
    try {
      const existing = await this.getDID(did);
      if (!existing) {
        throw new Error('DID not found');
      }

      const deactivated = {
        ...existing,
        active: false,
        updated: new Date()
      };

      // Save to database/blockchain
      await this.saveDIDToSource(deactivated);

      // Invalidate all DID-related cache entries
      await enhancedCache.invalidateRelated([
        { namespace: 'did', id: did, relationType: 'did' }
      ]);

      // Cache deactivated DID with longer TTL
      await enhancedCache.set('did', did, deactivated, enhancedCache.getTTLForType('did', 'inactive'));

      // Publish to subscription channel
      await this.publishDIDEvent(this.subscriptionChannels.DID_DEACTIVATED, deactivated);

      logger.info('DID deactivated successfully:', { did });
      return deactivated;
    } catch (error) {
      logger.error('Error deactivating DID:', error);
      throw error;
    }
  }

  async searchDIDs(query, limit = 10) {
    try {
      // Implement search logic (could use text search, full-text search, etc.)
      const results = await this.searchDIDsInSource(query, limit);

      // Add verification methods and services
      const enrichedResults = await Promise.all(
        results.map(async (did) => {
          const verificationMethods = await this.getVerificationMethods(did.did);
          const services = await this.getServices(did.did);
          return {
            ...did,
            verificationMethods,
            services
          };
        })
      );

      return enrichedResults;
    } catch (error) {
      logger.error('Error searching DIDs:', error);
      throw error;
    }
  }

  // Subscription methods
  subscribeToDIDCreated(owner) {
    return {
      async *[Symbol.asyncIterator]() {
        // Implement Redis pub/sub or WebSocket subscription
        const channel = owner
          ? `${DIDService.prototype.subscriptionChannels.DID_CREATED}:${owner}`
          : DIDService.prototype.subscriptionChannels.DID_CREATED;

        // This is a simplified implementation
        // In production, you'd use proper Redis pub/sub or WebSocket
        logger.info(`Subscribed to DID created events for owner: ${owner || 'all'}`);
      }
    };
  }

  subscribeToDIDUpdated(did) {
    return {
      async *[Symbol.asyncIterator]() {
        const channel = `${DIDService.prototype.subscriptionChannels.DID_UPDATED}:${did}`;
        logger.info(`Subscribed to DID updated events for: ${did}`);
      }
    };
  }

  subscribeToDIDDeactivated(did) {
    return {
      async *[Symbol.asyncIterator]() {
        const channel = `${DIDService.prototype.subscriptionChannels.DID_DEACTIVATED}:${did}`;
        logger.info(`Subscribed to DID deactivated events for: ${did}`);
      }
    };
  }

  // Helper methods
  validateDIDFormat(did) {
    // Stellar DID format: did:stellar:G[A-Z0-9]{55}
    const stellarDIDRegex = /^did:stellar:G[A-Z0-9]{55}$/;
    return stellarDIDRegex.test(did);
  }

  extractOwnerFromDID(did) {
    // Extract Stellar public key from DID
    const match = did.match(/^did:stellar:(G[A-Z0-9]{55})$/);
    return match ? match[1] : null;
  }

  async getVerificationMethods(did) {
    try {
      // Fetch verification methods from database
      return await this.fetchVerificationMethodsFromSource(did);
    } catch (error) {
      logger.error('Error fetching verification methods:', error);
      return [];
    }
  }

  async getServices(did) {
    try {
      // Fetch services from database
      return await this.fetchServicesFromSource(did);
    } catch (error) {
      logger.error('Error fetching services:', error);
      return [];
    }
  }

  async publishDIDEvent(event, data) {
    try {
      // Publish to Redis pub/sub
      await redis.publish(event, JSON.stringify(data));
    } catch (error) {
      logger.error('Error publishing DID event:', error);
    }
  }

  // Database/blockchain integration methods (to be implemented based on your storage)
  async fetchDIDFromSource(did) {
    // Implement actual fetch from your database or blockchain
    throw new Error('fetchDIDFromSource not implemented');
  }

  async fetchDIDsFromSource(query, options) {
    // Implement actual fetch with pagination and sorting
    throw new Error('fetchDIDsFromSource not implemented');
  }

  async countDIDsFromSource(query) {
    // Implement actual count
    throw new Error('countDIDsFromSource not implemented');
  }

  async saveDIDToSource(didDocument) {
    // Implement actual save
    throw new Error('saveDIDToSource not implemented');
  }

  async saveVerificationMethods(did, verificationMethods) {
    // Implement actual save
    throw new Error('saveVerificationMethods not implemented');
  }

  async saveServices(did, services) {
    // Implement actual save
    throw new Error('saveServices not implemented');
  }

  async fetchVerificationMethodsFromSource(did) {
    // Implement actual fetch
    throw new Error('fetchVerificationMethodsFromSource not implemented');
  }

  async fetchServicesFromSource(did) {
    // Implement actual fetch
    throw new Error('fetchServicesFromSource not implemented');
  }

  async searchDIDsInSource(query, limit) {
    // Implement actual search
    throw new Error('searchDIDsInSource not implemented');
  }
}

module.exports = new DIDService();
