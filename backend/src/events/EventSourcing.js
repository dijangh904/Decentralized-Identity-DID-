/**
 * @title EventSourcing
 * @dev Event sourcing system for comprehensive audit trail with immutable event log
 * 
 * This module provides event sourcing functionality to track all DID and credential
 * operations with an immutable event log. It supports event replay, snapshots,
 * temporal queries, and comprehensive audit capabilities.
 * 
 * Features:
 * - Immutable event storage with cryptographic integrity
 * - Event replay and state reconstruction
 * - Automatic snapshot generation
 * - Temporal queries and point-in-time analysis
 * - Event compression and archiving
 * - Multi-tenant event isolation
 * - Real-time event streaming
 * - Performance metrics and monitoring
 * 
 * @author Fatima Sanusi
 * @notice Use this module for comprehensive audit trail functionality
 */

const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const EventEmitter = require('events');
const config = require('../config/CentralizedConfig');

class EventSourcing extends EventEmitter {
    constructor() {
        super();
        this.eventConfig = config.get('events', {});
        this.mongoClient = null;
        this.eventStore = null;
        this.snapshotStore = null;
        this.isInitialized = false;
        
        // Event store configuration
        this.eventStoreDb = this.eventConfig.EVENT_STORE_DB || 'events';
        this.snapshotInterval = this.eventConfig.EVENT_SNAPSHOT_INTERVAL || 1000;
        this.retentionDays = this.eventConfig.EVENT_RETENTION_DAYS || 365;
        this.compressionEnabled = this.eventConfig.EVENT_COMPRESSION !== false;
        
        // Event types
        this.eventTypes = new Set([
            'DID_CREATED',
            'DID_UPDATED',
            'DID_TRANSFERRED',
            'DID_DELETED',
            'DID_SUSPENDED',
            'DID_REACTIVATED',
            'CREDENTIAL_ISSUED',
            'CREDENTIAL_REVOKED',
            'CREDENTIAL_UPDATED',
            'CREDENTIAL_SUSPENDED',
            'CREDENTIAL_REACTIVATED',
            'GOVERNANCE_PROPOSAL_CREATED',
            'GOVERNANCE_PROPOSAL_VOTED',
            'GOVERNANCE_PROPOSAL_EXECUTED',
            'RECOVERY_INITIATED',
            'RECOVERY_EXECUTED',
            'RECOVERY_CANCELLED',
            'ACCESS_GRANTED',
            'ACCESS_REVOKED',
            'ROLE_ASSIGNED',
            'ROLE_REMOVED',
            'PROXY_UPGRADED',
            'SYSTEM_MAINTENANCE',
            'SECURITY_BREACH',
            'DATA_MIGRATION',
            'BACKUP_CREATED',
            'BACKUP_RESTORED'
        ]);
        
        // Event validation schemas
        this.eventSchemas = this.initializeEventSchemas();
        
        // Performance metrics
        this.metrics = {
            eventsStored: 0,
            eventsReplayed: 0,
            snapshotsCreated: 0,
            averageEventSize: 0,
            totalEventSize: 0,
            replayLatency: 0,
            storageLatency: 0
        };
        
        this.initialize();
    }

    /**
     * Initializes the event sourcing system
     */
    async initialize() {
        try {
            // Initialize MongoDB connection
            await this.initializeDatabaseConnection();
            
            // Create indexes for optimal performance
            await this.createIndexes();
            
            // Start event compression and archiving
            await this.startEventArchiving();
            
            this.isInitialized = true;
            console.log('Event sourcing system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize event sourcing system:', error.message);
            throw error;
        }
    }

    /**
     * Initializes database connection
     */
    async initializeDatabaseConnection() {
        const mongoUrl = config.get('database.MONGODB_URL');
        this.mongoClient = new MongoClient(mongoUrl);
        await this.mongoClient.connect();
        
        // Event store collection
        this.eventStore = this.mongoClient.db(this.eventStoreDb).collection('events');
        
        // Snapshot store collection
        this.snapshotStore = this.mongoClient.db(this.eventStoreDb).collection('snapshots');
        
        console.log('Event store database connection established');
    }

    /**
     * Creates database indexes for optimal performance
     */
    async createIndexes() {
        // Event store indexes
        await this.eventStore.createIndex({ aggregateId: 1, version: 1 }, { unique: true });
        await this.eventStore.createIndex({ eventType: 1, timestamp: 1 });
        await this.eventStore.createIndex({ timestamp: 1 });
        await this.eventStore.createIndex({ aggregateType: 1, aggregateId: 1 });
        await this.eventStore.createIndex({ 'metadata.actor': 1, timestamp: 1 });
        await this.eventStore.createIndex({ hash: 1 }, { sparse: true });
        
        // Snapshot store indexes
        await this.snapshotStore.createIndex({ aggregateId: 1, version: 1 }, { unique: true });
        await this.snapshotStore.createIndex({ aggregateType: 1, timestamp: 1 });
        await this.snapshotStore.createIndex({ timestamp: 1 });
        
        console.log('Event store indexes created successfully');
    }

    /**
     * Initializes event validation schemas
     */
    initializeEventSchemas() {
        return {
            DID_CREATED: {
                required: ['aggregateId', 'aggregateType', 'eventType', 'version', 'timestamp', 'data'],
                properties: {
                    data: {
                        type: 'object',
                        required: ['did', 'owner', 'publicKey', 'serviceEndpoints']
                    }
                }
            },
            DID_UPDATED: {
                required: ['aggregateId', 'aggregateType', 'eventType', 'version', 'timestamp', 'data'],
                properties: {
                    data: {
                        type: 'object',
                        required: ['did', 'changes']
                    }
                }
            },
            CREDENTIAL_ISSUED: {
                required: ['aggregateId', 'aggregateType', 'eventType', 'version', 'timestamp', 'data'],
                properties: {
                    data: {
                        type: 'object',
                        required: ['credentialId', 'issuer', 'subject', 'type', 'claims']
                    }
                }
            },
            GOVERNANCE_PROPOSAL_CREATED: {
                required: ['aggregateId', 'aggregateType', 'eventType', 'version', 'timestamp', 'data'],
                properties: {
                    data: {
                        type: 'object',
                        required: ['proposalId', 'proposer', 'description', 'actions']
                    }
                }
            }
        };
    }

    /**
     * Stores an event in the event store
     * @param {object} event Event to store
     * @returns {object} Stored event
     */
    async storeEvent(event) {
        if (!this.isInitialized) {
            throw new Error('Event sourcing system not initialized');
        }

        try {
            // Validate event structure
            this.validateEvent(event);
            
            // Add system fields
            const enrichedEvent = this.enrichEvent(event);
            
            // Calculate event hash for integrity
            enrichedEvent.hash = this.calculateEventHash(enrichedEvent);
            
            // Compress event data if enabled
            if (this.compressionEnabled) {
                enrichedEvent.data = await this.compressData(enrichedEvent.data);
                enrichedEvent.compressed = true;
            }
            
            const startTime = Date.now();
            
            // Store event
            await this.eventStore.insertOne(enrichedEvent);
            
            // Update metrics
            this.metrics.eventsStored++;
            this.metrics.totalEventSize += JSON.stringify(enrichedEvent).length;
            this.metrics.averageEventSize = this.metrics.totalEventSize / this.metrics.eventsStored;
            this.metrics.storageLatency = Date.now() - startTime;
            
            // Check if snapshot should be created
            await this.checkSnapshotCreation(enrichedEvent);
            
            // Emit event for real-time listeners
            this.emit('eventStored', enrichedEvent);
            
            console.log(`Event stored: ${enrichedEvent.eventType} for ${enrichedEvent.aggregateId}`);
            
            return enrichedEvent;
            
        } catch (error) {
            console.error('Failed to store event:', error.message);
            throw error;
        }
    }

    /**
     * Validates event structure
     * @param {object} event Event to validate
     */
    validateEvent(event) {
        if (!event.eventType || !this.eventTypes.has(event.eventType)) {
            throw new Error(`Invalid or unsupported event type: ${event.eventType}`);
        }
        
        if (!event.aggregateId || !event.aggregateType) {
            throw new Error('Event must have aggregateId and aggregateType');
        }
        
        if (!event.version || typeof event.version !== 'number') {
            throw new Error('Event must have a valid version number');
        }
        
        if (!event.timestamp) {
            throw new Error('Event must have a timestamp');
        }
        
        if (!event.data || typeof event.data !== 'object') {
            throw new Error('Event must have valid data object');
        }
        
        // Validate against event schema if available
        const schema = this.eventSchemas[event.eventType];
        if (schema) {
            this.validateAgainstSchema(event, schema);
        }
    }

    /**
     * Validates event against schema
     * @param {object} event Event to validate
     * @param {object} schema Validation schema
     */
    validateAgainstSchema(event, schema) {
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in event)) {
                    throw new Error(`Required field missing: ${field}`);
                }
            }
        }
        
        if (schema.properties) {
            for (const [field, rules] of Object.entries(schema.properties)) {
                if (event[field] !== undefined) {
                    if (rules.type && typeof event[field] !== rules.type) {
                        throw new Error(`Invalid type for field ${field}: expected ${rules.type}`);
                    }
                    
                    if (rules.required && Array.isArray(rules.required)) {
                        for (const subField of rules.required) {
                            if (!(subField in event[field])) {
                                throw new Error(`Required subfield missing in ${field}: ${subField}`);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Enriches event with system fields
     * @param {object} event Event to enrich
     * @returns {object} Enriched event
     */
    enrichEvent(event) {
        return {
            ...event,
            eventId: crypto.randomUUID(),
            timestamp: event.timestamp || new Date().toISOString(),
            storedAt: new Date().toISOString(),
            metadata: {
                ...event.metadata,
                source: 'event-sourcing',
                version: '1.0.0'
            }
        };
    }

    /**
     * Calculates event hash for integrity verification
     * @param {object} event Event to hash
     * @returns {string} Event hash
     */
    calculateEventHash(event) {
        const eventCopy = { ...event };
        delete eventCopy.hash; // Remove hash field if present
        
        const eventString = JSON.stringify(eventCopy, Object.keys(eventCopy).sort());
        return crypto.createHash('sha256').update(eventString).digest('hex');
    }

    /**
     * Compresses data using gzip
     * @param {object} data Data to compress
     * @returns {string} Compressed data (base64)
     */
    async compressData(data) {
        const jsonString = JSON.stringify(data);
        const compressed = require('zlib').gzipSync(jsonString);
        return compressed.toString('base64');
    }

    /**
     * Decompresses data
     * @param {string} compressedData Compressed data (base64)
     * @returns {object} Decompressed data
     */
    async decompressData(compressedData) {
        const compressed = Buffer.from(compressedData, 'base64');
        const decompressed = require('zlib').gunzipSync(compressed);
        return JSON.parse(decompressed.toString());
    }

    /**
     * Checks if snapshot should be created
     * @param {object} event Event to check
     */
    async checkSnapshotCreation(event) {
        if (event.version % this.snapshotInterval === 0) {
            await this.createSnapshot(event.aggregateId, event.aggregateType);
        }
    }

    /**
     * Creates a snapshot for an aggregate
     * @param {string} aggregateId Aggregate ID
     * @param {string} aggregateType Aggregate type
     */
    async createSnapshot(aggregateId, aggregateType) {
        try {
            // Get current state by replaying events
            const currentState = await this.replayEvents(aggregateId, aggregateType);
            
            // Get latest event version
            const latestEvent = await this.eventStore.findOne(
                { aggregateId, aggregateType },
                { sort: { version: -1 } }
            );
            
            const snapshot = {
                aggregateId,
                aggregateType,
                version: latestEvent ? latestEvent.version : 0,
                state: currentState,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
            
            // Compress snapshot state if enabled
            if (this.compressionEnabled) {
                snapshot.state = await this.compressData(snapshot.state);
                snapshot.compressed = true;
            }
            
            // Store snapshot (upsert)
            await this.snapshotStore.replaceOne(
                { aggregateId, aggregateType },
                snapshot,
                { upsert: true }
            );
            
            this.metrics.snapshotsCreated++;
            
            console.log(`Snapshot created: ${aggregateId} at version ${snapshot.version}`);
            
        } catch (error) {
            console.error(`Failed to create snapshot for ${aggregateId}:`, error.message);
        }
    }

    /**
     * Replays events to reconstruct aggregate state
     * @param {string} aggregateId Aggregate ID
     * @param {string} aggregateType Aggregate type
     * @param {number} targetVersion Target version (optional)
     * @returns {object} Reconstructed state
     */
    async replayEvents(aggregateId, aggregateType, targetVersion = null) {
        const startTime = Date.now();
        
        try {
            // Find latest snapshot
            const snapshot = await this.findLatestSnapshot(aggregateId, aggregateType, targetVersion);
            
            let currentState = snapshot ? snapshot.state : {};
            let fromVersion = snapshot ? snapshot.version : 0;
            
            // Get events to replay
            const query = {
                aggregateId,
                aggregateType,
                version: { $gt: fromVersion }
            };
            
            if (targetVersion) {
                query.version.$lte = targetVersion;
            }
            
            const events = await this.eventStore
                .find(query)
                .sort({ version: 1 })
                .toArray();
            
            // Replay events
            for (const event of events) {
                currentState = await this.applyEvent(currentState, event);
            }
            
            this.metrics.eventsReplayed += events.length;
            this.metrics.replayLatency = Date.now() - startTime;
            
            console.log(`Replayed ${events.length} events for ${aggregateId}`);
            
            return currentState;
            
        } catch (error) {
            console.error(`Failed to replay events for ${aggregateId}:`, error.message);
            throw error;
        }
    }

    /**
     * Finds latest snapshot for aggregate
     * @param {string} aggregateId Aggregate ID
     * @param {string} aggregateType Aggregate type
     * @param {number} targetVersion Target version (optional)
     * @returns {object|null} Latest snapshot
     */
    async findLatestSnapshot(aggregateId, aggregateType, targetVersion = null) {
        const query = { aggregateId, aggregateType };
        
        if (targetVersion) {
            query.version = { $lte: targetVersion };
        }
        
        const snapshot = await this.snapshotStore.findOne(
            query,
            { sort: { version: -1 } }
        );
        
        if (snapshot && snapshot.compressed) {
            snapshot.state = await this.decompressData(snapshot.state);
        }
        
        return snapshot;
    }

    /**
     * Applies event to current state
     * @param {object} currentState Current state
     * @param {object} event Event to apply
     * @returns {object} New state
     */
    async applyEvent(currentState, event) {
        let eventData = event.data;
        
        // Decompress event data if needed
        if (event.compressed) {
            eventData = await this.decompressData(eventData);
        }
        
        // Apply event based on type
        switch (event.eventType) {
            case 'DID_CREATED':
                return this.applyDIDCreated(currentState, eventData);
            case 'DID_UPDATED':
                return this.applyDIDUpdated(currentState, eventData);
            case 'DID_TRANSFERRED':
                return this.applyDIDTransferred(currentState, eventData);
            case 'DID_DELETED':
                return this.applyDIDDeleted(currentState, eventData);
            case 'CREDENTIAL_ISSUED':
                return this.applyCredentialIssued(currentState, eventData);
            case 'CREDENTIAL_REVOKED':
                return this.applyCredentialRevoked(currentState, eventData);
            case 'CREDENTIAL_UPDATED':
                return this.applyCredentialUpdated(currentState, eventData);
            case 'GOVERNANCE_PROPOSAL_CREATED':
                return this.applyGovernanceProposalCreated(currentState, eventData);
            case 'GOVERNANCE_PROPOSAL_VOTED':
                return this.applyGovernanceProposalVoted(currentState, eventData);
            case 'RECOVERY_INITIATED':
                return this.applyRecoveryInitiated(currentState, eventData);
            case 'RECOVERY_EXECUTED':
                return this.applyRecoveryExecuted(currentState, eventData);
            default:
                // For unknown event types, just add to state
                return {
                    ...currentState,
                    [event.eventType.toLowerCase()]: eventData
                };
        }
    }

    // Event application methods
    applyDIDCreated(currentState, eventData) {
        return {
            ...currentState,
            did: eventData.did,
            owner: eventData.owner,
            publicKey: eventData.publicKey,
            serviceEndpoints: eventData.serviceEndpoints,
            active: true,
            createdAt: eventData.createdAt || new Date().toISOString(),
            updatedAt: eventData.createdAt || new Date().toISOString()
        };
    }

    applyDIDUpdated(currentState, eventData) {
        return {
            ...currentState,
            ...eventData.changes,
            updatedAt: new Date().toISOString()
        };
    }

    applyDIDTransferred(currentState, eventData) {
        return {
            ...currentState,
            owner: eventData.newOwner,
            transferredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    applyDIDDeleted(currentState, eventData) {
        return {
            ...currentState,
            active: false,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    applyCredentialIssued(currentState, eventData) {
        const credentials = currentState.credentials || [];
        return {
            ...currentState,
            credentials: [
                ...credentials,
                {
                    id: eventData.credentialId,
                    issuer: eventData.issuer,
                    subject: eventData.subject,
                    type: eventData.type,
                    claims: eventData.claims,
                    issuedAt: new Date().toISOString(),
                    status: 'active'
                }
            ],
            updatedAt: new Date().toISOString()
        };
    }

    applyCredentialRevoked(currentState, eventData) {
        const credentials = currentState.credentials || [];
        const updatedCredentials = credentials.map(cred => 
            cred.id === eventData.credentialId 
                ? { ...cred, status: 'revoked', revokedAt: new Date().toISOString() }
                : cred
        );
        
        return {
            ...currentState,
            credentials: updatedCredentials,
            updatedAt: new Date().toISOString()
        };
    }

    applyCredentialUpdated(currentState, eventData) {
        const credentials = currentState.credentials || [];
        const updatedCredentials = credentials.map(cred => 
            cred.id === eventData.credentialId 
                ? { ...cred, ...eventData.changes, updatedAt: new Date().toISOString() }
                : cred
        );
        
        return {
            ...currentState,
            credentials: updatedCredentials,
            updatedAt: new Date().toISOString()
        };
    }

    applyGovernanceProposalCreated(currentState, eventData) {
        const proposals = currentState.proposals || [];
        return {
            ...currentState,
            proposals: [
                ...proposals,
                {
                    id: eventData.proposalId,
                    proposer: eventData.proposer,
                    description: eventData.description,
                    actions: eventData.actions,
                    status: 'proposed',
                    createdAt: new Date().toISOString()
                }
            ],
            updatedAt: new Date().toISOString()
        };
    }

    applyGovernanceProposalVoted(currentState, eventData) {
        const proposals = currentState.proposals || [];
        const updatedProposals = proposals.map(proposal => 
            proposal.id === eventData.proposalId 
                ? {
                    ...proposal,
                    votes: [...(proposal.votes || []), eventData.vote],
                    updatedAt: new Date().toISOString()
                }
                : proposal
        );
        
        return {
            ...currentState,
            proposals: updatedProposals,
            updatedAt: new Date().toISOString()
        };
    }

    applyRecoveryInitiated(currentState, eventData) {
        return {
            ...currentState,
            recovery: {
                initiated: true,
                initiatedAt: new Date().toISOString(),
                initiator: eventData.initiator,
                reason: eventData.reason,
                status: 'pending'
            },
            updatedAt: new Date().toISOString()
        };
    }

    applyRecoveryExecuted(currentState, eventData) {
        return {
            ...currentState,
            recovery: {
                ...currentState.recovery,
                executed: true,
                executedAt: new Date().toISOString(),
                executor: eventData.executor,
                status: 'completed'
            },
            ...eventData.changes,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Gets events for an aggregate
     * @param {string} aggregateId Aggregate ID
     * @param {string} aggregateType Aggregate type
     * @param {object} options Query options
     * @returns {array} Events
     */
    async getEvents(aggregateId, aggregateType, options = {}) {
        const query = { aggregateId, aggregateType };
        
        if (options.fromVersion) {
            query.version = { $gte: options.fromVersion };
        }
        
        if (options.toVersion) {
            query.version = query.version || {};
            query.version.$lte = options.toVersion;
        }
        
        if (options.eventTypes) {
            query.eventType = { $in: options.eventTypes };
        }
        
        if (options.fromDate || options.toDate) {
            query.timestamp = {};
            if (options.fromDate) {
                query.timestamp.$gte = options.fromDate;
            }
            if (options.toDate) {
                query.timestamp.$lte = options.toDate;
            }
        }
        
        const events = await this.eventStore
            .find(query)
            .sort({ version: options.sort || 'asc' })
            .limit(options.limit || 1000)
            .toArray();
        
        // Decompress event data if needed
        for (const event of events) {
            if (event.compressed) {
                event.data = await this.decompressData(event.data);
            }
        }
        
        return events;
    }

    /**
     * Gets aggregate state at specific point in time
     * @param {string} aggregateId Aggregate ID
     * @param {string} aggregateType Aggregate type
     * @param {string} timestamp Point in time
     * @returns {object} State at timestamp
     */
    async getStateAtTimestamp(aggregateId, aggregateType, timestamp) {
        // Find events before timestamp
        const events = await this.eventStore
            .find({
                aggregateId,
                aggregateType,
                timestamp: { $lte: timestamp }
            })
            .sort({ version: 1 })
            .toArray();
        
        // Replay events
        let state = {};
        for (const event of events) {
            state = await this.applyEvent(state, event);
        }
        
        return state;
    }

    /**
     * Gets audit trail for an entity
     * @param {string} entityId Entity ID
     * @param {object} options Query options
     * @returns {array} Audit trail
     */
    async getAuditTrail(entityId, options = {}) {
        const query = {
            $or: [
                { aggregateId: entityId },
                { 'metadata.actor': entityId },
                { 'data.did': entityId },
                { 'data.credentialId': entityId },
                { 'data.subject': entityId },
                { 'data.issuer': entityId }
            ]
        };
        
        if (options.fromDate) {
            query.timestamp = query.timestamp || {};
            query.timestamp.$gte = options.fromDate;
        }
        
        if (options.toDate) {
            query.timestamp = query.timestamp || {};
            query.timestamp.$lte = options.toDate;
        }
        
        if (options.eventTypes) {
            query.eventType = { $in: options.eventTypes };
        }
        
        const events = await this.eventStore
            .find(query)
            .sort({ timestamp: -1 })
            .limit(options.limit || 1000)
            .toArray();
        
        // Decompress event data if needed
        for (const event of events) {
            if (event.compressed) {
                event.data = await this.decompressData(event.data);
            }
        }
        
        return events;
    }

    /**
     * Verifies event integrity
     * @param {string} eventId Event ID
     * @returns {boolean} Integrity verification result
     */
    async verifyEventIntegrity(eventId) {
        try {
            const event = await this.eventStore.findOne({ eventId });
            
            if (!event) {
                throw new Error('Event not found');
            }
            
            // Recalculate hash
            const eventCopy = { ...event };
            delete eventCopy.hash;
            
            const eventString = JSON.stringify(eventCopy, Object.keys(eventCopy).sort());
            const calculatedHash = crypto.createHash('sha256').update(eventString).digest('hex');
            
            return calculatedHash === event.hash;
            
        } catch (error) {
            console.error(`Failed to verify event integrity for ${eventId}:`, error.message);
            return false;
        }
    }

    /**
     * Gets event statistics
     * @returns {object} Event statistics
     */
    async getEventStatistics() {
        const pipeline = [
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 },
                    lastEvent: { $max: '$timestamp' }
                }
            },
            { $sort: { count: -1 } }
        ];
        
        const eventTypeStats = await this.eventStore.aggregate(pipeline).toArray();
        
        const totalEvents = await this.eventStore.countDocuments();
        const oldestEvent = await this.eventStore.findOne({}, { sort: { timestamp: 1 } });
        const newestEvent = await this.eventStore.findOne({}, { sort: { timestamp: -1 } });
        
        return {
            totalEvents,
            eventTypes: eventTypeStats,
            oldestEvent: oldestEvent ? oldestEvent.timestamp : null,
            newestEvent: newestEvent ? newestEvent.timestamp : null,
            metrics: this.metrics
        };
    }

    /**
     * Starts event archiving process
     */
    async startEventArchiving() {
        // Archive events older than retention period
        setInterval(async () => {
            try {
                await this.archiveOldEvents();
            } catch (error) {
                console.error('Event archiving failed:', error.message);
            }
        }, 24 * 60 * 60 * 1000); // Run daily
    }

    /**
     * Archives old events
     */
    async archiveOldEvents() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
        
        const oldEvents = await this.eventStore.find({
            timestamp: { $lt: cutoffDate.toISOString() }
        }).toArray();
        
        if (oldEvents.length > 0) {
            // Move to archive collection
            const archiveCollection = this.mongoClient.db(this.eventStoreDb).collection('events_archive');
            await archiveCollection.insertMany(oldEvents);
            
            // Delete from main collection
            await this.eventStore.deleteMany({
                timestamp: { $lt: cutoffDate.toISOString() }
            });
            
            console.log(`Archived ${oldEvents.length} old events`);
        }
    }

    /**
     * Searches events by text
     * @param {string} searchText Text to search for
     * @param {object} options Search options
     * @returns {array} Matching events
     */
    async searchEvents(searchText, options = {}) {
        const query = {
            $or: [
                { eventType: { $regex: searchText, $options: 'i' } },
                { aggregateId: { $regex: searchText, $options: 'i' } },
                { 'metadata.actor': { $regex: searchText, $options: 'i' } }
            ]
        };
        
        if (options.eventTypes) {
            query.eventType = { $in: options.eventTypes };
        }
        
        const events = await this.eventStore
            .find(query)
            .sort({ timestamp: -1 })
            .limit(options.limit || 100)
            .toArray();
        
        // Decompress event data if needed
        for (const event of events) {
            if (event.compressed) {
                event.data = await this.decompressData(event.data);
            }
        }
        
        return events;
    }

    /**
     * Shuts down the event sourcing system
     */
    async shutdown() {
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
        
        console.log('Event sourcing system shutdown completed');
    }
}

// Export singleton instance
const eventSourcing = new EventSourcing();

module.exports = eventSourcing;
