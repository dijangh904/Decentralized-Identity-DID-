/**
 * @title DatabaseBackup Tests
 * @dev Comprehensive tests for database backup functionality
 */

const DatabaseBackup = require('../backup/DatabaseBackup');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('mongodb', () => ({
    MongoClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        db: jest.fn().mockReturnValue({
            listCollections: jest.fn().mockResolvedValue([{ name: 'test' }]),
            collection: jest.fn().mockReturnValue({
                find: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue([{ _id: '1', data: 'test' }])
                }),
                insertMany: jest.fn().mockResolvedValue(),
                deleteMany: jest.fn().mockResolvedValue()
            })
        }),
        close: jest.fn().mockResolvedValue()
    }))
}));

jest.mock('redis', () => ({
    createClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        keys: jest.fn().mockResolvedValue(['key1', 'key2']),
        type: jest.fn().mockResolvedValue('string'),
        get: jest.fn().mockResolvedValue('value'),
        flushDb: jest.fn().mockResolvedValue(),
        quit: jest.fn().mockResolvedValue()
    }))
}));

jest.mock('node-cron', () => ({
    schedule: jest.fn().mockReturnValue({
        start: jest.fn(),
        stop: jest.fn()
    })
}));

describe('DatabaseBackup', () => {
    let backup;
    let testBackupPath;

    beforeEach(async () => {
        // Set up test environment
        process.env.NODE_ENV = 'test';
        process.env.BACKUP_ENCRYPTION_KEY = 'test-backup-encryption-key-32-chars';
        process.env.BACKUP_STORAGE_PATH = './test-backups';
        process.env.BACKUP_ENABLED = 'true';
        process.env.BACKUP_SCHEDULE = 'cron:0 2 * * *';
        process.env.BACKUP_RETENTION_DAYS = '30';
        process.env.BACKUP_ENCRYPTION_ENABLED = 'true';
        process.env.BACKUP_COMPRESSION = 'true';

        testBackupPath = path.join(__dirname, '../../test-backups');
        
        // Create test backup directory
        try {
            await fs.mkdir(testBackupPath, { recursive: true });
            await fs.mkdir(path.join(testBackupPath, 'mongodb'), { recursive: true });
            await fs.mkdir(path.join(testBackupPath, 'redis'), { recursive: true });
            await fs.mkdir(path.join(testBackupPath, 'snapshots'), { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        backup = new DatabaseBackup();
    });

    afterEach(async () => {
        // Clean up test files
        try {
            await backup.shutdown();
            await fs.rm(testBackupPath, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Backup Initialization', () => {
        test('should initialize backup system successfully', async () => {
            expect(backup.isInitialized).toBe(true);
            expect(backup.backupPath).toBe(testBackupPath);
            expect(backup.encryptionEnabled).toBe(true);
            expect(backup.compressionEnabled).toBe(true);
            expect(backup.retentionDays).toBe(30);
        });

        test('should create backup directories', async () => {
            const directories = ['mongodb', 'redis', 'snapshots', 'logs'];
            
            for (const dir of directories) {
                const dirPath = path.join(testBackupPath, dir);
                const exists = await fs.access(dirPath).then(() => true).catch(() => false);
                expect(exists).toBe(true);
            }
        });
    });

    describe('Full Backup Operations', () => {
        test('should perform full backup successfully', async () => {
            const result = await backup.performFullBackup();
            
            expect(result.success).toBe(true);
            expect(result.type).toBe('full');
            expect(result.timestamp).toBeDefined();
            expect(result.databases).toBeDefined();
            expect(result.size).toBeGreaterThan(0);
            expect(result.duration).toBeGreaterThan(0);
        });

        test('should backup MongoDB database', async () => {
            const backupId = 'test-backup-mongodb';
            const result = await backup.backupMongoDB(backupId);
            
            expect(result.success).toBe(true);
            expect(result.path).toContain('mongodb');
            expect(result.size).toBeGreaterThan(0);
            expect(result.collections).toBeGreaterThan(0);
            expect(result.duration).toBeGreaterThan(0);
        });

        test('should backup Redis database', async () => {
            const backupId = 'test-backup-redis';
            const result = await backup.backupRedis(backupId);
            
            expect(result.success).toBe(true);
            expect(result.path).toContain('redis');
            expect(result.size).toBeGreaterThan(0);
            expect(result.keys).toBeGreaterThan(0);
            expect(result.duration).toBeGreaterThan(0);
        });

        test('should create backup metadata', async () => {
            const backupResult = await backup.performFullBackup();
            const metadataPath = path.join(testBackupPath, 'snapshots', `${backupResult.id}.json`);
            
            const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
            expect(metadataExists).toBe(true);
        });
    });

    describe('Incremental Backup Operations', () => {
        test('should perform incremental backup successfully', async () => {
            // First perform a full backup
            await backup.performFullBackup();
            
            // Then perform incremental backup
            const result = await backup.performIncrementalBackup();
            
            expect(result.success).toBe(true);
            expect(result.type).toBe('incremental');
            expect(result.timestamp).toBeDefined();
            expect(result.databases).toBeDefined();
        });

        test('should fail incremental backup without full backup', async () => {
            await expect(backup.performIncrementalBackup()).rejects.toThrow('No full backup found');
        });
    });

    describe('Data Encryption and Compression', () => {
        test('should encrypt backup data', async () => {
            const testData = Buffer.from('test backup data');
            const encrypted = await backup.encryptData(testData);
            
            expect(encrypted).not.toEqual(testData);
            expect(encrypted.length).toBeGreaterThan(testData.length);
        });

        test('should decrypt backup data', async () => {
            const originalData = Buffer.from('test backup data');
            const encrypted = await backup.encryptData(originalData);
            const decrypted = await backup.decryptData(encrypted);
            
            expect(decrypted).toEqual(originalData);
        });

        test('should handle encryption errors gracefully', async () => {
            const invalidData = Buffer.from('invalid encrypted data');
            
            await expect(backup.decryptData(invalidData)).rejects.toThrow();
        });
    });

    describe('Backup Verification', () => {
        test('should verify backup integrity', async () => {
            const backupResult = await backup.performFullBackup();
            
            await expect(backup.verifyBackupIntegrity(backupResult.id)).resolves.not.toThrow();
        });

        test('should verify MongoDB backup structure', async () => {
            const backupId = 'test-verify-mongodb';
            const result = await backup.backupMongoDB(backupId);
            
            await expect(backup.verifyMongoDBBackup(result.path)).resolves.not.toThrow();
        });

        test('should verify Redis backup structure', async () => {
            const backupId = 'test-verify-redis';
            const result = await backup.backupRedis(backupId);
            
            await expect(backup.verifyRedisBackup(result.path)).resolves.not.toThrow();
        });

        test('should detect invalid backup structure', async () => {
            const invalidBackupPath = path.join(testBackupPath, 'invalid.json');
            await fs.writeFile(invalidBackupPath, JSON.stringify({ invalid: 'structure' }));
            
            await expect(backup.verifyMongoDBBackup(invalidBackupPath)).rejects.toThrow('Invalid MongoDB backup structure');
        });
    });

    describe('Backup Restoration', () => {
        test('should restore from backup successfully', async () => {
            const backupResult = await backup.performFullBackup();
            const restoreResult = await backup.restoreFromBackup(backupResult.id);
            
            expect(restoreResult.success).toBe(true);
            expect(restoreResult.backupId).toBe(backupResult.id);
            expect(restoreResult.databases).toBeDefined();
        });

        test('should restore MongoDB from backup', async () => {
            const backupId = 'test-restore-mongodb';
            await backup.backupMongoDB(backupId);
            const backupPath = path.join(testBackupPath, 'mongodb', `${backupId}.json`);
            
            const result = await backup.restoreMongoDB(backupPath);
            
            expect(result.success).toBe(true);
            expect(result.collections).toBeGreaterThan(0);
        });

        test('should restore Redis from backup', async () => {
            const backupId = 'test-restore-redis';
            await backup.backupRedis(backupId);
            const backupPath = path.join(testBackupPath, 'redis', `${backupId}.json`);
            
            const result = await backup.restoreRedis(backupPath);
            
            expect(result.success).toBe(true);
            expect(result.keys).toBeGreaterThan(0);
        });
    });

    describe('Backup Management', () => {
        test('should list available backups', async () => {
            // Create some test backups
            await backup.performFullBackup();
            await backup.performIncrementalBackup();
            
            const backups = await backup.listBackups();
            
            expect(Array.isArray(backups)).toBe(true);
            expect(backups.length).toBeGreaterThan(0);
            expect(backups[0].id).toBeDefined();
            expect(backups[0].timestamp).toBeDefined();
            expect(backups[0].type).toBeDefined();
        });

        test('should filter backups by type', async () => {
            await backup.performFullBackup();
            await backup.performIncrementalBackup();
            
            const fullBackups = await backup.listBackups({ type: 'full' });
            const incrementalBackups = await backup.listBackups({ type: 'incremental' });
            
            expect(fullBackups.every(b => b.type === 'full')).toBe(true);
            expect(incrementalBackups.every(b => b.type === 'incremental')).toBe(true);
        });

        test('should filter backups by date', async () => {
            await backup.performFullBackup();
            
            const since = new Date();
            since.setHours(since.getHours() - 1);
            
            const recentBackups = await backup.listBackups({ since: since.toISOString() });
            
            expect(recentBackups.length).toBeGreaterThan(0);
            recentBackups.forEach(backup => {
                expect(new Date(backup.timestamp)).toBeGreaterThanOrEqual(since);
            });
        });

        test('should delete backup', async () => {
            const backupResult = await backup.performFullBackup();
            const backupId = backupResult.id;
            
            await backup.deleteBackup(backupId);
            
            const backups = await backup.listBackups();
            const deletedBackup = backups.find(b => b.id === backupId);
            expect(deletedBackup).toBeUndefined();
        });

        test('should get backup statistics', async () => {
            await backup.performFullBackup();
            await backup.performIncrementalBackup();
            
            const stats = await backup.getBackupStatistics();
            
            expect(stats.totalBackups).toBeGreaterThan(0);
            expect(stats.fullBackups).toBeGreaterThan(0);
            expect(stats.incrementalBackups).toBeGreaterThan(0);
            expect(stats.totalSize).toBeGreaterThan(0);
            expect(stats.newestBackup).toBeDefined();
            expect(stats.successRate).toBeGreaterThan(0);
        });
    });

    describe('Point-in-Time Recovery', () => {
        test('should perform point-in-time recovery', async () => {
            const fullBackup = await backup.performFullBackup();
            const targetTimestamp = new Date(fullBackup.timestamp);
            targetTimestamp.setMinutes(targetTimestamp.getMinutes() + 1);
            
            const result = await backup.pointInTimeRecovery(targetTimestamp.toISOString());
            
            expect(result.success).toBe(true);
            expect(result.targetTimestamp).toBe(targetTimestamp.toISOString());
            expect(result.baseBackup).toBe(fullBackup.id);
        });

        test('should fail point-in-time recovery without suitable backup', async () => {
            const futureTimestamp = new Date();
            futureTimestamp.setFullYear(futureTimestamp.getFullYear() + 1);
            
            await expect(backup.pointInTimeRecovery(futureTimestamp.toISOString()))
                .rejects.toThrow('No suitable full backup found');
        });
    });

    describe('Backup Cleanup', () => {
        test('should clean up old backups', async () => {
            // Create backup with old timestamp
            const oldBackup = {
                id: 'old-backup',
                timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days ago
                type: 'full'
            };
            
            const metadataPath = path.join(testBackupPath, 'snapshots', `${oldBackup.id}.json`);
            await fs.writeFile(metadataPath, JSON.stringify(oldBackup));
            
            await backup.cleanupOldBackups();
            
            const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
            expect(metadataExists).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle backup initialization failure', async () => {
            // Mock invalid configuration
            process.env.BACKUP_ENCRYPTION_KEY = '';
            
            await expect(new DatabaseBackup()).rejects.toThrow('Backup encryption key not found');
        });

        test('should handle backup verification failure', async () => {
            const invalidBackupId = 'non-existent-backup';
            
            await expect(backup.verifyBackupIntegrity(invalidBackupId))
                .rejects.toThrow();
        });

        test('should handle restore from non-existent backup', async () => {
            const invalidBackupId = 'non-existent-backup';
            
            await expect(backup.restoreFromBackup(invalidBackupId))
                .rejects.toThrow();
        });
    });

    describe('Performance Metrics', () => {
        test('should track backup performance', async () => {
            const result = await backup.performFullBackup();
            
            expect(result.duration).toBeGreaterThan(0);
            expect(result.size).toBeGreaterThan(0);
        });

        test('should measure storage latency', async () => {
            const startTime = Date.now();
            await backup.performFullBackup();
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeGreaterThan(0);
        });
    });

    describe('Configuration', () => {
        test('should use custom backup path', async () => {
            process.env.BACKUP_STORAGE_PATH = './custom-backups';
            const customBackup = new DatabaseBackup();
            
            expect(customBackup.backupPath).toBe('./custom-backups');
        });

        test('should handle disabled compression', async () => {
            process.env.BACKUP_COMPRESSION = 'false';
            const noCompressionBackup = new DatabaseBackup();
            
            expect(noCompressionBackup.compressionEnabled).toBe(false);
        });

        test('should handle disabled encryption', async () => {
            process.env.BACKUP_ENCRYPTION_ENABLED = 'false';
            const noEncryptionBackup = new DatabaseBackup();
            
            expect(noEncryptionBackup.encryptionEnabled).toBe(false);
        });
    });
});
