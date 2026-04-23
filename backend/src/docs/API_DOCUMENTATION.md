# Stellar DID Platform - Complete API Documentation

## Overview

The Stellar DID Platform provides comprehensive REST and GraphQL APIs for decentralized identity management on the Stellar network. This documentation covers all endpoints, authentication, error handling, and best practices.

## Table of Contents

1. [Authentication](#authentication)
2. [REST API](#rest-api)
3. [GraphQL API](#graphql-api)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Caching](#caching)
7. [Webhooks](#webhooks)
8. [SDKs and Libraries](#sdks-and-libraries)
9. [Examples](#examples)
10. [Migration Guide](#migration-guide)

---

## Authentication

### JWT Token Authentication

All API endpoints (except health check) require JWT authentication.

#### Obtaining a Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "walletAddress": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
  "signature": "base64_encoded_signature",
  "message": "Login to Stellar DID Platform"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "expiresIn": 3600,
    "user": {
      "address": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
      "roles": ["USER"]
    }
  }
}
```

#### Using the Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Token Refresh

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

---

## REST API

### Base URL
```
https://api.stellar-did.com/api/v1
```

### DID Operations

#### Create DID

```http
POST /api/v1/did
Authorization: Bearer <token>
Content-Type: application/json

{
  "did": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
  "publicKey": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
  "serviceEndpoint": "https://example.com/did-service",
  "verificationMethods": [
    {
      "id": "key-1",
      "type": "Ed25519VerificationKey2018",
      "controller": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
      "publicKeyBase58": "GABC1234567890ABCDEF1234567890ABCDEF1234567890"
    }
  ],
  "services": [
    {
      "id": "hub",
      "type": "IdentityHub",
      "serviceEndpoint": "https://hub.example.com"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "did": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "owner": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "publicKey": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "created": "2023-01-01T00:00:00.000Z",
    "updated": "2023-01-01T00:00:00.000Z",
    "active": true,
    "serviceEndpoint": "https://example.com/did-service",
    "verificationMethods": [...],
    "services": [...]
  }
}
```

#### Get DID

```http
GET /api/v1/did/{did}
Authorization: Bearer <token>
```

#### Update DID

```http
PUT /api/v1/did/{did}
Authorization: Bearer <token>
Content-Type: application/json

{
  "publicKey": "GDEF1234567890ABCDEF1234567890ABCDEF1234567890",
  "serviceEndpoint": "https://updated.example.com",
  "verificationMethods": [...],
  "services": [...]
}
```

#### Deactivate DID

```http
DELETE /api/v1/did/{did}
Authorization: Bearer <token>
```

#### List DIDs

```http
GET /api/v1/did?owner={address}&active={boolean}&limit={number}&offset={number}&sortBy={field}&sortOrder={asc|desc}
Authorization: Bearer <token>
```

#### Search DIDs

```http
GET /api/v1/did/search?q={query}&limit={number}
Authorization: Bearer <token>
```

### Credential Operations

#### Issue Credential

```http
POST /api/v1/credentials
Authorization: Bearer <token>
Content-Type: application/json

{
  "issuer": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
  "subject": "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890",
  "credentialType": "VerifiableCredential",
  "claims": {
    "degree": {
      "type": "BachelorDegree",
      "name": "Computer Science",
      "university": "Example University"
    },
    "graduationDate": "2023-06-01"
  },
  "expires": "2024-01-01T00:00:00.000Z",
  "credentialSchema": {
    "id": "https://example.com/schemas/degree-v1.json",
    "type": "JsonSchemaValidator2018"
  }
}
```

#### Get Credential

```http
GET /api/v1/credentials/{id}
Authorization: Bearer <token>
```

#### Revoke Credential

```http
DELETE /api/v1/credentials/{id}
Authorization: Bearer <token>
```

#### List Credentials

```http
GET /api/v1/credentials?issuer={did}&subject={did}&credentialType={type}&revoked={boolean}&expired={boolean}&limit={number}&offset={number}
Authorization: Bearer <token>
```

#### Verify Credential

```http
POST /api/v1/credentials/{id}/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "credential": {
    "@context": [...],
    "id": "urn:uuid:12345678-1234-1234-1234-123456789012",
    "type": ["VerifiableCredential"],
    "issuer": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "issuanceDate": "2023-01-01T00:00:00.000Z",
    "credentialSubject": {...},
    "proof": {...}
  }
}
```

### Stellar Operations

#### Get Account

```http
GET /api/v1/stellar/account/{address}
Authorization: Bearer <token>
```

#### Get Transactions

```http
GET /api/v1/stellar/transactions?account={address}&limit={number}&offset={number}&status={pending|success|failed}
Authorization: Bearer <token>
```

#### Create Transaction

```http
POST /api/v1/stellar/transaction
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourceAccount": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
  "operations": [
    {
      "type": "payment",
      "destination": "GDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      "amount": "10.0000000",
      "asset": "native"
    }
  ],
  "memo": "Payment for services",
  "fee": 100
}
```

#### Submit Transaction

```http
POST /api/v1/stellar/transaction/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionXDR": "AAAAAgAAAAB..."
}
```

### Contract Operations

#### Get Contract Info

```http
GET /api/v1/contracts/info
Authorization: Bearer <token>
```

#### Deploy Contract

```http
POST /api/v1/contracts/deploy
Authorization: Bearer <token>
Content-Type: application/json

{
  "deployerSecret": "SA..."
}
```

#### Get Contract Data

```http
GET /api/v1/contracts/data/{key}
Authorization: Bearer <token>
```

#### Update Contract Data

```http
PUT /api/v1/contracts/data/{key}
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "data_value"
}
```

---

## GraphQL API

### Endpoint
```
https://api.stellar-did.com/graphql
```

### Playground
```
https://api.stellar-did.com/graphql
```

### Schema Overview

The GraphQL API provides the same functionality as the REST API with additional flexibility for querying related data in a single request.

### Example Queries

#### Get DID with Credentials

```graphql
query GetDIDWithCredentials($did: String!) {
  did(did: $did) {
    id
    did
    owner
    publicKey
    created
    active
    verificationMethods {
      id
      type
      publicKeyBase58
    }
    services {
      id
      type
      serviceEndpoint
    }
  }
  
  credentials(subject: $did, revoked: false) {
    id
    issuer
    credentialType
    issued
    expires
    claims
  }
}
```

#### Search and Paginate

```graphql
query SearchDIDs($query: String!, $limit: Int!, $offset: Int!) {
  searchDIDs(query: $query, limit: $limit, offset: $offset) {
    id
    did
    owner
    serviceEndpoint
  }
  
  didCount(active: true)
}
```

### Real-time Subscriptions

#### DID Creation Events

```graphql
subscription DIDCreated($owner: String) {
  didCreated(owner: $owner) {
    id
    did
    owner
    created
    active
  }
}
```

#### Credential Issuance Events

```graphql
subscription CredentialIssued($issuer: String, $subject: String) {
  credentialIssued(issuer: $issuer, subject: $subject) {
    id
    issuer
    subject
    credentialType
    issued
  }
}
```

---

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "action": "Suggested action to resolve the error",
    "path": "/api/v1/endpoint",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "technicalError": "Technical error details (development only)",
    "stack": "Error stack trace (development only)"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Resource conflict | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `STELLAR_ERROR` | Stellar network error | 502 |
| `INTERNAL_ERROR` | Server error | 500 |

### Handling Errors

#### Client-side Error Handling

```javascript
try {
  const response = await fetch('/api/v1/did/invalid-did', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    // Handle API error
    const error = data.error;
    
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.error('Validation failed:', error.action);
        break;
      case 'NOT_FOUND':
        console.error('Resource not found:', error.message);
        break;
      case 'RATE_LIMIT_EXCEEDED':
        console.error('Rate limit exceeded, retry after:', error.retryAfter);
        break;
      default:
        console.error('API error:', error.message);
    }
    
    throw new Error(error.message);
  }
  
  return data;
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
```

---

## Rate Limiting

### Limits

- **Unauthenticated**: 10 requests per 15 minutes
- **Authenticated**: 100 requests per 15 minutes
- **Premium**: 1000 requests per 15 minutes

### Headers

Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits

```javascript
const checkRateLimit = (response) => {
  const limit = parseInt(response.headers.get('X-RateLimit-Limit'));
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  const reset = parseInt(response.headers.get('X-RateLimit-Reset'));
  
  if (remaining === 0) {
    const waitTime = (reset * 1000) - Date.now();
    console.log(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds`);
    return false;
  }
  
  return true;
};
```

---

## Caching

### Cache Headers

The API implements HTTP caching with appropriate headers:

```http
Cache-Control: public, max-age=300
ETag: "W/\"abc123\""
Last-Modified: Wed, 01 Jan 2023 00:00:00 GMT
```

### Cache Strategies

#### DID Documents
- **Cache Time**: 5 minutes
- **Invalidation**: On DID updates

#### Credentials
- **Cache Time**: 5 minutes
- **Invalidation**: On credential revocation

#### Stellar Account Data
- **Cache Time**: 30 seconds
- **Invalidation**: On transaction

#### Network Statistics
- **Cache Time**: 1 minute
- **Invalidation**: Periodic

### Client-side Caching

```javascript
// Using Apollo Client for GraphQL
const client = new ApolloClient({
  uri: 'https://api.stellar-did.com/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          did: {
            merge: true,
            cache: true
          }
        }
      },
      DIDDocument: {
        keyFields: ["id"],
        fields: {
          verificationMethods: {
            merge: false
          }
        }
      }
    }
  })
});

// Using fetch with caching
const fetchWithCache = async (url, options = {}) => {
  const cacheKey = `api:${url}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    // Use cached data if less than 5 minutes old
    if (age < 5 * 60 * 1000) {
      return data;
    }
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  // Cache the response
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  
  return data;
};
```

---

## Webhooks

### Webhook Configuration

Configure webhooks to receive real-time notifications:

```http
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["did.created", "credential.issued", "credential.revoked"],
  "secret": "webhook_secret_key"
}
```

### Webhook Events

#### DID Created

```json
{
  "event": "did.created",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "data": {
    "did": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "owner": "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "created": "2023-01-01T00:00:00.000Z"
  }
}
```

#### Credential Issued

```json
{
  "event": "credential.issued",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "data": {
    "id": "urn:uuid:12345678-1234-1234-1234-123456789012",
    "issuer": "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890",
    "subject": "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890",
    "credentialType": "VerifiableCredential",
    "issued": "2023-01-01T00:00:00.000Z"
  }
}
```

### Webhook Security

Webhooks are signed using HMAC-SHA256:

```javascript
const crypto = require('crypto');

const verifyWebhook = (payload, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

// Express middleware example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  handleWebhook(req.body);
  
  res.status(200).json({ received: true });
});
```

---

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @stellar-did/sdk
```

```typescript
import { StellarDIDClient } from '@stellar-did/sdk';

const client = new StellarDIDClient({
  apiUrl: 'https://api.stellar-did.com',
  apiKey: 'your-api-key'
});

// Create DID
const did = await client.dids.create({
  publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
  serviceEndpoint: 'https://example.com'
});

// Issue credential
const credential = await client.credentials.issue({
  issuer: 'did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
  subject: 'did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
  credentialType: 'VerifiableCredential',
  claims: { name: 'John Doe' }
});
```

### Python

```bash
pip install stellar-did-sdk
```

```python
from stellar_did import StellarDIDClient

client = StellarDIDClient(
    api_url='https://api.stellar-did.com',
    api_key='your-api-key'
)

# Create DID
did = client.dids.create(
    public_key='GABC1234567890ABCDEF1234567890ABCDEF1234567890',
    service_endpoint='https://example.com'
)

# Issue credential
credential = client.credentials.issue(
    issuer='did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
    subject='did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
    credential_type='VerifiableCredential',
    claims={'name': 'John Doe'}
)
```

### Go

```bash
go get github.com/stellar-did/go-sdk
```

```go
package main

import (
    "github.com/stellar-did/go-sdk"
)

func main() {
    client := stellarDid.NewClient(&stellarDid.Config{
        APIURL:  "https://api.stellar-did.com",
        APIKey:  "your-api-key",
    })
    
    // Create DID
    did, err := client.DIDs.Create(&stellarDid.DIDInput{
        PublicKey:      "GABC1234567890ABCDEF1234567890ABCDEF1234567890",
        ServiceEndpoint: "https://example.com",
    })
    
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Created DID: %s\n", did.ID)
}
```

---

## Examples

### Complete DID Management Flow

```javascript
// 1. Authenticate
const authResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
    signature: 'base64_signature',
    message: 'Login to Stellar DID Platform'
  })
});

const { token } = await authResponse.json();

// 2. Create DID
const didResponse = await fetch('/api/v1/did', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    did: 'did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
    publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
    serviceEndpoint: 'https://example.com/did-service'
  })
});

const did = await didResponse.json();

// 3. Issue Credential
const credentialResponse = await fetch('/api/v1/credentials', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    issuer: did.data.did,
    subject: 'did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
    credentialType: 'VerifiableCredential',
    claims: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  })
});

const credential = await credentialResponse.json();

// 4. Verify Credential
const verificationResponse = await fetch(`/api/v1/credentials/${credential.data.id}/verify`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    credential: credential.data
  })
});

const verification = await verificationResponse.json();
console.log('Credential valid:', verification.data.valid);
```

### GraphQL Subscription Example

```javascript
import { ApolloClient, InMemoryCache, gql, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';

// WebSocket link for subscriptions
const wsLink = new WebSocketLink({
  uri: 'wss://api.stellar-did.com/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      authToken: 'your-jwt-token'
    }
  }
});

// HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: 'https://api.stellar-did.com/graphql',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

// Split link
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache()
});

// Subscribe to DID creation events
const DID_CREATED_SUBSCRIPTION = gql`
  subscription DIDCreated($owner: String) {
    didCreated(owner: $owner) {
      id
      did
      owner
      created
      active
    }
  }
`;

const subscription = client.subscribe({
  query: DID_CREATED_SUBSCRIPTION,
  variables: { owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890' }
}).subscribe({
  next: (data) => {
    console.log('New DID created:', data.didCreated);
    // Update UI or trigger business logic
  },
  error: (error) => {
    console.error('Subscription error:', error);
  }
});

// Unsubscribe when component unmounts
// subscription.unsubscribe();
```

---

## Migration Guide

### From REST to GraphQL

#### 1. Replace Multiple Requests

**Before (REST):**
```javascript
const [didResponse, credentialsResponse] = await Promise.all([
  fetch('/api/v1/did/did:stellar:...'),
  fetch('/api/v1/credentials?subject=did:stellar:...')
]);

const did = await didResponse.json();
const credentials = await credentialsResponse.json();
```

**After (GraphQL):**
```javascript
const { data } = await client.query({
  query: gql`
    query GetDIDWithCredentials($did: String!) {
      did(did: $did) {
        id
        did
        owner
        active
      }
      credentials(subject: $did) {
        id
        issuer
        credentialType
        issued
      }
    }
  `,
  variables: { did: 'did:stellar:...' }
});
```

#### 2. Implement Real-time Updates

**Before (Polling):**
```javascript
setInterval(async () => {
  const response = await fetch('/api/v1/did/...');
  const data = await response.json();
  updateUI(data);
}, 5000);
```

**After (Subscriptions):**
```javascript
const subscription = client.subscribe({
  query: gql`
    subscription DIDUpdated($did: String!) {
      didUpdated(did: $did) {
        id
        updated
        active
      }
    }
  `,
  variables: { did: 'did:stellar:...' }
}).subscribe({
  next: (data) => updateUI(data.didUpdated)
});
```

#### 3. Optimize Data Fetching

**Before (Over-fetching):**
```javascript
const response = await fetch('/api/v1/did/...');
const did = await response.json();
// Only using id and did, but getting full object
```

**After (Field Selection):**
```javascript
const { data } = await client.query({
  query: gql`
    query GetMinimalDID($did: String!) {
      did(did: $did) {
        id
        did
      }
    }
  `,
  variables: { did: 'did:stellar:...' }
});
```

### Version Compatibility

| Version | Status | Supported Until |
|---------|--------|-----------------|
| v1.0 | Deprecated | 2024-06-01 |
| v2.0 | Current | 2025-06-01 |
| v3.0 | Beta | Ongoing |

### Breaking Changes

#### v1.0 to v2.0
- Authentication method changed from API key to JWT
- DID endpoint structure updated
- Error response format standardized

#### Migration Checklist

- [ ] Update authentication method
- [ ] Update API endpoints
- [ ] Update error handling
- [ ] Test with new SDKs
- [ ] Update rate limiting handling
- [ ] Implement caching strategies

---

## Support

### Getting Help

- **Documentation**: https://docs.stellar-did.com
- **API Reference**: https://api.stellar-did.com/docs
- **GraphQL Playground**: https://api.stellar-did.com/graphql
- **Community Forum**: https://community.stellar-did.com
- **Support Email**: support@stellar-did.com

### Reporting Issues

Report bugs and feature requests at:
https://github.com/stellar-did/platform/issues

### Status Page

Check API status and uptime:
https://status.stellar-did.com

---

## Changelog

### v2.1.0 (2023-12-01)
- Added GraphQL subscriptions
- Improved caching strategies
- Enhanced error messages
- Added webhook support

### v2.0.0 (2023-10-15)
- Complete GraphQL API implementation
- JWT authentication
- Rate limiting improvements
- Enhanced security features

### v1.5.0 (2023-08-01)
- Added credential verification
- Improved DID search
- Performance optimizations
- Bug fixes

---

*This documentation is continuously updated. For the latest version, visit https://docs.stellar-did.com*
