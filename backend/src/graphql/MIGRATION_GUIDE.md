# REST to GraphQL Migration Guide

## Overview

This guide helps developers migrate from the REST API to the new GraphQL API, providing step-by-step instructions and code examples for a smooth transition.

## Why Migrate to GraphQL?

### Benefits Over REST
- **Single Endpoint**: All operations through `/graphql`
- **Flexible Queries**: Request only the data you need
- **No Over-fetching**: Eliminate unnecessary data transfer
- **No Under-fetching**: Get all required data in one request
- **Type Safety**: Strongly typed schema with validation
- **Real-time Updates**: WebSocket subscriptions
- **Better Developer Experience**: Interactive playground

## Migration Strategy

### Phase 1: Parallel Usage
- Keep existing REST API calls
- Add GraphQL for new features
- Test GraphQL endpoints alongside REST

### Phase 2: Gradual Migration
- Replace simple read operations first
- Move complex queries to GraphQL
- Update mutations one by one

### Phase 3: Full Migration
- Remove all REST API dependencies
- Optimize GraphQL queries
- Implement subscriptions for real-time features

## Endpoint Mapping

### DID Operations

| REST Endpoint | GraphQL Query/Mutation | Status |
|---------------|------------------------|--------|
| `GET /api/v1/did/:did` | `query { did(did: "...") }` | ✅ Direct replacement |
| `GET /api/v1/did` | `query { dids(...) }` | ✅ Enhanced filtering |
| `POST /api/v1/did` | `mutation { createDID(...) }` | ✅ Direct replacement |
| `PUT /api/v1/did/:did` | `mutation { updateDID(...) }` | ✅ Direct replacement |
| `DELETE /api/v1/did/:did` | `mutation { deactivateDID(...) }` | ✅ Direct replacement |

### Credential Operations

| REST Endpoint | GraphQL Query/Mutation | Status |
|---------------|------------------------|--------|
| `GET /api/v1/credentials/:id` | `query { credential(id: "...") }` | ✅ Direct replacement |
| `GET /api/v1/credentials` | `query { credentials(...) }` | ✅ Enhanced filtering |
| `POST /api/v1/credentials` | `mutation { issueCredential(...) }` | ✅ Direct replacement |
| `DELETE /api/v1/credentials/:id` | `mutation { revokeCredential(...) }` | ✅ Direct replacement |

### Stellar Operations

| REST Endpoint | GraphQL Query/Mutation | Status |
|---------------|------------------------|--------|
| `GET /api/v1/stellar/account/:address` | `query { stellarAccount(address: "...") }` | ✅ Direct replacement |
| `GET /api/v1/stellar/transactions` | `query { transactions(...) }` | ✅ Enhanced filtering |
| `POST /api/v1/stellar/transaction` | `mutation { createTransaction(...) }` | ✅ Direct replacement |

## Code Examples

### Before: REST API

```javascript
// Fetch DID with REST
async function getDID(did) {
  try {
    const response = await fetch(`/api/v1/did/${did}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching DID:', error);
    throw error;
  }
}

// Fetch multiple DIDs
async function listDIDs(owner, active) {
  try {
    const params = new URLSearchParams();
    if (owner) params.append('owner', owner);
    if (active !== undefined) params.append('active', active);
    
    const response = await fetch(`/api/v1/did?${params}`);
    const data = await response.json();
    
    return data.dids || [];
  } catch (error) {
    console.error('Error listing DIDs:', error);
    throw error;
  }
}

// Create DID
async function createDID(didData) {
  try {
    const response = await fetch('/api/v1/did', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(didData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message);
    }
    
    return data;
  } catch (error) {
    console.error('Error creating DID:', error);
    throw error;
  }
}
```

### After: GraphQL API

```javascript
// GraphQL client setup
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:3001/graphql',
  cache: new InMemoryCache(),
  headers: {
    Authorization: `Bearer ${token}`
  }
});

// Fetch DID with GraphQL
const GET_DID = gql`
  query GetDID($did: String!) {
    did(did: $did) {
      id
      did
      owner
      publicKey
      created
      updated
      active
      serviceEndpoint
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
`;

async function getDID(did) {
  try {
    const { data, errors } = await client.query({
      query: GET_DID,
      variables: { did },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return data.did;
  } catch (error) {
    console.error('Error fetching DID:', error);
    throw error;
  }
}

// Fetch multiple DIDs with enhanced filtering
const LIST_DIDS = gql`
  query ListDIDs($owner: String, $active: Boolean, $limit: Int, $offset: Int) {
    dids(owner: $owner, active: $active, limit: $limit, offset: $offset) {
      id
      did
      owner
      created
      active
      serviceEndpoint
    }
    didCount(active: $active)
  }
`;

async function listDIDs(owner, active, limit = 10, offset = 0) {
  try {
    const { data, errors } = await client.query({
      query: LIST_DIDS,
      variables: { owner, active, limit, offset },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return {
      dids: data.dids,
      total: data.didCount
    };
  } catch (error) {
    console.error('Error listing DIDs:', error);
    throw error;
  }
}

// Create DID with GraphQL
const CREATE_DID = gql`
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
      publicKey
      created
      active
    }
  }
`;

async function createDID(didData) {
  try {
    const { data, errors } = await client.mutate({
      mutation: CREATE_DID,
      variables: { input: didData },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return data.createDID;
  } catch (error) {
    console.error('Error creating DID:', error);
    throw error;
  }
}
```

## Advanced Features

### Real-time Subscriptions

```javascript
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

function subscribeToDIDCreated(owner, callback) {
  const subscription = client.subscribe({
    query: DID_CREATED_SUBSCRIPTION,
    variables: { owner }
  }).subscribe({
    next: ({ data }) => callback(data.didCreated),
    error: (error) => console.error('Subscription error:', error)
  });
  
  return subscription;
}

// Usage
const subscription = subscribeToDIDCreated('owner-address', (did) => {
  console.log('New DID created:', did);
});

// Unsubscribe when done
subscription.unsubscribe();
```

### Batch Operations

```javascript
// Batch revoke credentials
const BATCH_REVOKE = gql`
  mutation BatchRevokeCredentials($ids: [ID!]!) {
    batchRevokeCredentials(ids: $ids) {
      successful
      failed
      errors
    }
  }
`;

async function batchRevokeCredentials(ids) {
  try {
    const { data, errors } = await client.mutate({
      mutation: BATCH_REVOKE,
      variables: { ids },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return data.batchRevokeCredentials;
  } catch (error) {
    console.error('Error batch revoking credentials:', error);
    throw error;
  }
}
```

### Optimized Queries

```javascript
// Request only needed fields
const MINIMAL_DID = gql`
  query GetMinimalDID($did: String!) {
    did(did: $did) {
      id
      did
      active
    }
  }
`;

// Complex query with relationships
const DID_WITH_CREDENTIALS = gql`
  query GetDIDWithCredentials($did: String!) {
    did(did: $did) {
      id
      did
      owner
      active
      verificationMethods {
        id
        type
        publicKeyBase58
      }
    }
    credentials(subject: $did, revoked: false) {
      id
      issuer
      credentialType
      issued
      expires
    }
  }
`;
```

## Error Handling

### REST Error Handling
```javascript
try {
  const response = await fetch('/api/v1/did/invalid-did');
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  
  return data;
} catch (error) {
  console.error('REST Error:', error);
  throw error;
}
```

### GraphQL Error Handling
```javascript
try {
  const { data, errors } = await client.query({
    query: GET_DID,
    variables: { did: 'invalid-did' },
    errorPolicy: 'all'
  });
  
  if (errors && errors.length > 0) {
    const error = errors[0];
    throw new Error(error.message);
  }
  
  if (!data.did) {
    throw new Error('DID not found');
  }
  
  return data.did;
} catch (error) {
  console.error('GraphQL Error:', error);
  throw error;
}
```

## Performance Optimization

### Caching Strategy
```javascript
// Configure Apollo Client cache
const client = new ApolloClient({
  uri: 'http://localhost:3001/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          did: {
            merge: true,
            cache: true
          },
          dids: {
            merge: false,
            cache: true
          }
        }
      },
      DIDDocument: {
        keyFields: ["id"],
        fields: {
          verificationMethods: {
            merge: false
          },
          services: {
            merge: false
          }
        }
      }
    }
  })
});
```

### Query Optimization
```javascript
// Use field selection to reduce payload
const OPTIMIZED_QUERY = gql`
  query GetDIDList($limit: Int) {
    dids(limit: $limit) {
      id  # Only request ID field
      did
      active
    }
  }
`;

// Use pagination for large datasets
const PAGINATED_QUERY = gql`
  query GetDIDList($limit: Int, $offset: Int) {
    dids(limit: $limit, offset: $offset) {
      id
      did
      owner
      created
    }
    didCount
  }
`;
```

## Testing Migration

### Unit Tests
```javascript
// Test GraphQL queries
import { ApolloClient, InMemoryCache } from '@apollo/client';

describe('DID GraphQL Operations', () => {
  let client;
  
  beforeEach(() => {
    client = new ApolloClient({
      uri: 'http://localhost:3001/graphql',
      cache: new InMemoryCache()
    });
  });
  
  it('should fetch DID', async () => {
    const { data } = await client.query({
      query: GET_DID,
      variables: { did: 'test-did' }
    });
    
    expect(data.did).toBeDefined();
    expect(data.did.id).toBe('test-did');
  });
});
```

### Integration Tests
```javascript
// Test migration compatibility
describe('REST to GraphQL Migration', () => {
  it('should return same data for DID operations', async () => {
    // Fetch with REST
    const restResponse = await fetch('/api/v1/did/test-did');
    const restData = await restResponse.json();
    
    // Fetch with GraphQL
    const { data: graphqlData } = await client.query({
      query: GET_DID,
      variables: { did: 'test-did' }
    });
    
    // Compare results
    expect(restData.id).toBe(graphqlData.did.id);
    expect(restData.did).toBe(graphqlData.did.did);
  });
});
```

## Checklist

### Before Migration
- [ ] Review existing REST API usage
- [ ] Identify critical endpoints
- [ ] Set up GraphQL client
- [ ] Create migration plan
- [ ] Prepare test suite

### During Migration
- [ ] Implement GraphQL queries for read operations
- [ ] Add GraphQL mutations for write operations
- [ ] Test data consistency
- [ ] Update error handling
- [ ] Monitor performance

### After Migration
- [ ] Remove REST API dependencies
- [ ] Optimize GraphQL queries
- [ ] Implement subscriptions
- [ ] Update documentation
- [ ] Train team on GraphQL

## Troubleshooting

### Common Issues

#### Query Complexity Errors
```
Error: Query complexity limit exceeded
```
**Solution**: Break down large queries or request fewer fields.

#### Authentication Issues
```
Error: Authentication required
```
**Solution**: Ensure JWT token is included in Authorization header.

#### Subscription Connection Issues
```
Error: WebSocket connection failed
```
**Solution**: Check WebSocket configuration and network connectivity.

#### Cache Inconsistency
**Issue**: Stale data in cache
**Solution**: Implement cache invalidation strategies or use cache policies.

### Performance Issues

#### Slow Queries
- Use field selection to reduce payload
- Implement pagination
- Add appropriate caching
- Monitor query complexity

#### Memory Issues
- Clear cache periodically
- Use cache policies wisely
- Monitor memory usage

## Support

For migration assistance:
1. Review the GraphQL schema documentation
2. Use the GraphQL Playground for testing
3. Check the error messages for detailed information
4. Contact the development team with specific issues

## Timeline

### Week 1-2: Preparation
- Set up GraphQL client
- Create basic queries
- Test simple operations

### Week 3-4: Core Migration
- Migrate read operations
- Implement mutations
- Update error handling

### Week 5-6: Advanced Features
- Add subscriptions
- Optimize performance
- Implement caching

### Week 7-8: Finalization
- Remove REST dependencies
- Update documentation
- Team training

This migration guide provides a comprehensive approach to transitioning from REST to GraphQL while maintaining application stability and performance.
