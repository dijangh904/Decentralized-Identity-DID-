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

  // Database/blockchain integration methods (mock implementation for demo)
  async fetchCredentialFromSource(id) {
    // Mock implementation - in production, this would fetch from database or blockchain
    const mockCredentials = this.getMockCredentials();
    return mockCredentials.find(cred => cred.id === id);
  }

  async fetchCredentialsFromSource(query, options = {}) {
    // Mock implementation - in production, this would fetch from database with pagination
    const { limit = 10, offset = 0, sortBy = 'issued', sortOrder = 'desc' } = options;
    let credentials = this.getMockCredentials();

    // Apply filters
    if (query.issuer) {
      credentials = credentials.filter(cred => cred.issuer.includes(query.issuer));
    }
    if (query.subject) {
      credentials = credentials.filter(cred => cred.subject.includes(query.subject));
    }
    if (query.credentialType) {
      credentials = credentials.filter(cred => cred.credentialType === query.credentialType);
    }
    if (query.revoked !== undefined) {
      credentials = credentials.filter(cred => cred.revoked === query.revoked);
    }
    if (query.expired !== undefined) {
      const now = new Date();
      if (query.expired) {
        credentials = credentials.filter(cred => cred.expires && new Date(cred.expires) < now);
      } else {
        credentials = credentials.filter(cred => !cred.expires || new Date(cred.expires) >= now);
      }
    }

    // Apply sorting
    credentials.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'issued' || sortBy === 'expires') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });

    // Apply pagination
    return credentials.slice(offset, offset + limit);
  }

  async countCredentialsFromSource(query) {
    // Mock implementation - in production, this would count in database
    let credentials = this.getMockCredentials();

    // Apply same filters as fetchCredentialsFromSource
    if (query.issuer) {
      credentials = credentials.filter(cred => cred.issuer.includes(query.issuer));
    }
    if (query.subject) {
      credentials = credentials.filter(cred => cred.subject.includes(query.subject));
    }
    if (query.credentialType) {
      credentials = credentials.filter(cred => cred.credentialType === query.credentialType);
    }
    if (query.revoked !== undefined) {
      credentials = credentials.filter(cred => cred.revoked === query.revoked);
    }
    if (query.expired !== undefined) {
      const now = new Date();
      if (query.expired) {
        credentials = credentials.filter(cred => cred.expires && new Date(cred.expires) < now);
      } else {
        credentials = credentials.filter(cred => !cred.expires || new Date(cred.expires) >= now);
      }
    }

    return credentials.length;
  }

  async saveCredentialToSource(credential) {
    // Mock implementation - in production, this would save to database or blockchain
    const mockCredentials = this.getMockCredentials();
    
    // Check if credential already exists
    const existingIndex = mockCredentials.findIndex(cred => cred.id === credential.id);
    if (existingIndex >= 0) {
      mockCredentials[existingIndex] = credential;
    } else {
      mockCredentials.push(credential);
    }
    
    return credential;
  }

  async searchCredentialsInSource(query, limit = 10) {
    // Mock implementation - in production, this would perform full-text search
    const credentials = this.getMockCredentials();
    const searchQuery = query.toLowerCase();
    
    const results = credentials.filter(cred => {
      return cred.id.toLowerCase().includes(searchQuery) ||
             cred.issuer.toLowerCase().includes(searchQuery) ||
             cred.subject.toLowerCase().includes(searchQuery) ||
             cred.credentialType.toLowerCase().includes(searchQuery) ||
             JSON.stringify(cred.claims).toLowerCase().includes(searchQuery);
    });
    
    return results.slice(0, limit);
  }

  // Helper method to generate mock data for testing
  getMockCredentials() {
    const generateCredential = (id, type, issuer, subject, issued, revoked = false) => ({
      id,
      issuer,
      subject,
      credentialType: type,
      claims: this.generateMockClaims(type),
      issued,
      expires: type === 'age-verification' ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      dataHash: this.calculateDataHash({}),
      revoked,
      revokedAt: revoked ? new Date().toISOString() : null,
      credentialSchema: `https://example.com/schemas/${type}.json`,
      proof: {
        type: 'Ed25519Signature2018',
        creator: `${issuer}#key-1`,
        created: issued,
        proofValue: 'mock-signature'
      }
    });

    // Generate 75 mock credentials for testing performance
    const credentials = [];
    const types = ['university-degree', 'professional-license', 'age-verification', 'employment-verification'];
    const issuers = [
      'did:stellar:GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ',
      'did:stellar:GDEF789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD123',
      'did:stellar:GHI234JKL567MNO890PQR123STU456VWX789YZA012BCD345EFG678'
    ];
    const subjects = [
      'did:stellar:GJKL012MNO345PQR678STU901VWX234YZA567BCD890EFG123HI456',
      'did:stellar:GMNO678PQR901STU234VWX567YZA890BCD123EFG456HI789JKL012',
      'did:stellar:GPQR234STU567VWX890YZA123BCD456EFG789HI012JKL345MNO678'
    ];

    for (let i = 0; i < 75; i++) {
      const type = types[i % types.length];
      const issuer = issuers[i % issuers.length];
      const subject = subjects[i % subjects.length];
      const issued = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString();
      const revoked = i % 20 === 0; // Every 20th credential is revoked
      
      credentials.push(generateCredential(
        `urn:uuid:${i.toString(16).padStart(32, '0')}-${i.toString(16).padStart(8, '0')}-${i.toString(16).padStart(4, '0')}-${i.toString(16).padStart(4, '0')}-${i.toString(16).padStart(12, '0')}`,
        type,
        issuer,
        subject,
        issued,
        revoked
      ));
    }

    return credentials;
  }

  generateMockClaims(type) {
    switch (type) {
      case 'university-degree':
        return {
          degree: ['Bachelor of Science', 'Master of Arts', 'Doctor of Philosophy'][Math.floor(Math.random() * 3)],
          university: ['MIT', 'Stanford', 'Harvard', 'Oxford', 'Cambridge'][Math.floor(Math.random() * 5)],
          field: ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology'][Math.floor(Math.random() * 5)],
          gpa: (3.0 + Math.random() * 2.0).toFixed(2),
          graduationYear: 2018 + Math.floor(Math.random() * 6)
        };
      case 'professional-license':
        return {
          licenseType: ['Medical Doctor', 'Lawyer', 'Engineer', 'Architect', 'Accountant'][Math.floor(Math.random() * 5)],
          licenseNumber: `${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          issuingBoard: ['State Medical Board', 'Bar Association', 'Engineering Board'][Math.floor(Math.random() * 3)],
          expirationDate: new Date(Date.now() + (365 + Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'Active'
        };
      case 'age-verification':
        return {
          ageVerified: true,
          minimumAge: 18,
          verificationMethod: 'Government ID',
          verifiedAt: new Date().toISOString()
        };
      case 'employment-verification':
        return {
          employer: ['Tech Corp', 'Finance Inc', 'Healthcare LLC', 'Education Group'][Math.floor(Math.random() * 4)],
          position: ['Software Engineer', 'Manager', 'Analyst', 'Specialist'][Math.floor(Math.random() * 4)],
          employmentStatus: 'Active',
          startDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          department: ['Engineering', 'Sales', 'Marketing', 'HR'][Math.floor(Math.random() * 4)]
        };
      default:
        return {};
    }
  }
}

module.exports = new CredentialService();
