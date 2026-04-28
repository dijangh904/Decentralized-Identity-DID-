# Job Queue System Implementation

## Overview
This document describes the implementation of a Bull-based job queue system for handling long-running operations (credential verification, blockchain interactions) in the background.

## Architecture

### Components
1. **Queue Configuration** (`src/config/queue.js`)
   - Three Bull queues for different job types:
     - `credential-verification`: For credential verification tasks
     - `blockchain-interaction`: For Stellar blockchain operations
     - `cross-chain-bridge`: For cross-chain bridging operations
   - Redis-based storage
   - Automatic retry with exponential backoff
   - Job retention policies

2. **Workers** (`src/workers/index.js`)
   - Processes jobs from all queues
   - Handles credential verification
   - Handles Stellar transaction submissions
   - Handles Stellar account fetches
   - Handles cross-chain DID and credential bridging
   - Handles cross-chain state verification

3. **Service Layer Updates**
   - `credentialService.js`: Added `verifyCredentialAsync()`
   - `stellarService.js`: Added `submitTransactionAsync()` and `getAccountAsync()`
   - `crossChainService.js`: Added async variants of all bridge methods

4. **API Endpoints** (`src/routes/v1/jobs.js`)
   - `GET /api/v1/jobs/:jobId` - Get job status
   - `GET /api/v1/jobs/:jobId/result` - Get job result (waits if not complete)
   - `DELETE /api/v1/jobs/:jobId` - Cancel a job
   - `GET /api/v1/jobs/queue/:queueName/stats` - Get queue statistics

## Usage

### Synchronous vs Asynchronous Operations

#### Synchronous (Existing)
```javascript
const result = await credentialService.verifyCredential(credential);
```

#### Asynchronous (New)
```javascript
const job = await credentialService.verifyCredentialAsync(credential);
// Returns: { jobId, status, message }

// Later, check status
const status = await fetch(`/api/v1/jobs/${job.jobId}`);

// Or wait for result
const result = await fetch(`/api/v1/jobs/${job.jobId}/result`);
```

### Service Methods

#### Credential Service
- `verifyCredentialAsync(credential)` - Queue credential verification

#### Stellar Service
- `submitTransactionAsync(transactionXDR)` - Queue transaction submission
- `getAccountAsync(address)` - Queue account fetch

#### Cross-Chain Service
- `bridgeDIDToEthereumAsync(did, ownerAddress)` - Queue DID bridge
- `bridgeCredentialToEthereumAsync(credentialId, dataHash)` - Queue credential bridge
- `verifyCrossChainStateAsync(did)` - Queue state verification

### API Endpoints

#### Get Job Status
```bash
GET /api/v1/jobs/:jobId
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "job-id",
    "name": "verify-credential",
    "queue": "credential-verification",
    "state": "completed",
    "progress": 100,
    "result": { ... },
    "attemptsMade": 1,
    "processedOn": 1234567890,
    "finishedOn": 1234567895
  }
}
```

#### Get Job Result (Waits if not complete)
```bash
GET /api/v1/jobs/:jobId/result?timeout=30000
```

#### Cancel Job
```bash
DELETE /api/v1/jobs/:jobId
```

#### Get Queue Statistics
```bash
GET /api/v1/jobs/queue/:queueName/stats
```
Response:
```json
{
  "success": true,
  "data": {
    "queue": "credential-verification",
    "waiting": 5,
    "active": 2,
    "completed": 100,
    "failed": 3,
    "delayed": 0
  }
}
```

## Configuration

### Environment Variables
Add to `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Queue Options
Default job options in `src/config/queue.js`:
- Remove completed jobs after 24 hours (keep last 1000)
- Remove failed jobs after 7 days (keep last 5000)
- 3 retry attempts with exponential backoff (starting at 2s)

## Priority Levels
- Priority 1: Cross-chain bridging (highest)
- Priority 2: Credential verification
- Priority 3: Stellar transaction submission
- Priority 4: Account fetches (lowest)

## Monitoring

### Queue Statistics
Monitor queue health via the stats endpoint:
```bash
curl http://localhost:3001/api/v1/jobs/queue/credential-verification/stats
```

### Logs
Job events are logged:
- Job queued
- Job started
- Job progress
- Job completed
- Job failed
- Job stalled

## Testing

### Manual Testing
1. Start the server: `npm run dev`
2. Queue a job via service method
3. Check job status via API endpoint
4. Verify job completion

### Example Test
```javascript
// Queue a credential verification
const job = await credentialService.verifyCredentialAsync(mockCredential);
console.log('Job ID:', job.jobId);

// Check status
const response = await fetch(`http://localhost:3001/api/v1/jobs/${job.jobId}`);
const status = await response.json();
console.log('Job status:', status.data.state);
```

## Benefits

1. **Non-blocking API**: Long-running operations don't block HTTP responses
2. **Automatic Retries**: Failed jobs are automatically retried with backoff
3. **Scalability**: Workers can be scaled independently
4. **Monitoring**: Built-in job tracking and statistics
5. **Resilience**: Jobs survive server restarts (Redis-backed)

## Migration Guide

To migrate existing synchronous operations to async:

1. Replace service method calls with `*Async` variants
2. Handle the job ID response
3. Poll job status or use the result endpoint
4. Update frontend to handle async patterns

## Future Enhancements

- Add job scheduling (delayed jobs)
- Add job dependencies
- Add webhook notifications on job completion
- Add job priority adjustment API
- Add job retry configuration per job type
