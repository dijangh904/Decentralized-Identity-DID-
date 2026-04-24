# Contract Rate Limiting Implementation

This document describes the enhanced rate limiting system implemented for the Decentralized Identity DID platform to prevent spam and abuse of critical operations.

## Overview

The rate limiting system provides time-based rate limiting for different types of operations with varying levels of strictness based on the cost and criticality of the operation.

## Features

### 1. Tiered Rate Limiting
- **General API**: Standard rate limiting for general operations
- **Contract Reads**: Moderate rate limiting for read operations
- **Contract Writes**: Stricter rate limiting for write operations
- **Critical Operations**: Very strict rate limiting for high-cost operations

### 2. Redis-Based Distributed Rate Limiting
- Supports distributed deployments
- Automatic fallback to memory store if Redis is unavailable
- Configurable Redis connection with retry strategy

### 3. Environment-Based Configuration
- All rate limits configurable via environment variables
- Dynamic retry-after calculations
- Easy adjustment for different environments

### 4. Smart Route Detection
- Automatic detection of operation types based on HTTP method and path
- Different limits for different endpoints without manual configuration

### 5. Enhanced Error Responses
- Standardized error format
- Rate limit headers in all responses
- Clear retry-after information

## Rate Limits

### General API Operations
- **Window**: 15 minutes (configurable)
- **Limit**: 100 requests per window
- **Use Case**: General API access, health checks, documentation

### Contract Read Operations
- **Window**: 5 minutes (configurable)
- **Limit**: 50 requests per window
- **Use Case**: Getting DID documents, retrieving credentials, account information

### Contract Write Operations
- **Window**: 10 minutes (configurable)
- **Limit**: 10 requests per window
- **Use Case**: Updating DIDs, revoking credentials

### Critical Operations

#### Contract Deployment
- **Window**: 1 hour (configurable)
- **Limit**: 3 deployments per hour
- **Use Case**: Deploying new DID registry contracts

#### DID Registration
- **Window**: 5 minutes (configurable)
- **Limit**: 5 registrations per window
- **Use Case**: Registering new DIDs on the blockchain

#### Credential Issuance
- **Window**: 5 minutes (configurable)
- **Limit**: 15 credentials per window
- **Use Case**: Issuing new verifiable credentials

#### Account Creation
- **Window**: 1 hour (configurable)
- **Limit**: 10 accounts per hour
- **Use Case**: Creating new Stellar accounts

#### Account Funding
- **Window**: 1 hour (configurable)
- **Limit**: 20 funding requests per hour
- **Use Case**: Funding testnet accounts

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
RATE_LIMIT_ENABLE_REDIS=true

# General Rate Limiting
RATE_LIMIT_GENERAL_WINDOW_MS=900000
RATE_LIMIT_GENERAL_MAX=100

# Contract Read Rate Limiting
RATE_LIMIT_CONTRACT_READ_WINDOW_MS=300000
RATE_LIMIT_CONTRACT_READ_MAX=50

# Contract Write Rate Limiting
RATE_LIMIT_CONTRACT_WRITE_WINDOW_MS=600000
RATE_LIMIT_CONTRACT_WRITE_MAX=10

# Critical Operations
RATE_LIMIT_DEPLOY_CONTRACT_WINDOW_MS=3600000
RATE_LIMIT_DEPLOY_CONTRACT_MAX=3

RATE_LIMIT_REGISTER_DID_WINDOW_MS=300000
RATE_LIMIT_REGISTER_DID_MAX=5

RATE_LIMIT_ISSUE_CREDENTIAL_WINDOW_MS=300000
RATE_LIMIT_ISSUE_CREDENTIAL_MAX=15

RATE_LIMIT_CREATE_ACCOUNT_WINDOW_MS=3600000
RATE_LIMIT_CREATE_ACCOUNT_MAX=10

RATE_LIMIT_FUND_ACCOUNT_WINDOW_MS=3600000
RATE_LIMIT_FUND_ACCOUNT_MAX=20
```

## Implementation Details

### Middleware Architecture

The rate limiting system uses a layered middleware approach:

1. **Smart Rate Limiter**: Automatically detects operation types and applies appropriate limits
2. **Specific Limiters**: Individual limiters for different operation types
3. **Redis Store**: Distributed rate limiting with memory fallback
4. **Configuration**: Environment-based configuration with defaults

### Key Components

#### rateLimiter.js
- Main rate limiting middleware
- Redis integration
- Configuration management
- Error handling and logging

#### Smart Route Detection
```javascript
// Example of smart detection logic
if (path.includes('/deploy')) {
  return limiters.deployContract(req, res, next);
} else if (path.includes('/register-did')) {
  return limiters.registerDID(req, res, next);
}
```

#### Redis Integration
```javascript
// Redis store configuration
const limiterConfig = {
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
    resetExpiryOnChange: true
  })
};
```

### Response Headers

All API responses include rate limit headers:

- `X-RateLimit-Limit`: Maximum requests allowed in the current window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Time when the rate limit window resets (Unix timestamp)

### Error Response Format

```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Rate limit exceeded for contract deployments",
  "retryAfter": "1 hour"
}
```

## Monitoring and Logging

### Logging Events

- Rate limit exceeded events with IP, path, and user agent
- Redis connection events
- Rate limit reset events
- Configuration changes

### Monitoring Endpoints

The system provides monitoring capabilities:

```javascript
// Get rate limit status
const status = await getRateLimitStatus();

// Reset rate limits for specific user/IP (admin)
await resetRateLimit(userKey);
```

## Testing

### Unit Tests
- Rate limit enforcement
- Header verification
- Error response format
- Redis integration

### Integration Tests
- Multi-instance rate limiting
- Different IP handling
- Health check exemption
- Configuration changes

### Load Testing
Recommended load testing scenarios:

1. **Normal Load**: Test within rate limits
2. **Boundary Testing**: Test at rate limit boundaries
3. **Stress Testing**: Test rate limit enforcement
4. **Distributed Testing**: Test with multiple instances

## Security Considerations

### Prevention of Abuse

1. **IP-Based Limiting**: Primary mechanism for preventing abuse
2. **User-Based Limiting**: Enhanced limiting for authenticated users
3. **Progressive Limiting**: Stricter limits for repeat offenders
4. **Operation Cost Awareness**: Higher limits for cheaper operations

### Bypass Prevention

1. **Header Validation**: Proper handling of X-Forwarded-For headers
2. **Key Generation**: Robust key generation for different user types
3. **Redis Consistency**: Ensuring distributed consistency
4. **Memory Fallback**: Graceful degradation if Redis fails

## Performance Considerations

### Redis Performance
- Connection pooling
- Pipeline support
- Memory optimization
- Expiration management

### Memory Store Performance
- LRU eviction
- Memory usage monitoring
- Cleanup processes
- Efficient key storage

### Scalability
- Horizontal scaling support
- Load balancer compatibility
- Database connection management
- Resource utilization

## Troubleshooting

### Common Issues

1. **Redis Connection Failures**
   - Check Redis server status
   - Verify connection URL
   - Monitor network connectivity

2. **Rate Limits Too Strict**
   - Review configuration values
   - Monitor usage patterns
   - Adjust environment variables

3. **Headers Not Present**
   - Verify middleware order
   - Check response processing
   - Ensure proper configuration

### Debug Information

Enable debug logging for rate limiting:

```bash
DEBUG=rate-limiting:*
```

## Future Enhancements

### Planned Features

1. **Dynamic Rate Limiting**: AI-driven limit adjustment
2. **User Tier Support**: Different limits for different user tiers
3. **Geographic Limiting**: Region-based rate limiting
4. **Anomaly Detection**: Automatic abuse detection
5. **Rate Limit Analytics**: Detailed usage analytics

### Extension Points

The system is designed for easy extension:

1. **Custom Limiters**: Add new operation-specific limiters
2. **Alternative Stores**: Support for other distributed stores
3. **Custom Key Generation**: Advanced user identification
4. **Custom Handlers**: Custom error responses

## Migration Guide

### From Basic Rate Limiting

1. Update dependencies
2. Add environment variables
3. Replace middleware
4. Update configuration
5. Test implementation

### Configuration Migration

```javascript
// Old configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// New configuration
app.use('/api', smartRateLimiter);
```

## Conclusion

This enhanced rate limiting system provides comprehensive protection against spam and abuse while maintaining flexibility and performance. The tiered approach ensures that critical operations are appropriately protected without impacting legitimate usage patterns.

The system is designed to be:
- **Secure**: Prevents abuse and spam
- **Scalable**: Works in distributed environments
- **Flexible**: Configurable via environment variables
- **Observable**: Comprehensive logging and monitoring
- **Maintainable**: Clean architecture and documentation
