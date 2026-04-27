# Credential Sharing Feature - Issue #94

## Overview
This implementation adds secure credential sharing functionality with expiration controls to the Decentralized Identity DID platform.

## Features Implemented

### 1. Credential Sharing Service (`src/services/credentialSharingService.js`)
- **Share Credential**: Users can share their credentials with third parties securely
- **Access Control**: Only authorized parties can access shared credentials using access tokens
- **Expiration Controls**: 
  - Configurable expiration time (default: 24 hours)
  - Maximum access count limits
  - Ability to extend expiration
- **Revocation**: Original sharer can revoke access at any time
- **Status Tracking**: Active, expired, revoked, or exhausted states
- **Statistics**: Track sharing metrics and usage

### 2. API Routes (`src/routes/credentialSharing.js`)
- `POST /api/sharing/share` - Share a credential
- `POST /api/sharing/access` - Access a shared credential
- `POST /api/sharing/revoke` - Revoke a shared credential
- `GET /api/sharing/my-shares` - Get credentials shared by a DID
- `GET /api/sharing/shared-with-me` - Get credentials shared with a DID
- `POST /api/sharing/extend` - Extend sharing expiration
- `POST /api/sharing/cleanup` - Clean up expired shares (admin)
- `GET /api/sharing/statistics` - Get sharing statistics (admin)

### 3. Integration
- Added credential sharing routes to main Express app (`src/index.js`)
- Updated API documentation to include new endpoints

### 4. Testing (`src/__tests__/credentialSharing.test.js`)
- Comprehensive test suite covering all major functions
- Tests for sharing, accessing, revoking, and extending credentials
- Error handling and edge case testing

## Security Features

1. **JWT-based Access Tokens**: Secure token-based authentication for accessing shared credentials
2. **Token Hashing**: Access tokens are hashed before storage for security
3. **DID Verification**: Both sharer and recipient DIDs are verified before sharing
4. **Authorization Checks**: Only authorized parties can access shared credentials
5. **Expiration Enforcement**: Automatic expiration of shared credentials
6. **Access Count Limits**: Prevent unlimited access to shared credentials
7. **Revocation Capability**: Immediate revocation of access when needed

## Usage Examples

### Share a Credential
```bash
POST /api/sharing/share
{
  "credentialId": "urn:uuid:12345678-1234-1234-1234-123456789012",
  "sharedByDID": "did:stellar:GABC...",
  "sharedWithDID": "did:stellar:GXYZ...",
  "expiresIn": 86400,
  "maxAccessCount": 5,
  "purpose": "employment-verification"
}
```

### Access a Shared Credential
```bash
POST /api/sharing/access
{
  "sharingId": "uuid-from-share-response",
  "accessToken": "jwt-token-from-share-response",
  "requestorDID": "did:stellar:GXYZ..."
}
```

### Revoke a Shared Credential
```bash
POST /api/sharing/revoke
{
  "sharingId": "uuid-from-share-response",
  "sharedByDID": "did:stellar:GABC..."
}
```

## Acceptance Criteria Met

✅ **Implement secure credential sharing with expiration controls**
- Secure sharing mechanism with JWT tokens
- Configurable expiration times
- Access count limits
- Revocation capability
- Status tracking and monitoring

## Future Enhancements

1. **Database Integration**: Replace in-memory storage with persistent database
2. **Encryption**: Add end-to-end encryption for credential data
3. **Audit Logs**: Comprehensive audit trail for all sharing operations
4. **Webhook Notifications**: Notify parties when credentials are shared/accessed/revoked
5. **Batch Sharing**: Share multiple credentials at once
6. **Temporary Links**: Generate one-time access links
7. **Smart Contract Integration**: Store sharing records on blockchain for immutability

## Dependencies
- `jsonwebtoken`: For JWT token generation and verification
- `crypto`: For secure token hashing and UUID generation

## Environment Variables
- `ENCRYPTION_KEY`: Secret key for JWT token signing (defaults to random key if not set)
- `JWT_SECRET`: Secret key for credential signing (existing)

## Testing
Run tests with:
```bash
npm test src/__tests__/credentialSharing.test.js
```

## API Documentation
Updated root endpoint to include `/api/sharing` in available endpoints.
