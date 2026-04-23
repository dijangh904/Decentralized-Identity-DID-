const { logger } = require('../middleware');
const redis = require('../utils/redis');
const crypto = require('crypto');

class CredentialService {
  constructor() {
    this.cachePrefix = 'credential:';
    this.subscriptionChannels = {
      CREDENTIAL_ISSUED: 'credential_issued',
      CREDENTIAL_REVOKED: 'credential_revoked'
    };
  }

  async getCredential(id) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}${id}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from database/blockchain
      const credential = await this.fetchCredentialFromSource(id);
      
      if (credential) {
        // Cache for 5 minutes
        await redis.setex(cacheKey, 300, JSON.stringify(credential));
        return credential;
      }

      throw new Error('Credential not found');
    } catch (error) {
      logger.error('Error fetching credential:', error);
      throw error;
    }
  }

  async getCredentials(filters = {}, options = {}) {
    try {
      const { issuer, subject, credentialType, revoked, expired } = filters;
      const { limit = 10, offset = 0, sortBy = 'issued', sortOrder = 'desc' } = options;

      // Build query based on filters
      const query = {};
      if (issuer) query.issuer = issuer;
      if (subject) query.subject = subject;
      if (credentialType) query.credentialType = credentialType;
      if (revoked !== undefined) query.revoked = revoked;
      
      if (expired !== undefined) {
        if (expired) {
          query.expires = { $lt: new Date() };
        } else {
          query.$or = [
            { expires: null },
            { expires: { $gt: new Date() } }
          ];
        }
      }

      // Fetch from database with pagination and sorting
      const credentials = await this.fetchCredentialsFromSource(query, { limit, offset, sortBy, sortOrder });

      return credentials;
    } catch (error) {
      logger.error('Error fetching credentials:', error);
      throw error;
    }
  }

  async getCredentialCount(filters = {}) {
    try {
      const { issuer, subject, credentialType, revoked, expired } = filters;
      const query = {};
      if (issuer) query.issuer = issuer;
      if (subject) query.subject = subject;
      if (credentialType) query.credentialType = credentialType;
      if (revoked !== undefined) query.revoked = revoked;
      
      if (expired !== undefined) {
        if (expired) {
          query.expires = { $lt: new Date() };
        } else {
          query.$or = [
            { expires: null },
            { expires: { $gt: new Date() } }
          ];
        }
      }

      return await this.countCredentialsFromSource(query);
    } catch (error) {
      logger.error('Error fetching credential count:', error);
      throw error;
    }
  }

  async issueCredential(credentialData) {
    try {
      const {
        issuer,
        subject,
        credentialType,
        claims,
        expires,
        credentialSchema,
        proof
      } = credentialData;

      // Validate input
      if (!issuer || !subject || !credentialType || !claims) {
        throw new Error('Missing required fields');
      }

      // Generate credential ID
      const id = this.generateCredentialId(issuer, subject, credentialType);

      // Check if credential already exists
      const existing = await this.getCredential(id).catch(() => null);
      if (existing) {
        throw new Error('Credential already exists');
      }

      // Create credential
      const credential = {
        id,
        issuer,
        subject,
        credentialType,
        claims,
        issued: new Date(),
        expires: expires ? new Date(expires) : null,
        dataHash: this.calculateDataHash(claims),
        revoked: false,
        credentialSchema,
        proof
      };

      // Save to database/blockchain
      const created = await this.saveCredentialToSource(credential);

      // Cache the new credential
      const cacheKey = `${this.cachePrefix}${id}`;
      await redis.setex(cacheKey, 300, JSON.stringify(created));

      // Publish to subscription channel
      await this.publishCredentialEvent(this.subscriptionChannels.CREDENTIAL_ISSUED, created);

      logger.info('Credential issued successfully:', { id, issuer, subject });
      return created;
    } catch (error) {
      logger.error('Error issuing credential:', error);
      throw error;
    }
  }

  async revokeCredential(id) {
    try {
      const existing = await this.getCredential(id);
      if (!existing) {
        throw new Error('Credential not found');
      }

      if (existing.revoked) {
        throw new Error('Credential already revoked');
      }

      const revoked = {
        ...existing,
        revoked: true,
        revokedAt: new Date()
      };

      // Save to database/blockchain
      await this.saveCredentialToSource(revoked);

      // Update cache
      const cacheKey = `${this.cachePrefix}${id}`;
      await redis.setex(cacheKey, 300, JSON.stringify(revoked));

      // Publish to subscription channel
      await this.publishCredentialEvent(this.subscriptionChannels.CREDENTIAL_REVOKED, revoked);

      logger.info('Credential revoked successfully:', { id });
      return revoked;
    } catch (error) {
      logger.error('Error revoking credential:', error);
      throw error;
    }
  }

  async batchRevokeCredentials(ids) {
    try {
      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const id of ids) {
        try {
          await this.revokeCredential(id);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to revoke credential ${id}: ${error.message}`);
        }
      }

      logger.info('Batch revoke completed:', results);
      return results;
    } catch (error) {
      logger.error('Error batch revoking credentials:', error);
      throw error;
    }
  }

  async searchCredentials(query, limit = 10) {
    try {
      // Implement search logic (could use text search, full-text search, etc.)
      const results = await this.searchCredentialsInSource(query, limit);
      return results;
    } catch (error) {
      logger.error('Error searching credentials:', error);
      throw error;
    }
  }

  async verifyCredential(credential) {
    try {
      // Check if credential exists and is not revoked
      const stored = await this.getCredential(credential.id);
      if (!stored) {
        return { valid: false, reason: 'Credential not found' };
      }

      if (stored.revoked) {
        return { valid: false, reason: 'Credential has been revoked' };
      }

      // Check expiration
      if (stored.expires && new Date(stored.expires) < new Date()) {
        return { valid: false, reason: 'Credential has expired' };
      }

      // Verify data hash
      const calculatedHash = this.calculateDataHash(credential.claims);
      if (calculatedHash !== stored.dataHash) {
        return { valid: false, reason: 'Credential data has been tampered with' };
      }

      // Verify proof if present
      if (credential.proof) {
        const proofValid = await this.verifyProof(credential);
        if (!proofValid) {
          return { valid: false, reason: 'Invalid proof' };
        }
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error verifying credential:', error);
      return { valid: false, reason: 'Verification error' };
    }
  }

  // Subscription methods
  subscribeToCredentialIssued(issuer, subject) {
    return {
      async *[Symbol.asyncIterator]() {
        const channel = issuer && subject
          ? `${this.subscriptionChannels.CREDENTIAL_ISSUED}:${issuer}:${subject}`
          : issuer
          ? `${this.subscriptionChannels.CREDENTIAL_ISSUED}:${issuer}`
          : this.subscriptionChannels.CREDENTIAL_ISSUED;
        
        logger.info(`Subscribed to credential issued events for issuer: ${issuer || 'all'}, subject: ${subject || 'all'}`);
      }
    };
  }

  subscribeToCredentialRevoked(issuer, subject) {
    return {
      async *[Symbol.asyncIterator]() {
        const channel = issuer && subject
          ? `${this.subscriptionChannels.CREDENTIAL_REVOKED}:${issuer}:${subject}`
          : issuer
          ? `${this.subscriptionChannels.CREDENTIAL_REVOKED}:${issuer}`
          : this.subscriptionChannels.CREDENTIAL_REVOKED;
        
        logger.info(`Subscribed to credential revoked events for issuer: ${issuer || 'all'}, subject: ${subject || 'all'}`);
      }
    };
  }

  // Helper methods
  generateCredentialId(issuer, subject, credentialType) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256')
      .update(`${issuer}:${subject}:${credentialType}:${timestamp}:${randomBytes}`)
      .digest('hex');
    
    return `urn:uuid:${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  calculateDataHash(claims) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(claims))
      .digest('hex');
  }

  async verifyProof(credential) {
    try {
      // Implement proof verification logic
      // This would depend on the proof type (JWT, LD-Proof, etc.)
      if (!credential.proof) {
        return false;
      }

      // Example for JWT proof
      if (credential.proof.type === 'JwtProof2020') {
        // Verify JWT signature
        // This is a simplified implementation
        return true; // Replace with actual JWT verification
      }

      // Add other proof types as needed
      return true;
    } catch (error) {
      logger.error('Error verifying proof:', error);
      return false;
    }
  }

  async publishCredentialEvent(event, data) {
    try {
      // Publish to Redis pub/sub
      await redis.publish(event, JSON.stringify(data));
    } catch (error) {
      logger.error('Error publishing credential event:', error);
    }
  }

  // Database/blockchain integration methods (to be implemented based on your storage)
  async fetchCredentialFromSource(id) {
    // Implement actual fetch from your database or blockchain
    throw new Error('fetchCredentialFromSource not implemented');
  }

  async fetchCredentialsFromSource(query, options) {
    // Implement actual fetch with pagination and sorting
    throw new Error('fetchCredentialsFromSource not implemented');
  }

  async countCredentialsFromSource(query) {
    // Implement actual count
    throw new Error('countCredentialsFromSource not implemented');
  }

  async saveCredentialToSource(credential) {
    // Implement actual save
    throw new Error('saveCredentialToSource not implemented');
  }

  async searchCredentialsInSource(query, limit) {
    // Implement actual search
    throw new Error('searchCredentialsInSource not implemented');
  }
}

module.exports = new CredentialService();
