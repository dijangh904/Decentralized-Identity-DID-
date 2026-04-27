/**
 * @title DatabaseBackup
 * @dev Automated database backup system with point-in-time recovery
 * 
 * This module provides comprehensive database backup functionality with automated
 * scheduling, point-in-time recovery, compression, encryption, and retention
 * management. It supports both MongoDB and Redis databases.
 * 
 * Features:
 * - Automated scheduled backups
 * - Point-in-time recovery
 * - Backup compression and encryption
 * - Retention policy management
 * - Incremental and full backups
 * - Backup verification and integrity checks
 * - Cross-environment backup support
 * - Disaster recovery procedures
 * 
 * @author Fatima Sanusi
 * @notice Use this module for automated database backup operations
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
const Redis = require('redis');
const cron = require('node-cron');
const config = require('../config/CentralizedConfig');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class DatabaseBackup {
    constructor() {
        this.backupConfig = config.get('backup', {});
        this.mongoClient = null;
        this.redisClient = null;
        this.backupJobs = new Map();
        this.isInitialized = false;
        
        // Backup storage configuration
        this.backupPath = this.backupConfig.BACKUP_STORAGE_PATH || './backups';
        this.encryptionEnabled = this.backupConfig.BACKUP_ENCRYPTION_ENABLED !== false;
        this.compressionEnabled = this.backupConfig.BACKUP_COMPRESSION !== false;
        this.retentionDays = this.backupConfig.BACKUP_RETENTION_DAYS || 30;
        
        // Encryption key
        this.encryptionKey = this.getEncryptionKey();
        
        this.initialize();
    }

    /**
     * Gets encryption key for backup encryption
     * @returns {string} Encryption key
     */
    getEncryptionKey() {
        const key = process.env.BACKUP_ENCRYPTION_KEY || config.get('security.CONFIG_ENCRYPTION_KEY');
        if (!key) {
            throw new Error('Backup encryption key not found. Set BACKUP_ENCRYPTION_KEY environment variable.');
        }
        return key;
    }

    /**
     * Initializes the backup system
     */
    async initialize() {
        try {
            // Create backup directory
            await this.ensureBackupDirectory();
            
            // Initialize database connections
            await this.initializeDatabaseConnections();
            
            // Schedule automated backups
            await this.scheduleAutomatedBackups();
            
            // Clean up old backups
            await this.cleanupOldBackups();
            
            this.isInitialized = true;
            console.log('Database backup system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize backup system:', error.message);
            throw error;
        }
    }

    /**
     * Ensures backup directory exists
     */
    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupPath);
        } catch {
            await fs.mkdir(this.backupPath, { recursive: true });
        }

        // Create subdirectories
        const subdirs = ['mongodb', 'redis', 'snapshots', 'logs'];
        for (const subdir of subdirs) {
            const dirPath = path.join(this.backupPath, subdir);
            try {
                await fs.access(dirPath);
            } catch {
                await fs.mkdir(dirPath, { recursive: true });
            }
        }
    }

    /**
     * Initializes database connections
     */
    async initializeDatabaseConnections() {
        // MongoDB connection
        const mongoUrl = config.get('database.MONGODB_URL');
        if (mongoUrl) {
            this.mongoClient = new MongoClient(mongoUrl);
            await this.mongoClient.connect();
            console.log('MongoDB connected for backup operations');
        }

        // Redis connection
        const redisUrl = config.get('database.REDIS_URL');
        if (redisUrl) {
            this.redisClient = Redis.createClient({ url: redisUrl });
            await this.redisClient.connect();
            console.log('Redis connected for backup operations');
        }
    }

    /**
     * Schedules automated backup jobs
     */
    async scheduleAutomatedBackups() {
        if (!this.backupConfig.BACKUP_ENABLED) {
            console.log('Automated backups are disabled');
            return;
        }

        const schedule = this.backupConfig.BACKUP_SCHEDULE || 'cron:0 2 * * *';
        const cronExpression = schedule.replace('cron:', '');

        // Full backup schedule
        const fullBackupJob = cron.schedule(cronExpression, async () => {
            try {
                await this.performFullBackup();
            } catch (error) {
                console.error('Scheduled full backup failed:', error.message);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        // Incremental backup schedule (every 6 hours)
        const incrementalBackupJob = cron.schedule('0 */6 * * *', async () => {
            try {
                await this.performIncrementalBackup();
            } catch (error) {
                console.error('Scheduled incremental backup failed:', error.message);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        this.backupJobs.set('full', fullBackupJob);
        this.backupJobs.set('incremental', incrementalBackupJob);

        // Start scheduled jobs
        fullBackupJob.start();
        incrementalBackupJob.start();

        console.log(`Automated backups scheduled: Full=${cronExpression}, Incremental=0 */6 * * *`);
    }

    /**
     * Performs a full database backup
     * @param {object} options Backup options
     * @returns {object} Backup result
     */
    async performFullBackup(options = {}) {
        if (!this.isInitialized) {
            throw new Error('Backup system not initialized');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `full-${timestamp}`;
        const backupResult = {
            id: backupId,
            timestamp: new Date().toISOString(),
            type: 'full',
            databases: {},
            size: 0,
            duration: 0,
            success: false
        };

        const startTime = Date.now();

        try {
            console.log(`Starting full backup: ${backupId}`);

            // Backup MongoDB
            if (this.mongoClient) {
                const mongoBackup = await this.backupMongoDB(backupId);
                backupResult.databases.mongodb = mongoBackup;
                backupResult.size += mongoBackup.size;
            }

            // Backup Redis
            if (this.redisClient) {
                const redisBackup = await this.backupRedis(backupId);
                backupResult.databases.redis = redisBackup;
                backupResult.size += redisBackup.size;
            }

            // Create backup metadata
            await this.createBackupMetadata(backupId, backupResult);

            // Verify backup integrity
            await this.verifyBackupIntegrity(backupId);

            backupResult.success = true;
            backupResult.duration = Date.now() - startTime;

            console.log(`Full backup completed: ${backupId} (${backupResult.size} bytes, ${backupResult.duration}ms)`);
            return backupResult;

        } catch (error) {
            backupResult.error = error.message;
            backupResult.duration = Date.now() - startTime;
            console.error(`Full backup failed: ${backupId}`, error.message);
            throw error;
        }
    }

    /**
     * Performs an incremental backup
     * @param {object} options Backup options
     * @returns {object} Backup result
     */
    async performIncrementalBackup(options = {}) {
        if (!this.isInitialized) {
            throw new Error('Backup system not initialized');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `incremental-${timestamp}`;
        const backupResult = {
            id: backupId,
            timestamp: new Date().toISOString(),
            type: 'incremental',
            databases: {},
            size: 0,
            duration: 0,
            success: false
        };

        const startTime = Date.now();

        try {
            console.log(`Starting incremental backup: ${backupId}`);

            // Get last full backup timestamp
            const lastFullBackup = await this.getLastFullBackup();
            if (!lastFullBackup) {
                throw new Error('No full backup found. Cannot perform incremental backup.');
            }

            // Backup MongoDB changes since last backup
            if (this.mongoClient) {
                const mongoBackup = await this.backupMongoDBIncremental(backupId, lastFullBackup.timestamp);
                backupResult.databases.mongodb = mongoBackup;
                backupResult.size += mongoBackup.size;
            }

            // Backup Redis changes since last backup
            if (this.redisClient) {
                const redisBackup = await this.backupRedisIncremental(backupId, lastFullBackup.timestamp);
                backupResult.databases.redis = redisBackup;
                backupResult.size += redisBackup.size;
            }

            // Create backup metadata
            await this.createBackupMetadata(backupId, backupResult);

            backupResult.success = true;
            backupResult.duration = Date.now() - startTime;

            console.log(`Incremental backup completed: ${backupId} (${backupResult.size} bytes, ${backupResult.duration}ms)`);
            return backupResult;

        } catch (error) {
            backupResult.error = error.message;
            backupResult.duration = Date.now() - startTime;
            console.error(`Incremental backup failed: ${backupId}`, error.message);
            throw error;
        }
    }

    /**
     * Backs up MongoDB database
     * @param {string} backupId Backup ID
     * @returns {object} Backup result
     */
    async backupMongoDB(backupId) {
        const startTime = Date.now();
        const backupPath = path.join(this.backupPath, 'mongodb', `${backupId}.json`);
        
        try {
            const db = this.mongoClient.db();
            const collections = await db.listCollections().toArray();
            
            let backupData = {
                metadata: {
                    backupId,
                    timestamp: new Date().toISOString(),
                    type: 'mongodb',
                    version: '1.0.0'
                },
                collections: {}
            };

            // Dump all collections
            for (const collection of collections) {
                const collName = collection.name;
                const docs = await db.collection(collName).find({}).toArray();
                backupData.collections[collName] = docs;
            }

            // Convert to JSON
            let jsonData = JSON.stringify(backupData, null, 2);
            
            // Compress if enabled
            if (this.compressionEnabled) {
                jsonData = await gzip(jsonData);
            }

            // Encrypt if enabled
            if (this.encryptionEnabled) {
                jsonData = await this.encryptData(jsonData);
            }

            // Write to file
            await fs.writeFile(backupPath, jsonData);

            const stats = await fs.stat(backupPath);

            return {
                success: true,
                path: backupPath,
                size: stats.size,
                collections: collections.length,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Backs up MongoDB incrementally
     * @param {string} backupId Backup ID
     * @param {string} sinceTimestamp Timestamp to backup since
     * @returns {object} Backup result
     */
    async backupMongoDBIncremental(backupId, sinceTimestamp) {
        const startTime = Date.now();
        const backupPath = path.join(this.backupPath, 'mongodb', `${backupId}.json`);
        
        try {
            const db = this.mongoClient.db();
            const collections = await db.listCollections().toArray();
            
            let backupData = {
                metadata: {
                    backupId,
                    timestamp: new Date().toISOString(),
                    type: 'mongodb_incremental',
                    sinceTimestamp,
                    version: '1.0.0'
                },
                collections: {}
            };

            // Dump collections with changes since timestamp
            for (const collection of collections) {
                const collName = collection.name;
                const query = {
                    $or: [
                        { createdAt: { $gt: sinceTimestamp } },
                        { updatedAt: { $gt: sinceTimestamp } }
                    ]
                };
                
                const docs = await db.collection(collName).find(query).toArray();
                if (docs.length > 0) {
                    backupData.collections[collName] = docs;
                }
            }

            // Convert to JSON
            let jsonData = JSON.stringify(backupData, null, 2);
            
            // Compress if enabled
            if (this.compressionEnabled) {
                jsonData = await gzip(jsonData);
            }

            // Encrypt if enabled
            if (this.encryptionEnabled) {
                jsonData = await this.encryptData(jsonData);
            }

            // Write to file
            await fs.writeFile(backupPath, jsonData);

            const stats = await fs.stat(backupPath);

            return {
                success: true,
                path: backupPath,
                size: stats.size,
                changes: Object.keys(backupData.collections).length,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Backs up Redis database
     * @param {string} backupId Backup ID
     * @returns {object} Backup result
     */
    async backupRedis(backupId) {
        const startTime = Date.now();
        const backupPath = path.join(this.backupPath, 'redis', `${backupId}.rdb`);
        
        try {
            // Get all keys
            const keys = await this.redisClient.keys('*');
            
            let backupData = {
                metadata: {
                    backupId,
                    timestamp: new Date().toISOString(),
                    type: 'redis',
                    version: '1.0.0'
                },
                data: {}
            };

            // Dump all key-value pairs
            for (const key of keys) {
                const type = await this.redisClient.type(key);
                let value;

                switch (type) {
                    case 'string':
                        value = await this.redisClient.get(key);
                        break;
                    case 'list':
                        value = await this.redisClient.lRange(key, 0, -1);
                        break;
                    case 'set':
                        value = await this.redisClient.sMembers(key);
                        break;
                    case 'hash':
                        value = await this.redisClient.hGetAll(key);
                        break;
                    case 'zset':
                        value = await this.redisClient.zRangeWithScores(key, 0, -1);
                        break;
                    default:
                        value = await this.redisClient.dump(key);
                }

                backupData.data[key] = {
                    type,
                    value
                };
            }

            // Convert to JSON
            let jsonData = JSON.stringify(backupData, null, 2);
            
            // Compress if enabled
            if (this.compressionEnabled) {
                jsonData = await gzip(jsonData);
            }

            // Encrypt if enabled
            if (this.encryptionEnabled) {
                jsonData = await this.encryptData(jsonData);
            }

            // Write to file
            await fs.writeFile(backupPath, jsonData);

            const stats = await fs.stat(backupPath);

            return {
                success: true,
                path: backupPath,
                size: stats.size,
                keys: keys.length,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Backs up Redis incrementally
     * @param {string} backupId Backup ID
     * @param {string} sinceTimestamp Timestamp to backup since
     * @returns {object} Backup result
     */
    async backupRedisIncremental(backupId, sinceTimestamp) {
        // Redis doesn't have built-in incremental backup
        // For simplicity, we'll do a full backup but mark it as incremental
        return this.backupRedis(backupId);
    }

    /**
     * Encrypts data using AES-256-GCM
     * @param {Buffer} data Data to encrypt
     * @returns {Buffer} Encrypted data
     */
    async encryptData(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', 
            Buffer.from(this.encryptionKey, 'hex'), 
            iv
        );
        
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();
        
        // Combine iv + authTag + encrypted data
        return Buffer.concat([iv, authTag, encrypted]);
    }

    /**
     * Decrypts data using AES-256-GCM
     * @param {Buffer} encryptedData Encrypted data
     * @returns {Buffer} Decrypted data
     */
    async decryptData(encryptedData) {
        const iv = encryptedData.slice(0, 16);
        const authTag = encryptedData.slice(16, 32);
        const data = encryptedData.slice(32);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', 
            Buffer.from(this.encryptionKey, 'hex'), 
            iv
        );
        
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }

    /**
     * Creates backup metadata file
     * @param {string} backupId Backup ID
     * @param {object} backupResult Backup result
     */
    async createBackupMetadata(backupId, backupResult) {
        const metadataPath = path.join(this.backupPath, 'snapshots', `${backupId}.json`);
        await fs.writeFile(metadataPath, JSON.stringify(backupResult, null, 2));
    }

    /**
     * Verifies backup integrity
     * @param {string} backupId Backup ID
     */
    async verifyBackupIntegrity(backupId) {
        const metadataPath = path.join(this.backupPath, 'snapshots', `${backupId}.json`);
        
        try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            
            // Verify MongoDB backup
            if (metadata.databases.mongodb && metadata.databases.mongodb.success) {
                await this.verifyMongoDBBackup(metadata.databases.mongodb.path);
            }
            
            // Verify Redis backup
            if (metadata.databases.redis && metadata.databases.redis.success) {
                await this.verifyRedisBackup(metadata.databases.redis.path);
            }
            
            console.log(`Backup integrity verified: ${backupId}`);
            
        } catch (error) {
            console.error(`Backup integrity verification failed: ${backupId}`, error.message);
            throw error;
        }
    }

    /**
     * Verifies MongoDB backup file
     * @param {string} backupPath Backup file path
     */
    async verifyMongoDBBackup(backupPath) {
        let data = await fs.readFile(backupPath);
        
        // Decrypt if needed
        if (this.encryptionEnabled) {
            data = await this.decryptData(data);
        }
        
        // Decompress if needed
        if (this.compressionEnabled) {
            data = await gunzip(data);
        }
        
        // Parse JSON to verify structure
        const backupData = JSON.parse(data.toString());
        
        if (!backupData.metadata || !backupData.collections) {
            throw new Error('Invalid MongoDB backup structure');
        }
    }

    /**
     * Verifies Redis backup file
     * @param {string} backupPath Backup file path
     */
    async verifyRedisBackup(backupPath) {
        let data = await fs.readFile(backupPath);
        
        // Decrypt if needed
        if (this.encryptionEnabled) {
            data = await this.decryptData(data);
        }
        
        // Decompress if needed
        if (this.compressionEnabled) {
            data = await gunzip(data);
        }
        
        // Parse JSON to verify structure
        const backupData = JSON.parse(data.toString());
        
        if (!backupData.metadata || !backupData.data) {
            throw new Error('Invalid Redis backup structure');
        }
    }

    /**
     * Gets the last full backup
     * @returns {object|null} Last full backup metadata
     */
    async getLastFullBackup() {
        const snapshotsDir = path.join(this.backupPath, 'snapshots');
        const files = await fs.readdir(snapshotsDir);
        
        const fullBackups = files
            .filter(file => file.startsWith('full-') && file.endsWith('.json'))
            .map(file => file.replace('.json', ''))
            .sort()
            .reverse();
        
        if (fullBackups.length === 0) {
            return null;
        }
        
        const lastBackupPath = path.join(snapshotsDir, `${fullBackups[0]}.json`);
        const metadata = JSON.parse(await fs.readFile(lastBackupPath, 'utf8'));
        
        return metadata;
    }

    /**
     * Restores database from backup
     * @param {string} backupId Backup ID to restore from
     * @param {object} options Restore options
     * @returns {object} Restore result
     */
    async restoreFromBackup(backupId, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Backup system not initialized');
        }

        const metadataPath = path.join(this.backupPath, 'snapshots', `${backupId}.json`);
        
        try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            
            console.log(`Starting restore from backup: ${backupId}`);
            
            const restoreResult = {
                backupId,
                timestamp: new Date().toISOString(),
                databases: {},
                success: false
            };

            // Restore MongoDB
            if (metadata.databases.mongodb && metadata.databases.mongodb.success) {
                restoreResult.databases.mongodb = await this.restoreMongoDB(
                    metadata.databases.mongodb.path,
                    options.mongodb || {}
                );
            }

            // Restore Redis
            if (metadata.databases.redis && metadata.databases.redis.success) {
                restoreResult.databases.redis = await this.restoreRedis(
                    metadata.databases.redis.path,
                    options.redis || {}
                );
            }

            restoreResult.success = true;
            console.log(`Restore completed: ${backupId}`);
            
            return restoreResult;

        } catch (error) {
            console.error(`Restore failed: ${backupId}`, error.message);
            throw error;
        }
    }

    /**
     * Restores MongoDB from backup
     * @param {string} backupPath Backup file path
     * @param {object} options Restore options
     * @returns {object} Restore result
     */
    async restoreMongoDB(backupPath, options = {}) {
        const startTime = Date.now();
        
        try {
            let data = await fs.readFile(backupPath);
            
            // Decrypt if needed
            if (this.encryptionEnabled) {
                data = await this.decryptData(data);
            }
            
            // Decompress if needed
            if (this.compressionEnabled) {
                data = await gunzip(data);
            }
            
            const backupData = JSON.parse(data.toString());
            const db = this.mongoClient.db();
            
            // Clear existing data if requested
            if (options.clearExisting) {
                const collections = await db.listCollections().toArray();
                for (const collection of collections) {
                    await db.collection(collection.name).deleteMany({});
                }
            }
            
            // Restore collections
            for (const [collName, docs] of Object.entries(backupData.collections)) {
                if (docs.length > 0) {
                    await db.collection(collName).insertMany(docs);
                }
            }
            
            return {
                success: true,
                collections: Object.keys(backupData.collections).length,
                duration: Date.now() - startTime
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Restores Redis from backup
     * @param {string} backupPath Backup file path
     * @param {object} options Restore options
     * @returns {object} Restore result
     */
    async restoreRedis(backupPath, options = {}) {
        const startTime = Date.now();
        
        try {
            let data = await fs.readFile(backupPath);
            
            // Decrypt if needed
            if (this.encryptionEnabled) {
                data = await this.decryptData(data);
            }
            
            // Decompress if needed
            if (this.compressionEnabled) {
                data = await gunzip(data);
            }
            
            const backupData = JSON.parse(data.toString());
            
            // Clear existing data if requested
            if (options.clearExisting) {
                await this.redisClient.flushDb();
            }
            
            // Restore data
            for (const [key, keyData] of Object.entries(backupData.data)) {
                const { type, value } = keyData;
                
                switch (type) {
                    case 'string':
                        await this.redisClient.set(key, value);
                        break;
                    case 'list':
                        if (value.length > 0) {
                            await this.redisClient.del(key);
                            await this.redisClient.lPush(key, ...value);
                        }
                        break;
                    case 'set':
                        if (value.length > 0) {
                            await this.redisClient.sAdd(key, ...value);
                        }
                        break;
                    case 'hash':
                        if (Object.keys(value).length > 0) {
                            await this.redisClient.hMSet(key, value);
                        }
                        break;
                    case 'zset':
                        if (value.length > 0) {
                            const args = [];
                            for (const [member, score] of value) {
                                args.push(score, member);
                            }
                            await this.redisClient.zAdd(key, args);
                        }
                        break;
                    default:
                        await this.redisClient.restore(key, 0, value);
                }
            }
            
            return {
                success: true,
                keys: Object.keys(backupData.data).length,
                duration: Date.now() - startTime
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Lists available backups
     * @param {object} filters Filters to apply
     * @returns {array} List of backups
     */
    async listBackups(filters = {}) {
        const snapshotsDir = path.join(this.backupPath, 'snapshots');
        const files = await fs.readdir(snapshotsDir);
        
        let backups = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const backupPath = path.join(snapshotsDir, file);
                const metadata = JSON.parse(await fs.readFile(backupPath, 'utf8'));
                backups.push(metadata);
            }
        }
        
        // Apply filters
        if (filters.type) {
            backups = backups.filter(backup => backup.type === filters.type);
        }
        
        if (filters.since) {
            const sinceDate = new Date(filters.since);
            backups = backups.filter(backup => new Date(backup.timestamp) >= sinceDate);
        }
        
        if (filters.limit) {
            backups = backups.slice(0, filters.limit);
        }
        
        // Sort by timestamp (newest first)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return backups;
    }

    /**
     * Cleans up old backups based on retention policy
     */
    async cleanupOldBackups() {
        try {
            const backups = await this.listBackups();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
            
            const backupsToDelete = backups.filter(backup => 
                new Date(backup.timestamp) < cutoffDate
            );
            
            for (const backup of backupsToDelete) {
                await this.deleteBackup(backup.id);
            }
            
            if (backupsToDelete.length > 0) {
                console.log(`Cleaned up ${backupsToDelete.length} old backups`);
            }
            
        } catch (error) {
            console.error('Backup cleanup failed:', error.message);
        }
    }

    /**
     * Deletes a backup
     * @param {string} backupId Backup ID to delete
     */
    async deleteBackup(backupId) {
        try {
            // Delete metadata
            const metadataPath = path.join(this.backupPath, 'snapshots', `${backupId}.json`);
            await fs.unlink(metadataPath);
            
            // Delete MongoDB backup
            const mongoPath = path.join(this.backupPath, 'mongodb', `${backupId}.json`);
            try {
                await fs.unlink(mongoPath);
            } catch (error) {
                // File might not exist
            }
            
            // Delete Redis backup
            const redisPath = path.join(this.backupPath, 'redis', `${backupId}.rdb`);
            try {
                await fs.unlink(redisPath);
            } catch (error) {
                // File might not exist
            }
            
            console.log(`Backup deleted: ${backupId}`);
            
        } catch (error) {
            console.error(`Failed to delete backup: ${backupId}`, error.message);
            throw error;
        }
    }

    /**
     * Gets backup statistics
     * @returns {object} Backup statistics
     */
    async getBackupStatistics() {
        const backups = await this.listBackups();
        
        const stats = {
            totalBackups: backups.length,
            fullBackups: backups.filter(b => b.type === 'full').length,
            incrementalBackups: backups.filter(b => b.type === 'incremental').length,
            totalSize: backups.reduce((sum, b) => sum + (b.size || 0), 0),
            oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
            newestBackup: backups.length > 0 ? backups[0].timestamp : null,
            successRate: backups.filter(b => b.success).length / backups.length * 100
        };
        
        return stats;
    }

    /**
     * Performs point-in-time recovery
     * @param {string} targetTimestamp Target timestamp for recovery
     * @param {object} options Recovery options
     * @returns {object} Recovery result
     */
    async pointInTimeRecovery(targetTimestamp, options = {}) {
        try {
            console.log(`Starting point-in-time recovery to: ${targetTimestamp}`);
            
            // Find the most recent full backup before the target timestamp
            const backups = await this.listBackups({ type: 'full' });
            const targetDate = new Date(targetTimestamp);
            
            let fullBackup = null;
            for (const backup of backups) {
                if (new Date(backup.timestamp) <= targetDate) {
                    fullBackup = backup;
                    break;
                }
            }
            
            if (!fullBackup) {
                throw new Error('No suitable full backup found for point-in-time recovery');
            }
            
            // Restore from full backup
            const restoreResult = await this.restoreFromBackup(fullBackup.id, options);
            
            // Apply incremental backups up to target timestamp
            const incrementalBackups = await this.listBackups({ 
                type: 'incremental',
                since: fullBackup.timestamp
            });
            
            for (const incBackup of incrementalBackups) {
                if (new Date(incBackup.timestamp) <= targetDate) {
                    await this.applyIncrementalBackup(incBackup.id);
                }
            }
            
            return {
                success: true,
                targetTimestamp,
                baseBackup: fullBackup.id,
                incrementalBackups: incrementalBackups.length,
                restoreResult
            };
            
        } catch (error) {
            console.error(`Point-in-time recovery failed: ${targetTimestamp}`, error.message);
            throw error;
        }
    }

    /**
     * Applies incremental backup
     * @param {string} backupId Backup ID
     */
    async applyIncrementalBackup(backupId) {
        const metadataPath = path.join(this.backupPath, 'snapshots', `${backupId}.json`);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        
        // Apply MongoDB incremental changes
        if (metadata.databases.mongodb && metadata.databases.mongodb.success) {
            await this.applyMongoDBIncremental(metadata.databases.mongodb.path);
        }
        
        // Apply Redis incremental changes
        if (metadata.databases.redis && metadata.databases.redis.success) {
            await this.applyRedisIncremental(metadata.databases.redis.path);
        }
    }

    /**
     * Applies MongoDB incremental backup
     * @param {string} backupPath Backup file path
     */
    async applyMongoDBIncremental(backupPath) {
        let data = await fs.readFile(backupPath);
        
        if (this.encryptionEnabled) {
            data = await this.decryptData(data);
        }
        
        if (this.compressionEnabled) {
            data = await gunzip(data);
        }
        
        const backupData = JSON.parse(data.toString());
        const db = this.mongoClient.db();
        
        // Apply incremental changes
        for (const [collName, docs] of Object.entries(backupData.collections)) {
            for (const doc of docs) {
                await db.collection(collName).replaceOne(
                    { _id: doc._id },
                    doc,
                    { upsert: true }
                );
            }
        }
    }

    /**
     * Applies Redis incremental backup
     * @param {string} backupPath Backup file path
     */
    async applyRedisIncremental(backupPath) {
        // For Redis, incremental backup is the same as full backup
        await this.restoreRedis(backupPath, { clearExisting: false });
    }

    /**
     * Shuts down the backup system
     */
    async shutdown() {
        // Stop scheduled jobs
        for (const [name, job] of this.backupJobs) {
            job.stop();
        }
        
        // Close database connections
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
        
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        
        console.log('Database backup system shutdown completed');
    }
}

// Export singleton instance
const backup = new DatabaseBackup();

module.exports = backup;
