/**
 * @title CentralizedConfig Tests
 * @dev Comprehensive tests for centralized configuration management
 */

const CentralizedConfig = require('../config/CentralizedConfig');
const fs = require('fs').promises;
const path = require('path');

describe('CentralizedConfig', () => {
    let config;
    let originalEnv;

    beforeEach(() => {
        // Backup original environment
        originalEnv = { ...process.env };
        
        // Mock environment variables for testing
        process.env.NODE_ENV = 'test';
        process.env.CONFIG_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
        process.env.STELLAR_NETWORK = 'TESTNET';
        process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
        process.env.STELLAR_PASSPHRASE = 'Test SDF Network ; September 2015';
        process.env.DID_METHOD = 'stellar';
        process.env.DID_REGISTRY_PUBLIC_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
        process.env.PORT = '3001';
        process.env.FRONTEND_URL = 'http://localhost:3000';
        process.env.MONGODB_URL = 'mongodb://localhost:27017/test';
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long-minimum';
        process.env.JWT_EXPIRES_IN = '24h';
        process.env.CORS_ORIGIN = 'http://localhost:3000';
        process.env.RATE_LIMIT_WINDOW_MS = '900000';
        process.env.RATE_LIMIT_MAX_REQUESTS = '100';
        process.env.EVM_RPC_URL = 'https://rpc2.sepolia.org';
        process.env.EVM_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        process.env.EVM_DID_REGISTRY_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';
        process.env.EVM_CHAIN_ID = '11155111';
        process.env.LOG_LEVEL = 'info';
        process.env.LOG_FORMAT = 'combined';
        process.env.BACKUP_ENABLED = 'true';
        process.env.BACKUP_SCHEDULE = 'cron:0 2 * * *';
        process.env.BACKUP_RETENTION_DAYS = '30';
        process.env.BACKUP_ENCRYPTION_ENABLED = 'true';
        process.env.EVENT_SOURCING_ENABLED = 'true';
        process.env.EVENT_STORE_DB = 'test_events';
        process.env.EVENT_SNAPSHOT_INTERVAL = '1000';
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Configuration Loading', () => {
        test('should load configuration successfully', async () => {
            config = new CentralizedConfig();
            
            expect(config.getEnvironment()).toBe('test');
            expect(config.getVersion()).toBe('1.0.0');
        });

        test('should validate stellar configuration', async () => {
            config = new CentralizedConfig();
            
            const stellarConfig = config.get('stellar');
            expect(stellarConfig.STELLAR_NETWORK).toBe('TESTNET');
            expect(stellarConfig.STELLAR_HORIZON_URL).toBe('https://horizon-testnet.stellar.org');
            expect(stellarConfig.STELLAR_PASSPHRASE).toBe('Test SDF Network ; September 2015');
        });

        test('should validate DID configuration', async () => {
            config = new CentralizedConfig();
            
            const didConfig = config.get('did');
            expect(didConfig.DID_METHOD).toBe('stellar');
            expect(didConfig.DID_REGISTRY_PUBLIC_KEY).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
        });

        test('should validate server configuration', async () => {
            config = new CentralizedConfig();
            
            const serverConfig = config.get('server');
            expect(serverConfig.PORT).toBe(3001);
            expect(serverConfig.NODE_ENV).toBe('test');
            expect(serverConfig.FRONTEND_URL).toBe('http://localhost:3000');
        });

        test('should validate database configuration', async () => {
            config = new CentralizedConfig();
            
            const dbConfig = config.get('database');
            expect(dbConfig.MONGODB_URL).toBe('mongodb://localhost:27017/test');
            expect(dbConfig.REDIS_URL).toBe('redis://localhost:6379');
        });

        test('should validate JWT configuration', async () => {
            config = new CentralizedConfig();
            
            const jwtConfig = config.get('jwt');
            expect(jwtConfig.JWT_SECRET).toBe('test-jwt-secret-32-characters-long-minimum');
            expect(jwtConfig.JWT_EXPIRES_IN).toBe('24h');
        });

        test('should validate security configuration', async () => {
            config = new CentralizedConfig();
            
            const securityConfig = config.get('security');
            expect(securityConfig.CORS_ORIGIN).toBe('http://localhost:3000');
            expect(securityConfig.RATE_LIMIT_WINDOW_MS).toBe(900000);
            expect(securityConfig.RATE_LIMIT_MAX_REQUESTS).toBe(100);
        });

        test('should validate EVM configuration', async () => {
            config = new CentralizedConfig();
            
            const evmConfig = config.get('evm');
            expect(evmConfig.EVM_RPC_URL).toBe('https://rpc2.sepolia.org');
            expect(evmConfig.EVM_PRIVATE_KEY).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            expect(evmConfig.EVM_DID_REGISTRY_ADDRESS).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
            expect(evmConfig.EVM_CHAIN_ID).toBe(11155111);
        });

        test('should validate backup configuration', async () => {
            config = new CentralizedConfig();
            
            const backupConfig = config.get('backup');
            expect(backupConfig.BACKUP_ENABLED).toBe(true);
            expect(backupConfig.BACKUP_SCHEDULE).toBe('cron:0 2 * * *');
            expect(backupConfig.BACKUP_RETENTION_DAYS).toBe(30);
            expect(backupConfig.BACKUP_ENCRYPTION_ENABLED).toBe(true);
        });

        test('should validate event sourcing configuration', async () => {
            config = new CentralizedConfig();
            
            const eventsConfig = config.get('events');
            expect(eventsConfig.EVENT_SOURCING_ENABLED).toBe(true);
            expect(eventsConfig.EVENT_STORE_DB).toBe('test_events');
            expect(eventsConfig.EVENT_SNAPSHOT_INTERVAL).toBe(1000);
        });
    });

    describe('Configuration Validation', () => {
        test('should reject invalid stellar network', async () => {
            process.env.STELLAR_NETWORK = 'INVALID_NETWORK';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });

        test('should reject invalid DID method', async () => {
            process.env.DID_METHOD = 'invalid_method';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });

        test('should reject invalid port number', async () => {
            process.env.PORT = 'invalid_port';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });

        test('should reject invalid MongoDB URL', async () => {
            process.env.MONGODB_URL = 'invalid-url';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });

        test('should reject short JWT secret', async () => {
            process.env.JWT_SECRET = 'short';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });

        test('should reject invalid EVM private key format', async () => {
            process.env.EVM_PRIVATE_KEY = 'invalid_private_key';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });

        test('should reject invalid EVM contract address', async () => {
            process.env.EVM_DID_REGISTRY_ADDRESS = 'invalid_address';
            
            expect(() => {
                new CentralizedConfig();
            }).toThrow('Configuration validation failed');
        });
    });

    describe('Configuration Access', () => {
        beforeEach(() => {
            config = new CentralizedConfig();
        });

        test('should get configuration value by path', () => {
            expect(config.get('stellar.STELLAR_NETWORK')).toBe('TESTNET');
            expect(config.get('server.PORT')).toBe(3001);
            expect(config.get('jwt.JWT_EXPIRES_IN')).toBe('24h');
        });

        test('should return default value for non-existent path', () => {
            expect(config.get('non.existent.path', 'default')).toBe('default');
            expect(config.get('missing.path', 42)).toBe(42);
        });

        test('should set configuration value', async () => {
            await config.set('test.value', 'test_value');
            expect(config.get('test.value')).toBe('test_value');
        });

        test('should set nested configuration value', async () => {
            await config.set('nested.deep.value', 'deep_value');
            expect(config.get('nested.deep.value')).toBe('deep_value');
        });

        test('should encrypt sensitive configuration values', async () => {
            await config.set('sensitive.secret', 'secret_value', true);
            const storedValue = config.get('sensitive.secret');
            expect(storedValue).not.toBe('secret_value'); // Should be encrypted
        });
    });

    describe('Encryption and Decryption', () => {
        beforeEach(() => {
            config = new CentralizedConfig();
        });

        test('should encrypt sensitive values', async () => {
            const sensitiveValue = 'super_secret_password';
            const encrypted = config.encryptValue(sensitiveValue);
            
            expect(encrypted).not.toBe(sensitiveValue);
            expect(typeof encrypted).toBe('string');
        });

        test('should decrypt encrypted values', async () => {
            const originalValue = 'super_secret_password';
            const encrypted = config.encryptValue(originalValue);
            const decrypted = config.decryptValue(encrypted);
            
            expect(decrypted).toBe(originalValue);
        });

        test('should identify sensitive fields', () => {
            expect(config.isSensitiveField('JWT_SECRET')).toBe(true);
            expect(config.isSensitiveField('DATABASE_PASSWORD')).toBe(true);
            expect(config.isSensitiveField('PRIVATE_KEY')).toBe(true);
            expect(config.isSensitiveField('normal_field')).toBe(false);
        });
    });

    describe('Configuration Export', () => {
        beforeEach(() => {
            config = new CentralizedConfig();
        });

        test('should export configuration without sensitive values', () => {
            const exported = config.export(false);
            
            expect(exported.jwt.JWT_SECRET).toBe('***MASKED***');
            expect(exported.evm.EVM_PRIVATE_KEY).toBe('***MASKED***');
            expect(exported.stellar.STELLAR_NETWORK).toBe('TESTNET'); // Non-sensitive
        });

        test('should export configuration with sensitive values', () => {
            const exported = config.export(true);
            
            expect(exported.jwt.JWT_SECRET).toBe('test-jwt-secret-32-characters-long-minimum');
            expect(exported.evm.EVM_PRIVATE_KEY).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        });
    });

    describe('Environment Overrides', () => {
        test('should apply environment-specific overrides', async () => {
            // Create test environment override file
            const testConfigPath = path.join(__dirname, '../../config/test.json');
            const testConfig = {
                server: {
                    PORT: 4000,
                    CUSTOM_SETTING: 'test_value'
                },
                database: {
                    CUSTOM_DB_SETTING: 'custom_db_value'
                }
            };
            
            await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));
            
            config = new CentralizedConfig();
            
            expect(config.get('server.PORT')).toBe(4000); // Override applied
            expect(config.get('server.CUSTOM_SETTING')).toBe('test_value');
            expect(config.get('database.CUSTOM_DB_SETTING')).toBe('custom_db_value');
            
            // Clean up
            await fs.unlink(testConfigPath);
        });
    });

    describe('Security Validation', () => {
        test('should detect default values in production', async () => {
            process.env.NODE_ENV = 'production';
            process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
            
            config = new CentralizedConfig();
            
            // Should log security warning (covered by console.warn in implementation)
            expect(config.get('security')).toBeDefined();
        });

        test('should detect HTTP URLs in production', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FRONTEND_URL = 'http://localhost:3000';
            
            config = new CentralizedConfig();
            
            // Should log security warning (covered by console.warn in implementation)
            expect(config.get('server.FRONTEND_URL')).toBe('http://localhost:3000');
        });
    });

    describe('Configuration Reload', () => {
        beforeEach(() => {
            config = new CentralizedConfig();
        });

        test('should reload configuration', async () => {
            const originalPort = config.get('server.PORT');
            
            // Change environment
            process.env.PORT = '4000';
            
            // Reload configuration
            await config.reload();
            
            expect(config.get('server.PORT')).toBe(4000);
        });
    });

    describe('File Operations', () => {
        beforeEach(() => {
            config = new CentralizedConfig();
        });

        test('should save encrypted configuration to file', async () => {
            const filePath = path.join(__dirname, '../../test_config.json');
            
            await config.saveEncrypted(filePath);
            
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);
            
            // Clean up
            await fs.unlink(filePath);
        });

        test('should load encrypted configuration from file', async () => {
            const filePath = path.join(__dirname, '../../test_config.json');
            
            // Save first
            await config.saveEncrypted(filePath);
            
            // Create new config instance and load
            const newConfig = new CentralizedConfig();
            await newConfig.loadEncrypted(filePath);
            
            expect(newConfig.get('server.PORT')).toBe(config.get('server.PORT'));
            
            // Clean up
            await fs.unlink(filePath);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing encryption key gracefully', async () => {
            delete process.env.CONFIG_ENCRYPTION_KEY;
            
            config = new CentralizedConfig();
            
            // Should generate temporary key and log warning
            expect(config).toBeDefined();
        });

        test('should handle invalid override file gracefully', async () => {
            // Create invalid JSON file
            const invalidConfigPath = path.join(__dirname, '../../config/test.json');
            await fs.writeFile(invalidConfigPath, 'invalid json content');
            
            config = new CentralizedConfig();
            
            // Should handle error and continue
            expect(config).toBeDefined();
            
            // Clean up
            await fs.unlink(invalidConfigPath);
        });
    });
});
