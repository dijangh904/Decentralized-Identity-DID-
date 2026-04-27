# Comprehensive Features Implementation Guide

This guide documents the comprehensive implementation of four major features for the Decentralized Identity DID platform:

1. **Contract Gas Estimation** (Issue #161)
2. **Centralized Environment Configuration** (Issue #136) 
3. **Automated Database Backups** (Issue #135)
4. **Event Sourcing for Audit Trail** (Issue #123)

## Table of Contents

- [Gas Estimation](#gas-estimation)
- [Centralized Configuration](#centralized-configuration)
- [Database Backup & Recovery](#database-backup--recovery)
- [Event Sourcing & Audit Trail](#event-sourcing--audit-trail)
- [Integration Examples](#integration-examples)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Gas Estimation

### Overview

The gas estimation system provides accurate gas cost predictions for all contract operations, helping users make informed decisions about transaction costs and optimize their operations.

### Features

- **Real-time gas estimation** for all DID and credential operations
- **Historical gas usage tracking** for improved accuracy
- **Batch operation optimization** with automatic discounts
- **Dynamic pricing** based on network conditions
- **Gas optimization recommendations**

### Usage Examples

#### Basic Gas Estimation

```javascript
const { ethers } = require('ethers');
const GasEstimation = require('./contracts/utils/GasEstimation');

// Initialize gas estimation
const gasEstimation = new GasEstimation(contract);

// Estimate DID creation cost
const didEstimate = await gasEstimation.estimateDIDCreation(
    '0x1234567890123456789012345678901234567890',
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    3 // Number of service endpoints
);

console.log(`DID Creation: ${didEstimate.totalGas} gas (${didEstimate.estimatedCost} wei)`);

// Estimate credential issuance
const credentialEstimate = await gasEstimation.estimateCredentialIssuance(
    '0x1234567890123456789012345678901234567890',
    '0x0987654321098765432109876543210987654321',
    1000 // Credential data length in bytes
);

console.log(`Credential Issuance: ${credentialEstimate.totalGas} gas`);
```

#### Batch Operations

```javascript
// Estimate batch DID creation with discount
const batchEstimate = await gasEstimation.estimateBatchOperation(
    'DID_CREATE',
    10, // Number of operations
    5   // Data complexity (1-10)
);

console.log(`Batch of 10 DIDs: ${batchEstimate.totalBatchGas} gas`);
console.log(`Savings: ${batchEstimate.savings} gas (${batchEstimate.batchDiscount}% discount)`);
```

#### Historical Optimization

```javascript
// Record actual gas usage after transaction
await gasEstimation.recordGasUsage('DID_CREATE', actualGasUsed);

// Get optimized estimate based on historical data
const optimizedEstimate = gasEstimation.getOptimizedEstimate('DID_CREATE', true);
console.log(`Optimized estimate: ${optimizedEstimate.totalGas} gas`);
```

#### Gas Price Analysis

```javascript
// Update gas price history
await gasEstimation.updateGasPriceHistory(currentGasPrice);

// Get average gas price
const avgGasPrice = gasEstimation.getAverageGasPrice(10); // Last 10 samples
console.log(`Average gas price: ${avgGasPrice} wei`);
```

### API Reference

#### Core Methods

- `estimateDIDCreation(owner, publicKey, serviceEndpoints)` - Estimate DID creation gas
- `estimateCredentialIssuance(issuer, subject, credentialDataLength)` - Estimate credential issuance
- `estimateBatchOperation(operationType, operationCount, dataComplexity)` - Estimate batch operations
- `recordGasUsage(operationType, actualGasUsed)` - Record actual gas usage
- `getOptimizedEstimate(operationType, useHistoricalAverage)` - Get optimized estimate

#### Supported Operations

- `DID_CREATE`, `DID_UPDATE`, `DID_TRANSFER`, `DID_DELETE`
- `CREDENTIAL_ISSUE`, `CREDENTIAL_REVOKE`, `CREDENTIAL_UPDATE`
- `GOVERNANCE_PROPOSE`, `GOVERNANCE_VOTE`
- `RECOVERY_INITIATE`, `RECOVERY_EXECUTE`
- `PROXY_UPGRADE`, `ACCESS_CONTROL`

---

## Centralized Configuration

### Overview

The centralized configuration system provides a unified way to manage all environment variables with validation, encryption, and type safety. It addresses scattered configuration issues by providing a single source of truth.

### Features

- **Schema-based validation** for all configuration sections
- **Encryption support** for sensitive values
- **Environment-specific overrides**
- **Runtime configuration updates**
- **Security validation** and scanning
- **Configuration versioning** and migration

### Usage Examples

#### Basic Configuration Access

```javascript
const config = require('./src/config/CentralizedConfig');

// Get configuration values
const stellarNetwork = config.get('stellar.STELLAR_NETWORK');
const serverPort = config.get('server.PORT', 3001); // With default
const jwtSecret = config.get('jwt.JWT_SECRET');

// Set configuration values
await config.set('custom.setting', 'custom_value');
await config.set('nested.deep.value', 'deep_value');

// Set sensitive values with encryption
await config.set('sensitive.secret', 'secret_value', true);
```

#### Configuration Validation

```javascript
// Validate configuration section
const validation = config.validateSection('stellar', {
    STELLAR_NETWORK: 'TESTNET',
    STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    STELLAR_PASSPHRASE: 'Test SDF Network ; September 2015'
});

if (validation.error) {
    console.error('Validation failed:', validation.error);
} else {
    console.log('Configuration valid');
}
```

#### Environment-Specific Configuration

```javascript
// Create environment override file: config/production.json
{
    "server": {
        "PORT": 8080,
        "SECURITY_HEADERS": true
    },
    "database": {
        "POOL_SIZE": 20,
        "TIMEOUT": 60000
    }
}

// Configuration automatically loads overrides based on NODE_ENV
const environment = config.getEnvironment(); // 'production', 'development', 'test'
```

#### Encryption and Security

```javascript
// Encrypt sensitive values
const encrypted = config.encryptValue('super_secret_password');
const decrypted = config.decryptValue(encrypted);

// Check if field is sensitive
const isSensitive = config.isSensitiveField('JWT_SECRET'); // true

// Export configuration (sensitive values masked)
const safeExport = config.export(false);
const fullExport = config.export(true); // Include sensitive values
```

#### Configuration Reloading

```javascript
// Reload configuration from environment
await config.reload();

// Save encrypted configuration to file
await config.saveEncrypted('./encrypted-config.json');

// Load encrypted configuration from file
await config.loadEncrypted('./encrypted-config.json');
```

### Configuration Sections

#### Stellar Network
```javascript
const stellar = config.get('stellar');
// STELLAR_NETWORK, STELLAR_HORIZON_URL, STELLAR_PASSPHRASE, STELLAR_FRIENDBOT_URL
```

#### DID Configuration
```javascript
const did = config.get('did');
// DID_METHOD, DID_REGISTRY_PUBLIC_KEY
```

#### Server Configuration
```javascript
const server = config.get('server');
// PORT, NODE_ENV, FRONTEND_URL
```

#### Database Configuration
```javascript
const database = config.get('database');
// MONGODB_URL, REDIS_URL, DB_POOL_SIZE, DB_TIMEOUT
```

#### JWT Configuration
```javascript
const jwt = config.get('jwt');
// JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
```

#### Security Configuration
```javascript
const security = config.get('security');
// CORS_ORIGIN, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, BCRYPT_ROUNDS
```

#### EVM Configuration
```javascript
const evm = config.get('evm');
// EVM_RPC_URL, EVM_PRIVATE_KEY, EVM_DID_REGISTRY_ADDRESS, EVM_CHAIN_ID
```

#### Backup Configuration
```javascript
const backup = config.get('backup');
// BACKUP_ENABLED, BACKUP_SCHEDULE, BACKUP_RETENTION_DAYS, BACKUP_ENCRYPTION_ENABLED
```

#### Event Sourcing Configuration
```javascript
const events = config.get('events');
// EVENT_SOURCING_ENABLED, EVENT_STORE_DB, EVENT_SNAPSHOT_INTERVAL, EVENT_RETENTION_DAYS
```

---

## Database Backup & Recovery

### Overview

The automated database backup system provides comprehensive backup and recovery capabilities with point-in-time recovery, compression, encryption, and retention management.

### Features

- **Automated scheduled backups** (full and incremental)
- **Point-in-time recovery** to any timestamp
- **Backup compression and encryption**
- **Retention policy management**
- **Backup verification and integrity checks**
- **Cross-environment backup support**

### Usage Examples

#### Manual Backup Operations

```javascript
const backup = require('./src/backup/DatabaseBackup');

// Perform full backup
const fullBackup = await backup.performFullBackup();
console.log(`Full backup completed: ${fullBackup.id} (${fullBackup.size} bytes)`);

// Perform incremental backup
const incrementalBackup = await backup.performIncrementalBackup();
console.log(`Incremental backup completed: ${incrementalBackup.id}`);
```

#### Backup Restoration

```javascript
// Restore from specific backup
const restoreResult = await backup.restoreFromBackup('full-2023-12-01T10-30-00-000Z');
console.log(`Restore completed: ${restoreResult.success}`);

// Point-in-time recovery
const recoveryResult = await backup.pointInTimeRecovery('2023-12-01T10:30:00.000Z');
console.log(`Recovery to timestamp: ${recoveryResult.targetTimestamp}`);
```

#### Backup Management

```javascript
// List available backups
const backups = await backup.listBackups();
console.log(`Total backups: ${backups.length}`);

// Filter backups
const recentBackups = await backup.listBackups({
    type: 'full',
    since: '2023-12-01T00:00:00.000Z',
    limit: 10
});

// Get backup statistics
const stats = await backup.getBackupStatistics();
console.log(`Total size: ${stats.totalSize} bytes`);
console.log(`Success rate: ${stats.successRate}%`);

// Delete old backup
await backup.deleteBackup('old-backup-id');
```

#### Backup Verification

```javascript
// Verify backup integrity
await backup.verifyBackupIntegrity('backup-id');

// Verify specific backup files
await backup.verifyMongoDBBackup('./backups/mongodb/backup.json');
await backup.verifyRedisBackup('./backups/redis/backup.rdb');
```

### Configuration

#### Environment Variables

```bash
# Backup Configuration
BACKUP_ENABLED=true
BACKUP_STORAGE_PATH=./backups
BACKUP_SCHEDULE=cron:0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_ENABLED=true
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION_KEY=your-encryption-key
```

#### Backup Schedule Format

The backup schedule uses cron format: `cron:minute hour day month weekday`

Examples:
- `cron:0 2 * * *` - Daily at 2:00 AM
- `cron:0 */6 * * *` - Every 6 hours
- `cron:0 0 * * 0` - Weekly on Sunday at midnight

### Backup Structure

```
backups/
├── mongodb/          # MongoDB backup files
├── redis/            # Redis backup files
├── snapshots/        # Backup metadata
└── logs/             # Backup logs
```

### Recovery Scenarios

#### Full System Recovery
```javascript
// Restore entire system from latest backup
const latestBackup = await backup.listBackups({ limit: 1 });
await backup.restoreFromBackup(latestBackup[0].id);
```

#### Point-in-Time Recovery
```javascript
// Recover to specific point in time
await backup.pointInTimeRecovery('2023-12-01T15:30:00.000Z');
```

#### Selective Recovery
```javascript
// Restore only MongoDB
const mongoRestore = await backup.restoreMongoDB('./backups/mongodb/backup.json');

// Restore only Redis
const redisRestore = await backup.restoreRedis('./backups/redis/backup.rdb');
```

---

## Event Sourcing & Audit Trail

### Overview

The event sourcing system provides comprehensive audit trail functionality with immutable event logging, event replay, snapshots, and temporal queries for tracking all DID and credential operations.

### Features

- **Immutable event storage** with cryptographic integrity
- **Event replay and state reconstruction**
- **Automatic snapshot generation**
- **Temporal queries and point-in-time analysis**
- **Event compression and archiving**
- **Real-time event streaming**
- **Comprehensive audit capabilities**

### Usage Examples

#### Event Storage

```javascript
const eventSourcing = require('./src/events/EventSourcing');

// Store DID creation event
const didEvent = await eventSourcing.storeEvent({
    aggregateId: 'did-stellar-123',
    aggregateType: 'DID',
    eventType: 'DID_CREATED',
    version: 1,
    data: {
        did: 'did:stellar:123',
        owner: '0x1234567890123456789012345678901234567890',
        publicKey: 'public-key-hex',
        serviceEndpoints: ['endpoint1', 'endpoint2']
    },
    metadata: {
        actor: 'user-123',
        source: 'web-interface'
    }
});

console.log(`Event stored: ${didEvent.eventId}`);
```

#### Event Replay and State Reconstruction

```javascript
// Replay events to reconstruct current state
const currentState = await eventSourcing.replayEvents('did-stellar-123', 'DID');
console.log('Current DID state:', currentState);

// Replay to specific version
const historicalState = await eventSourcing.replayEvents('did-stellar-123', 'DID', 5);
console.log('State at version 5:', historicalState);
```

#### Temporal Queries

```javascript
// Get state at specific timestamp
const stateAtTime = await eventSourcing.getStateAtTimestamp(
    'did-stellar-123', 
    'DID', 
    '2023-12-01T10:30:00.000Z'
);

// Get events for time range
const events = await eventSourcing.getEvents('did-stellar-123', 'DID', {
    fromDate: '2023-12-01T00:00:00.000Z',
    toDate: '2023-12-01T23:59:59.000Z'
});
```

#### Audit Trail

```javascript
// Get comprehensive audit trail for entity
const auditTrail = await eventSourcing.getAuditTrail('user-123', {
    fromDate: '2023-12-01T00:00:00.000Z',
    eventTypes: ['DID_CREATED', 'CREDENTIAL_ISSUED']
});

console.log(`Audit trail: ${auditTrail.length} events`);
auditTrail.forEach(event => {
    console.log(`${event.timestamp}: ${event.eventType} by ${event.metadata.actor}`);
});
```

#### Event Search

```javascript
// Search events by text
const searchResults = await eventSourcing.searchEvents('DID_CREATED', {
    limit: 50,
    eventTypes: ['DID_CREATED', 'DID_UPDATED']
});

// Get event statistics
const stats = await eventSourcing.getEventStatistics();
console.log(`Total events: ${stats.totalEvents}`);
console.log(`Event types:`, stats.eventTypes);
```

#### Event Integrity Verification

```javascript
// Verify event integrity
const isValid = await eventSourcing.verifyEventIntegrity('event-id');
console.log(`Event integrity: ${isValid ? 'Valid' : 'Compromised'}`);
```

### Event Types

#### DID Events
- `DID_CREATED` - New DID created
- `DID_UPDATED` - DID information updated
- `DID_TRANSFERRED` - DID ownership transferred
- `DID_DELETED` - DID deleted
- `DID_SUSPENDED` - DID temporarily suspended
- `DID_REACTIVATED` - DID reactivated after suspension

#### Credential Events
- `CREDENTIAL_ISSUED` - New credential issued
- `CREDENTIAL_REVOKED` - Credential revoked
- `CREDENTIAL_UPDATED` - Credential information updated
- `CREDENTIAL_SUSPENDED` - Credential temporarily suspended
- `CREDENTIAL_REACTIVATED` - Credential reactivated

#### Governance Events
- `GOVERNANCE_PROPOSAL_CREATED` - New governance proposal
- `GOVERNANCE_PROPOSAL_VOTED` - Vote cast on proposal
- `GOVERNANCE_PROPOSAL_EXECUTED` - Proposal executed

#### Recovery Events
- `RECOVERY_INITIATED` - Recovery process started
- `RECOVERY_EXECUTED` - Recovery completed
- `RECOVERY_CANCELLED` - Recovery cancelled

#### Access Events
- `ACCESS_GRANTED` - Access permissions granted
- `ACCESS_REVOKED` - Access permissions revoked
- `ROLE_ASSIGNED` - Role assigned to user
- `ROLE_REMOVED` - Role removed from user

#### System Events
- `PROXY_UPGRADED` - Contract proxy upgraded
- `SYSTEM_MAINTENANCE` - System maintenance performed
- `SECURITY_BREACH` - Security breach detected
- `DATA_MIGRATION` - Data migration performed
- `BACKUP_CREATED` - Backup created
- `BACKUP_RESTORED` - Backup restored

### Configuration

#### Environment Variables

```bash
# Event Sourcing Configuration
EVENT_SOURCING_ENABLED=true
EVENT_STORE_DB=events
EVENT_SNAPSHOT_INTERVAL=1000
EVENT_RETENTION_DAYS=365
EVENT_COMPRESSION=true
```

### Event Structure

```javascript
{
    "eventId": "uuid-v4",
    "aggregateId": "entity-identifier",
    "aggregateType": "DID|CREDENTIAL|GOVERNANCE|SYSTEM",
    "eventType": "EVENT_TYPE",
    "version": 1,
    "timestamp": "2023-12-01T10:30:00.000Z",
    "data": {
        // Event-specific data
    },
    "metadata": {
        "actor": "user-or-system-id",
        "source": "component-name",
        "version": "1.0.0"
    },
    "hash": "sha256-hash",
    "storedAt": "2023-12-01T10:30:01.000Z",
    "compressed": true
}
```

---

## Integration Examples

### Complete DID Creation with All Features

```javascript
const config = require('./src/config/CentralizedConfig');
const gasEstimation = require('./contracts/utils/GasEstimation');
const backup = require('./src/backup/DatabaseBackup');
const eventSourcing = require('./src/events/EventSourcing');

async function createDIDWithFullTracking(owner, publicKey, serviceEndpoints) {
    try {
        // 1. Estimate gas costs
        const gasEstimate = await gasEstimation.estimateDIDCreation(owner, publicKey, serviceEndpoints);
        console.log(`Estimated gas cost: ${gasEstimate.totalGas} gas`);
        
        // 2. Store creation event
        const event = await eventSourcing.storeEvent({
            aggregateId: `did-${Date.now()}`,
            aggregateType: 'DID',
            eventType: 'DID_CREATED',
            version: 1,
            data: { owner, publicKey, serviceEndpoints },
            metadata: { actor: owner, source: 'api' }
        });
        
        // 3. Execute DID creation (mock blockchain transaction)
        const did = await createDIDOnBlockchain(owner, publicKey, serviceEndpoints);
        
        // 4. Record actual gas usage
        await gasEstimation.recordGasUsage('DID_CREATE', actualGasUsed);
        
        // 5. Create backup after important operation
        await backup.performIncrementalBackup();
        
        // 6. Return complete result
        return {
            did,
            eventId: event.eventId,
            gasUsed: actualGasUsed,
            gasEstimate: gasEstimate.totalGas,
            timestamp: event.timestamp
        };
        
    } catch (error) {
        // Store error event
        await eventSourcing.storeEvent({
            aggregateId: `error-${Date.now()}`,
            aggregateType: 'SYSTEM',
            eventType: 'SYSTEM_ERROR',
            version: 1,
            data: { error: error.message, operation: 'DID_CREATION' },
            metadata: { actor: 'system', source: 'api' }
        });
        
        throw error;
    }
}
```

### Configuration-Driven System Startup

```javascript
const config = require('./src/config/CentralizedConfig');
const backup = require('./src/backup/DatabaseBackup');
const eventSourcing = require('./src/events/EventSourcing');

async function initializeSystem() {
    // Load and validate configuration
    console.log(`Initializing system for ${config.getEnvironment()} environment`);
    
    // Initialize event sourcing
    if (config.get('events.EVENT_SOURCING_ENABLED')) {
        console.log('Event sourcing enabled');
        // Event sourcing auto-initializes
    }
    
    // Initialize backup system
    if (config.get('backup.BACKUP_ENABLED')) {
        console.log('Backup system enabled');
        // Backup system auto-initializes and schedules jobs
    }
    
    // Log system startup
    await eventSourcing.storeEvent({
        aggregateId: 'system',
        aggregateType: 'SYSTEM',
        eventType: 'SYSTEM_STARTED',
        version: 1,
        data: {
            environment: config.getEnvironment(),
            features: {
                eventSourcing: config.get('events.EVENT_SOURCING_ENABLED'),
                backup: config.get('backup.BACKUP_ENABLED')
            }
        },
        metadata: { actor: 'system', source: 'startup' }
    });
    
    console.log('System initialization completed');
}
```

---

## Testing

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=GasEstimation
npm test -- --testPathPattern=CentralizedConfig
npm test -- --testPathPattern=DatabaseBackup
npm test -- --testPathPattern=EventSourcing

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Test Structure

```
src/__tests__/
├── GasEstimation.test.js          # Gas estimation tests
├── CentralizedConfig.test.js      # Configuration management tests
├── DatabaseBackup.test.js         # Backup and recovery tests
├── EventSourcing.test.js          # Event sourcing and audit tests
└── integration/                    # Integration tests
    ├── full-workflow.test.js
    └── error-handling.test.js
```

### Test Coverage

The test suites provide comprehensive coverage for:

- **Gas Estimation**: All operation types, batch operations, historical tracking
- **Configuration**: Validation, encryption, environment overrides, security
- **Backup**: Full/incremental backups, restoration, point-in-time recovery
- **Event Sourcing**: Event storage, replay, snapshots, audit trails, integrity

### Mock Data and Fixtures

Test fixtures are provided for:
- Sample DID documents
- Credential data
- Governance proposals
- Backup configurations
- Event streams

---

## Deployment

### Environment Setup

#### Production Environment Variables

```bash
# Core Configuration
NODE_ENV=production
CONFIG_ENCRYPTION_KEY=your-production-encryption-key-32-chars

# Stellar Network
STELLAR_NETWORK=PUBLIC
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_PASSPHRASE=Public Global Stellar Network ; September 2015

# Database
MONGODB_URL=mongodb://prod-mongo-cluster:27017/stellar-did-prod
REDIS_URL=redis://prod-redis-cluster:6379

# Security
JWT_SECRET=your-production-jwt-secret-32-chars-minimum
CORS_ORIGIN=https://your-domain.com

# Backup
BACKUP_ENABLED=true
BACKUP_STORAGE_PATH=/secure/backups
BACKUP_ENCRYPTION_KEY=your-backup-encryption-key
BACKUP_SCHEDULE=cron:0 2 * * *

# Event Sourcing
EVENT_SOURCING_ENABLED=true
EVENT_STORE_DB=events_prod
EVENT_RETENTION_DAYS=2555  # 7 years
```

#### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - CONFIG_ENCRYPTION_KEY=${CONFIG_ENCRYPTION_KEY}
      - MONGODB_URL=${MONGODB_URL}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./backups:/app/backups
    depends_on:
      - mongodb
      - redis

  mongodb:
    image: mongo:6.0
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

### Monitoring and Logging

#### Health Checks

```javascript
// health-check.js
const config = require('./src/config/CentralizedConfig');
const backup = require('./src/backup/DatabaseBackup');
const eventSourcing = require('./src/events/EventSourcing');

async function healthCheck() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {}
    };

    try {
        // Check configuration
        health.services.config = 'healthy';
        
        // Check event sourcing
        if (eventSourcing.isInitialized) {
            health.services.eventSourcing = 'healthy';
        } else {
            health.services.eventSourcing = 'unhealthy';
            health.status = 'degraded';
        }
        
        // Check backup system
        if (backup.isInitialized) {
            health.services.backup = 'healthy';
        } else {
            health.services.backup = 'unhealthy';
            health.status = 'degraded';
        }
        
    } catch (error) {
        health.status = 'unhealthy';
        health.error = error.message;
    }

    return health;
}

module.exports = healthCheck;
```

#### Metrics Collection

```javascript
// metrics.js
const eventSourcing = require('./src/events/EventSourcing');
const backup = require('./src/backup/DatabaseBackup');

async function collectMetrics() {
    const metrics = {
        timestamp: new Date().toISOString(),
        eventSourcing: eventSourcing.metrics,
        backup: await backup.getBackupStatistics()
    };

    return metrics;
}

// Schedule metrics collection
setInterval(async () => {
    const metrics = await collectMetrics();
    // Send to monitoring system
    await sendToMonitoring(metrics);
}, 60000); // Every minute
```

### Security Considerations

#### Encryption Keys Management

1. **Use environment-specific keys** for production, staging, and development
2. **Rotate encryption keys** regularly and implement key versioning
3. **Store keys securely** using secret management services (AWS Secrets Manager, etc.)
4. **Backup encryption keys** securely in separate location

#### Access Control

1. **Implement principle of least privilege** for database access
2. **Use role-based access control** for backup and event operations
3. **Audit all administrative actions** using event sourcing
4. **Encrypt data at rest and in transit**

#### Backup Security

1. **Encrypt all backups** using strong encryption
2. **Store backups in secure, separate location**
3. **Implement backup access logging** and monitoring
4. **Test backup restoration regularly** in isolated environment

---

## Troubleshooting

### Common Issues

#### Gas Estimation Problems

**Issue**: Inaccurate gas estimates
**Solution**: 
- Record actual gas usage after transactions
- Wait for sufficient historical data
- Check network gas price volatility

#### Configuration Issues

**Issue**: Configuration validation failures
**Solution**:
- Check environment variable formats
- Verify required fields are present
- Review schema validation errors

#### Backup Failures

**Issue**: Backup creation failures
**Solution**:
- Check database connectivity
- Verify backup directory permissions
- Ensure sufficient disk space
- Review encryption key configuration

#### Event Sourcing Issues

**Issue**: Event replay inconsistencies
**Solution**:
- Verify event integrity hashes
- Check snapshot consistency
- Review event ordering
- Validate event application logic

### Debug Mode

Enable debug logging:

```bash
DEBUG=did:* npm start
```

### Log Analysis

Monitor key log patterns:
- Gas estimation accuracy
- Configuration validation errors
- Backup success/failure rates
- Event sourcing performance

---

## Performance Optimization

### Gas Estimation Optimization

1. **Cache historical estimates** for frequently used operations
2. **Batch gas estimation** for multiple operations
3. **Pre-compute common scenarios** during system startup
4. **Use network-specific gas price averages**

### Configuration Optimization

1. **Lazy load configuration sections** when needed
2. **Cache validated configuration** in memory
3. **Minimize encryption/decryption operations**
4. **Use configuration snapshots** for frequent access

### Backup Optimization

1. **Use incremental backups** to reduce storage requirements
2. **Compress backups** to save space
3. **Parallel backup operations** for large datasets
4. **Schedule backups during low-traffic periods**

### Event Sourcing Optimization

1. **Use snapshots** for efficient event replay
2. **Compress old events** to reduce storage
3. **Archive events** based on retention policies
4. **Index events** for efficient querying

---

## Contributing

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/Decentralized-Identity-DID-.git
cd Decentralized-Identity-DID-

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

### Code Style

- Use ESLint configuration
- Follow TypeScript/JavaScript best practices
- Write comprehensive tests
- Document all public APIs

### Pull Request Process

1. Create feature branch from main
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation
5. Submit pull request with detailed description

---

## License

This implementation is licensed under the MIT License. See LICENSE file for details.

---

## Support

For questions, issues, or contributions:

1. **Documentation**: Check this guide and inline code comments
2. **Issues**: Create GitHub issue with detailed description
3. **Discussions**: Use GitHub Discussions for questions
4. **Security**: Report security issues privately

---

*Last updated: December 2023*
