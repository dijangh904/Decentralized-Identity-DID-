# GraphQL API Documentation

## Overview

The Stellar DID Platform now includes a comprehensive GraphQL API that provides flexible data querying capabilities alongside the existing REST API. This allows clients to request exactly the data they need in a single request, reducing over-fetching and under-fetching issues.

## Features

### 🚀 Key Features
- **Flexible Queries**: Request only the data you need
- **Real-time Subscriptions**: Live updates via WebSocket
- **Type Safety**: Strongly typed schema with validation
- **Introspection**: Self-documenting API
- **Caching**: Built-in Redis caching for performance
- **Error Handling**: Comprehensive error reporting

### 📊 Available Data Types
- DID Documents with verification methods and services
- Verifiable Credentials with schemas and proofs
- Stellar Accounts and transactions
- Contract information and network statistics

## Getting Started

### GraphQL Playground
Access the interactive GraphQL Playground at:
```
http://localhost:3001/graphql
```

### GraphQL Endpoint
```
POST http://localhost:3001/graphql
```

## Schema Overview

### Types

#### DIDDocument
```graphql
type DIDDocument {
  id: ID!
  did: String!
  owner: String!
  publicKey: String!
  created: DateTime!
  updated: DateTime!
  active: Boolean!
  serviceEndpoint: String
  verificationMethods: [VerificationMethod!]!
  services: [Service!]!
}
```

#### VerifiableCredential
```graphql
type VerifiableCredential {
  id: ID!
  issuer: String!
  subject: String!
  credentialType: String!
  issued: DateTime!
  expires: DateTime
  dataHash: String!
  revoked: Boolean!
  credentialSchema: CredentialSchema
  proof: Proof
}
```

#### StellarAccount
```graphql
type StellarAccount {
  address: String!
  publicKey: String!
  balance: String!
  sequence: String!
  signers: [Signer!]!
  thresholds: Thresholds!
  flags: Flags!
}
```

## Query Examples

### Basic DID Query
```graphql
query GetDID($did: String!) {
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
}
```

### List DIDs with Filtering
```graphql
query ListDIDs($owner: String, $active: Boolean, $limit: Int) {
  dids(owner: $owner, active: $active, limit: $limit) {
    id
    did
    owner
    created
    active
  }
  didCount(active: $active)
}
```

### Search DIDs
```graphql
query SearchDIDs($query: String!) {
  searchDIDs(query: $query, limit: 10) {
    id
    did
    owner
    serviceEndpoint
  }
}
```

### Credential Queries
```graphql
query GetCredentials($issuer: String, $subject: String, $revoked: Boolean) {
  credentials(issuer: $issuer, subject: $subject, revoked: $revoked, limit: 10) {
    id
    issuer
    subject
    credentialType
    issued
    expires
    revoked
  }
  credentialCount(issuer: $issuer, revoked: $revoked)
}
```

### Stellar Account Information
```graphql
query GetStellarAccount($address: String!) {
  stellarAccount(address: $address) {
    address
    balance
    signers {
      key
      weight
      type
    }
    thresholds {
      lowThreshold
      medThreshold
      highThreshold
    }
  }
}
```

### Network Statistics
```graphql
query GetNetworkStats {
  networkStats {
    totalDIDs
    activeDIDs
    totalCredentials
    activeCredentials
    totalTransactions
    network
    lastUpdated
  }
}
```

## Mutation Examples

### Create DID
```graphql
mutation CreateDID($input: CreateDIDInput!) {
  createDID(
    did: $input.did
    publicKey: $input.publicKey
    serviceEndpoint: $input.serviceEndpoint
    verificationMethods: $input.verificationMethods
    services: $input.services
  ) {
    id
    did
    owner
    created
    active
  }
}
```

### Issue Credential
```graphql
mutation IssueCredential($input: IssueCredentialInput!) {
  issueCredential(
    issuer: $input.issuer
    subject: $input.subject
    credentialType: $input.credentialType
    claims: $input.claims
    expires: $input.expires
  ) {
    id
    issuer
    subject
    credentialType
    issued
    expires
    dataHash
  }
}
```

### Revoke Credential
```graphql
mutation RevokeCredential($id: ID!) {
  revokeCredential(id: $id) {
    id
    revoked
    revokedAt
  }
}
```

### Batch Revoke Credentials
```graphql
mutation BatchRevokeCredentials($ids: [ID!]!) {
  batchRevokeCredentials(ids: $ids) {
    successful
    failed
    errors
  }
}
```

### Create Stellar Transaction
```graphql
mutation CreateTransaction($input: CreateTransactionInput!) {
  createTransaction(
    sourceAccount: $input.sourceAccount
    operations: $input.operations
    memo: $input.memo
    fee: $input.fee
  ) {
    id
    sourceAccount
    fee
    operations {
      type
      details
    }
    status
    xdr
  }
}
```

## Subscription Examples

### Subscribe to DID Creation
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

### Subscribe to Credential Issuance
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

### Subscribe to Transaction Updates
```graphql
subscription TransactionCreated($sourceAccount: String) {
  transactionCreated(sourceAccount: $sourceAccount) {
    id
    hash
    sourceAccount
    successful
    status
    createdAt
  }
}
```

## Error Handling

GraphQL provides structured error responses:

```json
{
  "errors": [
    {
      "message": "DID not found",
      "code": "NOT_FOUND",
      "path": ["did"],
      "locations": [{"line": 2, "column": 3}]
    }
  ],
  "data": {
    "did": null
  }
}
```

### Common Error Codes
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `INTERNAL_SERVER_ERROR`: Server error

## Performance Optimization

### Caching
- DID documents: 5 minutes
- Credentials: 5 minutes
- Stellar accounts: 30 seconds
- Transactions: 5 minutes

### Pagination
Use `limit` and `offset` parameters for large datasets:
```graphql
query {
  dids(limit: 20, offset: 40) {
    id
    did
  }
}
```

### Field Selection
Request only the fields you need:
```graphql
query {
  dids {
    id  # Only request ID field
  }
}
```

## Authentication

GraphQL supports the same authentication as the REST API:
- Include JWT token in Authorization header
- Use `Bearer <token>` format

## Rate Limiting

GraphQL endpoints share the same rate limits as REST API:
- 100 requests per 15 minutes per IP
- Separate limits for authenticated users

## Development Tools

### GraphQL Playground
Interactive IDE for testing queries:
- Auto-completion
- Schema documentation
- Query history
- Real-time validation

### Introspection
Query the schema itself:
```graphql
query {
  __schema {
    types {
      name
      description
    }
  }
}
```

## Migration from REST

### REST to GraphQL Mapping

| REST Endpoint | GraphQL Equivalent |
|---------------|-------------------|
| `GET /api/v1/did/:did` | `query { did(did: "...") }` |
| `GET /api/v1/did` | `query { dids(...) }` |
| `POST /api/v1/did` | `mutation { createDID(...) }` |
| `PUT /api/v1/did/:did` | `mutation { updateDID(...) }` |
| `DELETE /api/v1/did/:did` | `mutation { deactivateDID(...) }` |

### Benefits
- **Single Request**: Get related data in one query
- **No Over-fetching**: Request only needed fields
- **No Under-fetching**: Get all required data
- **Type Safety**: Compile-time validation
- **Real-time**: Subscriptions for live updates

## Best Practices

1. **Use Specific Fields**: Request only the fields you need
2. **Implement Pagination**: Use limit/offset for large datasets
3. **Handle Errors Gracefully**: Check for errors in responses
4. **Use Subscriptions**: For real-time updates
5. **Cache Results**: Client-side caching for frequently accessed data
6. **Monitor Performance**: Use query complexity analysis
7. **Secure Queries**: Implement proper authorization

## Support

For GraphQL-specific issues:
1. Check the GraphQL Playground for schema documentation
2. Review the error messages for detailed information
3. Use introspection queries to explore the schema
4. Contact support with query details for troubleshooting

## Roadmap

### Upcoming Features
- **Query Complexity Analysis**: Prevent expensive queries
- **Custom Scalars**: Better type handling
- **Federation**: Multi-service GraphQL
- **Performance Monitoring**: Query analytics
- **Enhanced Subscriptions**: More filtering options
