const ApiKey = require('../models/ApiKey');
const { logger } = require('../middleware');

class ApiKeyService {
  /**
   * Generate a new API key
   */
  async generateApiKey(name, owner, permissions = ['read'], expiresInDays = 30) {
    try {
      const key = ApiKey.generateKey();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const apiKey = new ApiKey({
        key,
        name,
        owner,
        permissions,
        expiresAt
      });

      await apiKey.save();
      return apiKey;
    } catch (error) {
      logger.error(`Error generating API key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rotate an existing API key
   */
  async rotateApiKey(id) {
    try {
      const oldKey = await ApiKey.findById(id);
      if (!oldKey) throw new Error('API key not found');

      const newKeyValue = ApiKey.generateKey();
      oldKey.key = newKeyValue;
      oldKey.createdAt = new Date();
      
      // Optionally update expiration
      if (oldKey.expiresAt) {
        const expiresInDays = 30; // Default or keep existing duration
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + expiresInDays);
        oldKey.expiresAt = newExpiresAt;
      }

      await oldKey.save();
      return oldKey;
    } catch (error) {
      logger.error(`Error rotating API key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id) {
    try {
      const apiKey = await ApiKey.findById(id);
      if (!apiKey) throw new Error('API key not found');

      apiKey.status = 'revoked';
      await apiKey.save();
      return apiKey;
    } catch (error) {
      logger.error(`Error revoking API key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(key) {
    try {
      const apiKey = await ApiKey.findOne({ key, status: 'active' });
      
      if (!apiKey) return false;

      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        apiKey.status = 'expired';
        await apiKey.save();
        return false;
      }

      // Update last used
      apiKey.lastUsedAt = new Date();
      await apiKey.save();

      return apiKey;
    } catch (error) {
      logger.error(`Error validating API key: ${error.message}`);
      return false;
    }
  }

  /**
   * List API keys for an owner
   */
  async listApiKeys(owner) {
    try {
      return await ApiKey.find({ owner });
    } catch (error) {
      logger.error(`Error listing API keys: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ApiKeyService();
