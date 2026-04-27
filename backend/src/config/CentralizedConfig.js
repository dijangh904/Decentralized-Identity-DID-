/**
 * @title CentralizedConfig
 * @dev Centralized environment configuration management with validation and encryption
 * 
 * This module provides a centralized way to manage all environment configuration
 * with comprehensive validation, encryption support, and type safety. It addresses
 * the scattered configuration issue by providing a single source of truth for
 * all configuration values.
 * 
 * Features:
 * - Environment variable validation with schemas
 * - Encryption support for sensitive values
 * - Type conversion and validation
 * - Configuration versioning and migration
 * - Runtime configuration updates
 * - Environment-specific configurations
 * - Security scanning and validation
 * 
 * @author Fatima Sanusi
 * @notice Use this module for all configuration management
 */

const crypto = require('crypto');
const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');

class CentralizedConfig {
    constructor() {
        this.config = {};
        this.encryptedFields = new Set();
        this.validationSchemas = {};
        this.configVersion = '1.0.0';
        this.environment = process.env.NODE_ENV || 'development';
        this.encryptionKey = this.getEncryptionKey();
        
        this.initializeSchemas();
        this.loadConfiguration();
    }

    /**
     * Gets encryption key from environment or generates one
     * @returns {string} Encryption key
     */
    getEncryptionKey() {
        const key = process.env.CONFIG_ENCRYPTION_KEY;
        if (!key) {
            console.warn('CONFIG_ENCRYPTION_KEY not found, generating temporary key');
            return crypto.randomBytes(32).toString('hex');
        }
        return key;
    }

    /**
     * Initializes validation schemas for all configuration sections
     */
    initializeSchemas() {
        // Stellar Network Configuration Schema
        this.validationSchemas.stellar = Joi.object({
            STELLAR_NETWORK: Joi.string().valid('TESTNET', 'PUBLIC', 'LOCAL').required(),
            STELLAR_HORIZON_URL: Joi.string().uri().required(),
            STELLAR_PASSPHRASE: Joi.string().required(),
            STELLAR_FRIENDBOT_URL: Joi.string().uri().optional()
        });

        // DID Configuration Schema
        this.validationSchemas.did = Joi.object({
            DID_METHOD: Joi.string().valid('stellar', 'ethereum', 'key').required(),
            DID_REGISTRY_PUBLIC_KEY: Joi.string().hex().length(64).required()
        });

        // Server Configuration Schema
        this.validationSchemas.server = Joi.object({
            PORT: Joi.number().port().default(3001),
            NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
            FRONTEND_URL: Joi.string().uri().required()
        });

        // Database Configuration Schema
        this.validationSchemas.database = Joi.object({
            MONGODB_URL: Joi.string().uri().required(),
            REDIS_URL: Joi.string().uri().required(),
            DB_POOL_SIZE: Joi.number().positive().default(10),
            DB_TIMEOUT: Joi.number().positive().default(30000)
        });

        // JWT Configuration Schema
        this.validationSchemas.jwt = Joi.object({
            JWT_SECRET: Joi.string().min(32).required(),
            JWT_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('24h'),
            JWT_REFRESH_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('7d')
        });

        // Security Configuration Schema
        this.validationSchemas.security = Joi.object({
            CORS_ORIGIN: Joi.string().required(),
            RATE_LIMIT_WINDOW_MS: Joi.number().positive().default(900000),
            RATE_LIMIT_MAX_REQUESTS: Joi.number().positive().default(100),
            BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
            SESSION_SECRET: Joi.string().min(32).optional()
        });

        // EVM/Cross-Chain Configuration Schema
        this.validationSchemas.evm = Joi.object({
            EVM_RPC_URL: Joi.string().uri().required(),
            EVM_PRIVATE_KEY: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
            EVM_DID_REGISTRY_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
            EVM_CHAIN_ID: Joi.number().integer().positive().required()
        });

        // Logging Configuration Schema
        this.validationSchemas.logging = Joi.object({
            LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
            LOG_FORMAT: Joi.string().valid('json', 'combined', 'simple').default('combined'),
            LOG_FILE_PATH: Joi.string().optional(),
            LOG_MAX_SIZE: Joi.string().default('10m'),
            LOG_MAX_FILES: Joi.number().integer().positive().default(5)
        });

        // Backup Configuration Schema
        this.validationSchemas.backup = Joi.object({
            BACKUP_ENABLED: Joi.boolean().default(true),
            BACKUP_SCHEDULE: Joi.string().pattern(/^cron:.*$/).default('cron:0 2 * * *'),
            BACKUP_RETENTION_DAYS: Joi.number().integer().positive().default(30),
            BACKUP_ENCRYPTION_ENABLED: Joi.boolean().default(true),
            BACKUP_STORAGE_PATH: Joi.string().default('./backups'),
            BACKUP_COMPRESSION: Joi.boolean().default(true)
        });

        // Event Sourcing Configuration Schema
        this.validationSchemas.events = Joi.object({
            EVENT_SOURCING_ENABLED: Joi.boolean().default(true),
            EVENT_STORE_DB: Joi.string().default('events'),
            EVENT_SNAPSHOT_INTERVAL: Joi.number().integer().positive().default(1000),
            EVENT_RETENTION_DAYS: Joi.number().integer().positive().default(365),
            EVENT_COMPRESSION: Joi.boolean().default(true)
        });
    }

    /**
     * Loads and validates all configuration
     */
    async loadConfiguration() {
        try {
            // Load environment variables
            await this.loadEnvironmentVariables();
            
            // Validate each configuration section
            await this.validateAllSections();
            
            // Apply environment-specific overrides
            await this.applyEnvironmentOverrides();
            
            // Decrypt sensitive values
            await this.decryptSensitiveValues();
            
            // Perform security validation
            await this.performSecurityValidation();
            
            console.log(`Configuration loaded successfully for ${this.environment} environment`);
        } catch (error) {
            console.error('Failed to load configuration:', error.message);
            throw error;
        }
    }

    /**
     * Loads environment variables from .env file and process.env
     */
    async loadEnvironmentVariables() {
        require('dotenv').config();
        
        // Store all environment variables
        for (const [key, value] of Object.entries(process.env)) {
            this.config[key] = value;
        }
    }

    /**
     * Validates all configuration sections
     */
    async validateAllSections() {
        const sections = Object.keys(this.validationSchemas);
        const errors = [];

        for (const section of sections) {
            try {
                const sectionConfig = this.extractSectionConfig(section);
                const { error, value } = this.validationSchemas[section].validate(sectionConfig, {
                    abortEarly: false,
                    stripUnknown: true
                });

                if (error) {
                    errors.push(`Section '${section}': ${error.details.map(d => d.message).join(', ')}`);
                } else {
                    // Store validated config
                    this.config[section] = value;
                }
            } catch (err) {
                errors.push(`Section '${section}': ${err.message}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    /**
     * Extracts configuration for a specific section
     * @param {string} section Configuration section name
     * @returns {object} Section configuration
     */
    extractSectionConfig(section) {
        const sectionConfig = {};
        const prefix = section.toUpperCase() + '_';
        
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(prefix)) {
                sectionConfig[key] = value;
            }
        }
        
        return sectionConfig;
    }

    /**
     * Applies environment-specific configuration overrides
     */
    async applyEnvironmentOverrides() {
        const overrideFile = path.join(__dirname, `../../config/${this.environment}.json`);
        
        try {
            const overrideData = await fs.readFile(overrideFile, 'utf8');
            const overrides = JSON.parse(overrideData);
            
            // Apply overrides
            this.mergeConfig(this.config, overrides);
            
            console.log(`Applied environment overrides from ${overrideFile}`);
        } catch (error) {
            // Override file not found is acceptable
            if (error.code !== 'ENOENT') {
                console.warn(`Failed to apply environment overrides: ${error.message}`);
            }
        }
    }

    /**
     * Merges configuration objects
     * @param {object} target Target configuration
     * @param {object} source Source configuration
     */
    mergeConfig(target, source) {
        for (const [key, value] of Object.entries(source)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.mergeConfig(target[key], value);
            } else {
                target[key] = value;
            }
        }
    }

    /**
     * Decrypts sensitive configuration values
     */
    async decryptSensitiveValues() {
        const sensitiveFields = [
            'JWT_SECRET',
            'EVM_PRIVATE_KEY',
            'SESSION_SECRET',
            'CONFIG_ENCRYPTION_KEY',
            'DATABASE_PASSWORD',
            'REDIS_PASSWORD'
        ];

        for (const field of sensitiveFields) {
            if (this.config[field]) {
                try {
                    // Check if value is encrypted (base64 encoded)
                    const isEncrypted = this.isEncrypted(this.config[field]);
                    
                    if (isEncrypted) {
                        this.config[field] = this.decryptValue(this.config[field]);
                        this.encryptedFields.add(field);
                    }
                } catch (error) {
                    console.warn(`Failed to decrypt ${field}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Checks if a value is encrypted
     * @param {string} value Value to check
     * @returns {boolean} True if encrypted
     */
    isEncrypted(value) {
        try {
            const decoded = Buffer.from(value, 'base64').toString();
            return decoded.includes(':'); // Encrypted values have format "iv:encrypted"
        } catch {
            return false;
        }
    }

    /**
     * Decrypts a value using AES-256-GCM
     * @param {string} encryptedValue Encrypted value
     * @returns {string} Decrypted value
     */
    decryptValue(encryptedValue) {
        try {
            const decoded = Buffer.from(encryptedValue, 'base64').toString();
            const [iv, encrypted] = decoded.split(':');
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', 
                Buffer.from(this.encryptionKey, 'hex'), 
                Buffer.from(iv, 'hex')
            );
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypts a value using AES-256-GCM
     * @param {string} value Value to encrypt
     * @returns {string} Encrypted value
     */
    encryptValue(value) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', 
            Buffer.from(this.encryptionKey, 'hex'), 
            iv
        );
        
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        return Buffer.from(`${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`).toString('base64');
    }

    /**
     * Performs security validation on configuration
     */
    async performSecurityValidation() {
        const securityIssues = [];

        // Check for weak secrets
        if (this.config.jwt && this.config.jwt.JWT_SECRET && this.config.jwt.JWT_SECRET.length < 32) {
            securityIssues.push('JWT_SECRET should be at least 32 characters long');
        }

        // Check for default values in production
        if (this.environment === 'production') {
            if (this.config.jwt && this.config.jwt.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
                securityIssues.push('Default JWT_SECRET detected in production');
            }
            
            if (this.config.server && this.config.server.PORT === 3001) {
                securityIssues.push('Default development port detected in production');
            }
        }

        // Check for HTTP URLs in production
        if (this.environment === 'production') {
            const urlsToCheck = [
                this.config.server?.FRONTEND_URL,
                this.config.stellar?.STELLAR_HORIZON_URL,
                this.config.evm?.EVM_RPC_URL
            ];

            for (const url of urlsToCheck) {
                if (url && url.startsWith('http://')) {
                    securityIssues.push(`HTTP URL detected in production: ${url}`);
                }
            }
        }

        if (securityIssues.length > 0) {
            console.warn('Security issues detected:\n' + securityIssues.join('\n'));
        }
    }

    /**
     * Gets configuration value with path support
     * @param {string} path Configuration path (e.g., 'server.PORT')
     * @param {*} defaultValue Default value if not found
     * @returns {*} Configuration value
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    /**
     * Sets configuration value with path support
     * @param {string} path Configuration path
     * @param {*} value Value to set
     * @param {boolean} encrypt Whether to encrypt the value
     */
    async set(path, value, encrypt = false) {
        const keys = path.split('.');
        let current = this.config;
        
        // Navigate to parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        const finalKey = keys[keys.length - 1];
        
        // Encrypt if requested and field is sensitive
        if (encrypt && this.isSensitiveField(path)) {
            value = this.encryptValue(value);
            this.encryptedFields.add(path);
        }
        
        current[finalKey] = value;
    }

    /**
     * Checks if a configuration field is sensitive
     * @param {string} path Configuration path
     * @returns {boolean} True if sensitive
     */
    isSensitiveField(path) {
        const sensitivePatterns = [
            /secret/i,
            /password/i,
            /private.*key/i,
            /token/i,
            /auth/i
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(path));
    }

    /**
     * Validates configuration section
     * @param {string} section Section name
     * @param {object} config Configuration to validate
     * @returns {object} Validation result
     */
    validateSection(section, config) {
        if (!this.validationSchemas[section]) {
            return { error: `No validation schema found for section: ${section}` };
        }
        
        return this.validationSchemas[section].validate(config, {
            abortEarly: false,
            stripUnknown: true
        });
    }

    /**
     * Exports configuration (excluding sensitive values)
     * @param {boolean} includeSensitive Whether to include sensitive values
     * @returns {object} Exported configuration
     */
    export(includeSensitive = false) {
        const exported = JSON.parse(JSON.stringify(this.config));
        
        if (!includeSensitive) {
            this.maskSensitiveValues(exported);
        }
        
        return exported;
    }

    /**
     * Masks sensitive values in configuration
     * @param {object} config Configuration to mask
     */
    maskSensitiveValues(config) {
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === 'object' && value !== null) {
                this.maskSensitiveValues(value);
            } else if (this.isSensitiveField(key)) {
                config[key] = '***MASKED***';
            }
        }
    }

    /**
     * Gets configuration version
     * @returns {string} Configuration version
     */
    getVersion() {
        return this.configVersion;
    }

    /**
     * Gets current environment
     * @returns {string} Current environment
     */
    getEnvironment() {
        return this.environment;
    }

    /**
     * Reloads configuration
     */
    async reload() {
        console.log('Reloading configuration...');
        await this.loadConfiguration();
    }

    /**
     * Saves encrypted configuration to file
     * @param {string} filePath File path to save to
     */
    async saveEncrypted(filePath) {
        const encrypted = {};
        
        for (const [key, value] of Object.entries(this.config)) {
            if (this.encryptedFields.has(key)) {
                encrypted[key] = this.encryptValue(JSON.stringify(value));
            } else {
                encrypted[key] = value;
            }
        }
        
        await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2));
    }

    /**
     * Loads encrypted configuration from file
     * @param {string} filePath File path to load from
     */
    async loadEncrypted(filePath) {
        const encrypted = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        for (const [key, value] of Object.entries(encrypted)) {
            if (typeof value === 'string' && this.isEncrypted(value)) {
                this.config[key] = JSON.parse(this.decryptValue(value));
                this.encryptedFields.add(key);
            } else {
                this.config[key] = value;
            }
        }
    }
}

// Export singleton instance
const config = new CentralizedConfig();

module.exports = config;
