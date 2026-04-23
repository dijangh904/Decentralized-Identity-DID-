/**
 * Secure Storage Utility
 * 
 * Manages sensitive and non-sensitive data storage with appropriate security measures:
 * - sessionStorage: For sensitive data (auth tokens, wallet data) - cleared on tab close
 * - localStorage: For non-sensitive preferences/settings only
 * - Memory: For highly sensitive data (private keys should ideally not be persisted)
 * 
 * Security Best Practices:
 * 1. Private keys are kept in sessionStorage only, cleared on disconnect
 * 2. Auth tokens use sessionStorage with automatic cleanup
 * 3. No sensitive data persists beyond browser session
 * 4. XSS protection through storage isolation
 */

class SecureStorage {
  constructor() {
    this.sessionNamespace = 'stellar_secure_';
    this.localNamespace = 'stellar_';
    this.memoryStore = {};
  }

  /**
   * Store sensitive session data (auth tokens, wallet info without secrets)
   * Automatically cleared when browser tab closes
   */
  setSessionData(key, value) {
    try {
      if (!value) {
        sessionStorage.removeItem(`${this.sessionNamespace}${key}`);
        return;
      }
      sessionStorage.setItem(
        `${this.sessionNamespace}${key}`,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error(`Failed to set session data for key ${key}:`, error);
      // Fallback to memory storage if sessionStorage fails
      this.memoryStore[key] = value;
    }
  }

  /**
   * Retrieve sensitive session data
   */
  getSessionData(key) {
    try {
      const data = sessionStorage.getItem(`${this.sessionNamespace}${key}`);
      if (data) {
        return JSON.parse(data);
      }
      // Check memory fallback
      return this.memoryStore[key] || null;
    } catch (error) {
      console.error(`Failed to get session data for key ${key}:`, error);
      return this.memoryStore[key] || null;
    }
  }

  /**
   * Remove sensitive session data
   */
  removeSessionData(key) {
    try {
      sessionStorage.removeItem(`${this.sessionNamespace}${key}`);
      delete this.memoryStore[key];
    } catch (error) {
      console.error(`Failed to remove session data for key ${key}:`, error);
    }
  }

  /**
   * Clear all sensitive session data
   */
  clearAllSessionData() {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.sessionNamespace)) {
          sessionStorage.removeItem(key);
        }
      });
      this.memoryStore = {};
    } catch (error) {
      console.error('Failed to clear session data:', error);
    }
  }

  /**
   * Store non-sensitive local data (preferences, settings)
   */
  setLocalData(key, value) {
    try {
      if (!value) {
        localStorage.removeItem(`${this.localNamespace}${key}`);
        return;
      }
      localStorage.setItem(
        `${this.localNamespace}${key}`,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error(`Failed to set local data for key ${key}:`, error);
    }
  }

  /**
   * Retrieve non-sensitive local data
   */
  getLocalData(key) {
    try {
      const data = localStorage.getItem(`${this.localNamespace}${key}`);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error(`Failed to get local data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove non-sensitive local data
   */
  removeLocalData(key) {
    try {
      localStorage.removeItem(`${this.localNamespace}${key}`);
    } catch (error) {
      console.error(`Failed to remove local data for key ${key}:`, error);
    }
  }

  /**
   * Store very sensitive data in memory only (no persistence)
   * Should be used for private keys and highly sensitive info
   */
  setMemoryData(key, value) {
    this.memoryStore[key] = value;
  }

  /**
   * Retrieve data from memory
   */
  getMemoryData(key) {
    return this.memoryStore[key] || null;
  }

  /**
   * Remove data from memory
   */
  removeMemoryData(key) {
    delete this.memoryStore[key];
  }

  /**
   * Clear all memory storage
   */
  clearAllMemoryData() {
    this.memoryStore = {};
  }

  /**
   * Get auth token from secure session storage
   */
  getAuthToken() {
    return this.getSessionData('authToken');
  }

  /**
   * Set auth token in secure session storage
   */
  setAuthToken(token) {
    this.setSessionData('authToken', token);
  }

  /**
   * Remove auth token
   */
  removeAuthToken() {
    this.removeSessionData('authToken');
  }

  /**
   * Get wallet data from secure session storage (without secrets)
   */
  getWalletData() {
    return this.getSessionData('walletData');
  }

  /**
   * Set wallet data (should not include secretKey)
   */
  setWalletData(walletData) {
    // Remove any secret key before storing
    const { secretKey, privateKey, ...safeData } = walletData;
    this.setSessionData('walletData', safeData);
  }

  /**
   * Get private key from memory only (not persisted)
   */
  getPrivateKey() {
    return this.getMemoryData('privateKey');
  }

  /**
   * Set private key in memory only (cleared on session end)
   */
  setPrivateKey(key) {
    this.setMemoryData('privateKey', key);
  }

  /**
   * Remove private key from memory
   */
  removePrivateKey() {
    this.removeMemoryData('privateKey');
  }

  /**
   * Clear all sensitive data on logout
   */
  clearSensitiveData() {
    this.clearAllSessionData();
    this.clearAllMemoryData();
  }

  /**
   * Check if browser supports sessionStorage
   */
  isSessionStorageAvailable() {
    try {
      const test = '__sessionStorageTest__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if browser supports localStorage
   */
  isLocalStorageAvailable() {
    try {
      const test = '__localStorageTest__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
const secureStorage = new SecureStorage();
export default secureStorage;
