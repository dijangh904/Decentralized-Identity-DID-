/**
 * @title EventSourcing Tests
 * @dev Comprehensive tests for event sourcing functionality
 */

const EventSourcing = require('../events/EventSourcing');
const { MongoClient } = require('mongodb');

// Mock dependencies
jest.mock('mongodb', () => ({
    MongoClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        db: jest.fn().mockReturnValue({
            collection: jest.fn().mockReturnValue({
                insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
                findOne: jest.fn().mockResolvedValue(null),
                find: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue([]),
                    sort: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis()
                }),
                replaceOne: jest.fn().mockResolvedValue(),
                deleteMany: jest.fn().mockResolvedValue(),
                countDocuments: jest.fn().mockResolvedValue(0),
                aggregate: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue([])
                })
            }),
            createIndex: jest.fn().mockResolvedValue()
        }),
        close: jest.fn().mockResolvedValue()
    }))
}));

describe('EventSourcing', () => {
    let eventSourcing;
    let testEvent;

    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'test';
        process.env.EVENT_SOURCING_ENABLED = 'true';
        process.env.EVENT_STORE_DB = 'test_events';
        process.env.EVENT_SNAPSHOT_INTERVAL = '1000';
        process.env.EVENT_RETENTION_DAYS = '365';
        process.env.EVENT_COMPRESSION = 'true';

        eventSourcing = new EventSourcing();

        testEvent = {
            aggregateId: 'test-aggregate-123',
            aggregateType: 'DID',
            eventType: 'DID_CREATED',
            version: 1,
            timestamp: new Date().toISOString(),
            data: {
                did: 'did:stellar:test123',
                owner: '0x1234567890123456789012345678901234567890',
                publicKey: 'test-public-key',
                serviceEndpoints: ['endpoint1', 'endpoint2']
            },
            metadata: {
                actor: 'test-user',
                source: 'test'
            }
        };
    });

    afterEach(async () => {
        try {
            await eventSourcing.shutdown();
        } catch (error) {
            // Ignore shutdown errors
        }
    });

    describe('Event Sourcing Initialization', () => {
        test('should initialize event sourcing system successfully', async () => {
            expect(eventSourcing.isInitialized).toBe(true);
            expect(eventSourcing.eventStoreDb).toBe('test_events');
            expect(eventSourcing.snapshotInterval).toBe(1000);
            expect(eventSourcing.retentionDays).toBe(365);
            expect(eventSourcing.compressionEnabled).toBe(true);
        });

        test('should initialize event types', () => {
            expect(eventSourcing.eventTypes.has('DID_CREATED')).toBe(true);
            expect(eventSourcing.eventTypes.has('DID_UPDATED')).toBe(true);
            expect(eventSourcing.eventTypes.has('CREDENTIAL_ISSUED')).toBe(true);
            expect(eventSourcing.eventTypes.has('GOVERNANCE_PROPOSAL_CREATED')).toBe(true);
        });

        test('should initialize event schemas', () => {
            expect(eventSourcing.eventSchemas['DID_CREATED']).toBeDefined();
            expect(eventSourcing.eventSchemas['CREDENTIAL_ISSUED']).toBeDefined();
            expect(eventSourcing.eventSchemas['GOVERNANCE_PROPOSAL_CREATED']).toBeDefined();
        });
    });

    describe('Event Storage', () => {
        test('should store event successfully', async () => {
            const storedEvent = await eventSourcing.storeEvent(testEvent);
            
            expect(storedEvent.eventId).toBeDefined();
            expect(storedEvent.hash).toBeDefined();
            expect(storedEvent.storedAt).toBeDefined();
            expect(storedEvent.eventType).toBe('DID_CREATED');
            expect(storedEvent.aggregateId).toBe('test-aggregate-123');
        });

        test('should enrich event with system fields', async () => {
            const storedEvent = await eventSourcing.storeEvent(testEvent);
            
            expect(storedEvent.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            expect(storedEvent.storedAt).toBeDefined();
            expect(storedEvent.metadata.source).toBe('event-sourcing');
            expect(storedEvent.metadata.version).toBe('1.0.0');
        });

        test('should calculate event hash for integrity', async () => {
            const storedEvent = await eventSourcing.storeEvent(testEvent);
            
            expect(storedEvent.hash).toMatch(/^[a-f0-9]{64}$/);
            
            // Verify hash calculation
            const eventCopy = { ...storedEvent };
            delete eventCopy.hash;
            const eventString = JSON.stringify(eventCopy, Object.keys(eventCopy).sort());
            const expectedHash = require('crypto').createHash('sha256').update(eventString).digest('hex');
            expect(storedEvent.hash).toBe(expectedHash);
        });

        test('should compress event data when enabled', async () => {
            const largeDataEvent = {
                ...testEvent,
                data: {
                    ...testEvent.data,
                    largeField: 'x'.repeat(10000) // Large data to trigger compression
                }
            };
            
            const storedEvent = await eventSourcing.storeEvent(largeDataEvent);
            
            expect(storedEvent.compressed).toBe(true);
            expect(typeof storedEvent.data).toBe('string');
        });

        test('should update metrics after storing event', async () => {
            const initialMetrics = { ...eventSourcing.metrics };
            
            await eventSourcing.storeEvent(testEvent);
            
            expect(eventSourcing.metrics.eventsStored).toBe(initialMetrics.eventsStored + 1);
            expect(eventSourcing.metrics.totalEventSize).toBeGreaterThan(initialMetrics.totalEventSize);
            expect(eventSourcing.metrics.averageEventSize).toBeGreaterThan(0);
        });
    });

    describe('Event Validation', () => {
        test('should validate required event fields', async () => {
            const invalidEvent = { ...testEvent };
            delete invalidEvent.eventType;
            
            await expect(eventSourcing.storeEvent(invalidEvent)).rejects.toThrow('Invalid or unsupported event type');
        });

        test('should validate event type', async () => {
            const invalidEvent = { ...testEvent, eventType: 'INVALID_EVENT_TYPE' };
            
            await expect(eventSourcing.storeEvent(invalidEvent)).rejects.toThrow('Invalid or unsupported event type');
        });

        test('should validate aggregate fields', async () => {
            const invalidEvent = { ...testEvent };
            delete invalidEvent.aggregateId;
            
            await expect(eventSourcing.storeEvent(invalidEvent)).rejects.toThrow('Event must have aggregateId and aggregateType');
        });

        test('should validate version field', async () => {
            const invalidEvent = { ...testEvent, version: 'invalid' };
            
            await expect(eventSourcing.storeEvent(invalidEvent)).rejects.toThrow('Event must have a valid version number');
        });

        test('should validate data field', async () => {
            const invalidEvent = { ...testEvent, data: null };
            
            await expect(eventSourcing.storeEvent(invalidEvent)).rejects.toThrow('Event must have valid data object');
        });

        test('should validate against event schema', async () => {
            const invalidEvent = {
                ...testEvent,
                eventType: 'DID_CREATED',
                data: { invalid: 'structure' }
            };
            
            await expect(eventSourcing.storeEvent(invalidEvent)).rejects.toThrow('Required field missing');
        });
    });

    describe('Event Replay', () => {
        test('should replay events to reconstruct state', async () => {
            // Store multiple events
            const events = [
                testEvent,
                {
                    ...testEvent,
                    eventType: 'DID_UPDATED',
                    version: 2,
                    data: { changes: { publicKey: 'updated-key' } }
                },
                {
                    ...testEvent,
                    eventType: 'CREDENTIAL_ISSUED',
                    version: 3,
                    data: {
                        credentialId: 'cred-123',
                        issuer: '0x1234567890123456789012345678901234567890',
                        subject: '0x0987654321098765432109876543210987654321',
                        type: 'VerifiableCredential',
                        claims: { name: 'Test User' }
                    }
                }
            ];
            
            for (const event of events) {
                await eventSourcing.storeEvent(event);
            }
            
            const state = await eventSourcing.replayEvents('test-aggregate-123', 'DID');
            
            expect(state.did).toBe('did:stellar:test123');
            expect(state.owner).toBe('0x1234567890123456789012345678901234567890');
            expect(state.publicKey).toBe('updated-key');
            expect(state.credentials).toBeDefined();
            expect(state.credentials.length).toBe(1);
        });

        test('should replay events up to target version', async () => {
            const events = [
                testEvent,
                {
                    ...testEvent,
                    eventType: 'DID_UPDATED',
                    version: 2,
                    data: { changes: { publicKey: 'updated-key' } }
                },
                {
                    ...testEvent,
                    eventType: 'DID_UPDATED',
                    version: 3,
                    data: { changes: { publicKey: 'final-key' } }
                }
            ];
            
            for (const event of events) {
                await eventSourcing.storeEvent(event);
            }
            
            const state = await eventSourcing.replayEvents('test-aggregate-123', 'DID', 2);
            
            expect(state.publicKey).toBe('updated-key');
        });

        test('should use snapshot for efficient replay', async () => {
            // Create snapshot
            const snapshot = {
                aggregateId: 'test-aggregate-123',
                aggregateType: 'DID',
                version: 5,
                state: { did: 'did:stellar:test123', owner: 'test-owner' }
            };
            
            eventSourcing.snapshotStore.findOne.mockResolvedValue(snapshot);
            
            const state = await eventSourcing.replayEvents('test-aggregate-123', 'DID');
            
            expect(state.did).toBe('did:stellar:test123');
            expect(state.owner).toBe('test-owner');
        });

        test('should update replay metrics', async () => {
            await eventSourcing.storeEvent(testEvent);
            
            const initialMetrics = { ...eventSourcing.metrics };
            await eventSourcing.replayEvents('test-aggregate-123', 'DID');
            
            expect(eventSourcing.metrics.eventsReplayed).toBe(initialMetrics.eventsReplayed + 1);
            expect(eventSourcing.metrics.replayLatency).toBeGreaterThan(0);
        });
    });

    describe('Event Application', () => {
        test('should apply DID_CREATED event', async () => {
            const currentState = {};
            const newState = await eventSourcing.applyEvent(currentState, testEvent);
            
            expect(newState.did).toBe('did:stellar:test123');
            expect(newState.owner).toBe('0x1234567890123456789012345678901234567890');
            expect(newState.active).toBe(true);
            expect(newState.createdAt).toBeDefined();
            expect(newState.updatedAt).toBeDefined();
        });

        test('should apply DID_UPDATED event', async () => {
            const currentState = { did: 'did:stellar:test123', owner: 'original-owner' };
            const updateEvent = {
                ...testEvent,
                eventType: 'DID_UPDATED',
                data: { changes: { publicKey: 'new-key' } }
            };
            
            const newState = await eventSourcing.applyEvent(currentState, updateEvent);
            
            expect(newState.did).toBe('did:stellar:test123');
            expect(newState.owner).toBe('original-owner');
            expect(newState.publicKey).toBe('new-key');
            expect(newState.updatedAt).toBeDefined();
        });

        test('should apply CREDENTIAL_ISSUED event', async () => {
            const currentState = { did: 'did:stellar:test123' };
            const credentialEvent = {
                ...testEvent,
                eventType: 'CREDENTIAL_ISSUED',
                data: {
                    credentialId: 'cred-123',
                    issuer: '0x1234567890123456789012345678901234567890',
                    subject: '0x0987654321098765432109876543210987654321',
                    type: 'VerifiableCredential',
                    claims: { name: 'Test User' }
                }
            };
            
            const newState = await eventSourcing.applyEvent(currentState, credentialEvent);
            
            expect(newState.credentials).toBeDefined();
            expect(newState.credentials.length).toBe(1);
            expect(newState.credentials[0].id).toBe('cred-123');
            expect(newState.credentials[0].status).toBe('active');
        });

        test('should apply CREDENTIAL_REVOKED event', async () => {
            const currentState = {
                did: 'did:stellar:test123',
                credentials: [
                    {
                        id: 'cred-123',
                        issuer: '0x1234567890123456789012345678901234567890',
                        subject: '0x0987654321098765432109876543210987654321',
                        status: 'active'
                    }
                ]
            };
            
            const revokeEvent = {
                ...testEvent,
                eventType: 'CREDENTIAL_REVOKED',
                data: { credentialId: 'cred-123' }
            };
            
            const newState = await eventSourcing.applyEvent(currentState, revokeEvent);
            
            expect(newState.credentials.length).toBe(1);
            expect(newState.credentials[0].status).toBe('revoked');
            expect(newState.credentials[0].revokedAt).toBeDefined();
        });
    });

    describe('Snapshot Management', () => {
        test('should create snapshot when version threshold is reached', async () => {
            const snapshotEvent = {
                ...testEvent,
                version: 1000 // Trigger snapshot
            };
            
            await eventSourcing.storeEvent(snapshotEvent);
            
            expect(eventSourcing.metrics.snapshotsCreated).toBe(1);
        });

        test('should compress snapshot state when enabled', async () => {
            const snapshotEvent = {
                ...testEvent,
                version: 1000,
                data: { largeField: 'x'.repeat(10000) }
            };
            
            await eventSourcing.storeEvent(snapshotEvent);
            
            const snapshotCall = eventSourcing.snapshotStore.replaceOne.mock.calls[0];
            const snapshotData = snapshotCall[0][1];
            
            expect(snapshotData.compressed).toBe(true);
        });
    });

    describe('Event Querying', () => {
        test('should get events for aggregate', async () => {
            await eventSourcing.storeEvent(testEvent);
            
            const events = await eventSourcing.getEvents('test-aggregate-123', 'DID');
            
            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].aggregateId).toBe('test-aggregate-123');
            expect(events[0].aggregateType).toBe('DID');
        });

        test('should filter events by version range', async () => {
            const events = [
                { ...testEvent, version: 1 },
                { ...testEvent, version: 2 },
                { ...testEvent, version: 3 }
            ];
            
            for (const event of events) {
                await eventSourcing.storeEvent(event);
            }
            
            const filteredEvents = await eventSourcing.getEvents('test-aggregate-123', 'DID', {
                fromVersion: 2,
                toVersion: 3
            });
            
            expect(filteredEvents.length).toBe(2);
            expect(filteredEvents[0].version).toBe(2);
            expect(filteredEvents[1].version).toBe(3);
        });

        test('should filter events by event types', async () => {
            const events = [
                testEvent,
                { ...testEvent, eventType: 'DID_UPDATED', version: 2 },
                { ...testEvent, eventType: 'CREDENTIAL_ISSUED', version: 3 }
            ];
            
            for (const event of events) {
                await eventSourcing.storeEvent(event);
            }
            
            const filteredEvents = await eventSourcing.getEvents('test-aggregate-123', 'DID', {
                eventTypes: ['DID_CREATED', 'DID_UPDATED']
            });
            
            expect(filteredEvents.length).toBe(2);
            expect(filteredEvents.every(e => e.eventType === 'DID_CREATED' || e.eventType === 'DID_UPDATED')).toBe(true);
        });

        test('should get state at specific timestamp', async () => {
            const timestamp = new Date().toISOString();
            
            await eventSourcing.storeEvent({
                ...testEvent,
                timestamp
            });
            
            const state = await eventSourcing.getStateAtTimestamp('test-aggregate-123', 'DID', timestamp);
            
            expect(state.did).toBe('did:stellar:test123');
        });
    });

    describe('Audit Trail', () => {
        test('should get audit trail for entity', async () => {
            await eventSourcing.storeEvent(testEvent);
            
            const auditTrail = await eventSourcing.getAuditTrail('test-aggregate-123');
            
            expect(Array.isArray(auditTrail)).toBe(true);
            expect(auditTrail.length).toBeGreaterThan(0);
        });

        test('should filter audit trail by date range', async () => {
            const fromDate = new Date();
            fromDate.setHours(fromDate.getHours() - 1);
            
            await eventSourcing.storeEvent(testEvent);
            
            const auditTrail = await eventSourcing.getAuditTrail('test-aggregate-123', {
                fromDate: fromDate.toISOString()
            });
            
            expect(auditTrail.length).toBeGreaterThan(0);
            auditTrail.forEach(event => {
                expect(new Date(event.timestamp)).toBeGreaterThanOrEqual(fromDate);
            });
        });
    });

    describe('Event Integrity', () => {
        test('should verify event integrity', async () => {
            const storedEvent = await eventSourcing.storeEvent(testEvent);
            
            eventSourcing.eventStore.findOne.mockResolvedValue(storedEvent);
            
            const isValid = await eventSourcing.verifyEventIntegrity(storedEvent.eventId);
            
            expect(isValid).toBe(true);
        });

        test('should detect tampered event', async () => {
            const storedEvent = await eventSourcing.storeEvent(testEvent);
            storedEvent.data.tampered = true;
            storedEvent.hash = 'invalid-hash';
            
            eventSourcing.eventStore.findOne.mockResolvedValue(storedEvent);
            
            const isValid = await eventSourcing.verifyEventIntegrity(storedEvent.eventId);
            
            expect(isValid).toBe(false);
        });
    });

    describe('Event Statistics', () => {
        test('should get event statistics', async () => {
            await eventSourcing.storeEvent(testEvent);
            
            eventSourcing.eventStore.countDocuments.mockResolvedValue(1);
            eventSourcing.eventStore.findOne.mockResolvedValue(testEvent);
            
            const stats = await eventSourcing.getEventStatistics();
            
            expect(stats.totalEvents).toBe(1);
            expect(stats.eventTypes).toBeDefined();
            expect(stats.metrics).toBeDefined();
        });
    });

    describe('Event Search', () => {
        test('should search events by text', async () => {
            await eventSourcing.storeEvent(testEvent);
            
            const searchResults = await eventSourcing.searchEvents('DID_CREATED');
            
            expect(Array.isArray(searchResults)).toBe(true);
        });

        test('should limit search results', async () => {
            await eventSourcing.storeEvent(testEvent);
            
            const searchResults = await eventSourcing.searchEvents('DID', { limit: 5 });
            
            expect(searchResults.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Data Compression', () => {
        test('should compress and decompress data', async () => {
            const originalData = { test: 'data', large: 'x'.repeat(1000) };
            
            const compressed = await eventSourcing.compressData(originalData);
            expect(typeof compressed).toBe('string');
            expect(compressed.length).toBeLessThan(JSON.stringify(originalData).length);
            
            const decompressed = await eventSourcing.decompressData(compressed);
            expect(decompressed).toEqual(originalData);
        });
    });

    describe('Error Handling', () => {
        test('should handle storage errors gracefully', async () => {
            eventSourcing.eventStore.insertOne.mockRejectedValue(new Error('Storage error'));
            
            await expect(eventSourcing.storeEvent(testEvent)).rejects.toThrow('Storage error');
        });

        test('should handle replay errors gracefully', async () => {
            eventSourcing.eventStore.find.mockReturnValue({
                toArray: jest.fn().mockRejectedValue(new Error('Query error'))
            });
            
            await expect(eventSourcing.replayEvents('test-aggregate-123', 'DID'))
                .rejects.toThrow('Query error');
        });

        test('should handle integrity verification errors', async () => {
            eventSourcing.eventStore.findOne.mockResolvedValue(null);
            
            const isValid = await eventSourcing.verifyEventIntegrity('non-existent');
            expect(isValid).toBe(false);
        });
    });

    describe('Configuration', () => {
        test('should use custom configuration', async () => {
            process.env.EVENT_SNAPSHOT_INTERVAL = '500';
            process.env.EVENT_RETENTION_DAYS = '180';
            process.env.EVENT_COMPRESSION = 'false';
            
            const customEventSourcing = new EventSourcing();
            
            expect(customEventSourcing.snapshotInterval).toBe(500);
            expect(customEventSourcing.retentionDays).toBe(180);
            expect(customEventSourcing.compressionEnabled).toBe(false);
            
            await customEventSourcing.shutdown();
        });
    });
});
