# JWT Refresh Token System Documentation

This document describes the comprehensive JWT refresh token rotation system implemented for the Stellar DID Backend, providing secure and persistent user authentication with automatic token rotation.

## Overview

The refresh token system addresses the security and usability issues of short-lived JWT access tokens while maintaining high security standards through token rotation, suspicious activity detection, and secure storage.

## Architecture

### Components

1. **User Model** (`src/models/User.js`)
   - User authentication data
   - Session management
   - Token version tracking
   - Security settings

2. **RefreshToken Model** (`src/models/RefreshToken.js`)
   - Secure token storage (hashed)
   - Token rotation tracking
   - Suspicious activity detection
   - Session metadata

3. **Auth Service** (`src/services/authService.js`)
   - Core authentication logic
   - Token rotation implementation
   - Security monitoring
   - Session management

4. **Auth Routes** (`src/routes/auth.js`)
   - RESTful API endpoints
   - Request validation
   - Rate limiting
   - Cookie management

5. **Auth Middleware** (`src/middleware/authMiddleware.js`)
   - JWT validation
   - Role-based authorization
   - Security checks

## Features

### 1. Token Rotation
- **Automatic Rotation**: Each refresh token use generates a new token
- **Parent-Child Tracking**: Maintains token lineage for audit trails
- **Old Token Revocation**: Previous tokens are immediately invalidated

### 2. Security Monitoring
- **Suspicious Activity Detection**: IP changes, device changes, rapid usage
- **Risk Scoring**: Calculates risk scores based on anomalous behavior
- **Automatic Revocation**: High-risk tokens are automatically revoked
- **Security Event Logging**: All security events are logged for monitoring

### 3. Session Management
- **Multi-Device Support**: Users can maintain multiple active sessions
- **Session Tracking**: Device info, IP addresses, last activity
- **Selective Revocation**: Revoke specific sessions or all sessions
- **Session Statistics**: Monitor active sessions and usage patterns

### 4. Secure Storage
- **Token Hashing**: Refresh tokens are stored as SHA-256 hashes
- **Database Security**: Tokens are never stored in plain text
- **Automatic Cleanup**: Expired tokens are automatically removed
- **TTL Indexes**: Database automatically cleans up expired tokens

## API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user with email/password or wallet address.

```bash
# Email/Password Registration
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "profile": {
      "firstName": "John",
      "lastName": "Doe"
    }
  }'

# Wallet Registration
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI",
    "profile": {
      "firstName": "Alice",
      "lastName": "Wallet"
    }
  }'
```

#### POST /api/v1/auth/login
Authenticate user and receive access and refresh tokens.

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "user@example.com",
    "password": "securePassword123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "roles": ["USER"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900000,
      "tokenType": "Bearer"
    },
    "sessionId": "session_uuid"
  }
}
```

#### POST /api/v1/auth/refresh
Refresh access token using refresh token.

```bash
# Using cookie (recommended)
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Cookie: refreshToken=your_refresh_token"

# Using request body
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token"
  }'
```

#### POST /api/v1/auth/logout
Logout and revoke refresh token.

```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Cookie: refreshToken=your_refresh_token"
```

### Session Management Endpoints

#### GET /api/v1/auth/sessions
Get all active sessions for the authenticated user.

```bash
curl -X GET http://localhost:3001/api/v1/auth/sessions \
  -H "Authorization: Bearer your_access_token"
```

#### DELETE /api/v1/auth/sessions/:sessionId
Revoke a specific session.

```bash
curl -X DELETE http://localhost:3001/api/v1/auth/sessions/session_uuid \
  -H "Authorization: Bearer your_access_token"
```

#### POST /api/v1/auth/logout-all
Logout from all devices and revoke all tokens.

```bash
curl -X POST http://localhost:3001/api/v1/auth/logout-all \
  -H "Authorization: Bearer your_access_token"
```

### Security Endpoints

#### POST /api/v1/auth/change-password
Change user password and revoke all tokens.

```bash
curl -X POST http://localhost:3001/api/v1/auth/change-password \
  -H "Authorization: Bearer your_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newPassword456"
  }'
```

## Security Features

### Token Rotation Process

1. **User Request**: Client sends refresh token to `/api/v1/auth/refresh`
2. **Token Validation**: Server validates token signature and expiration
3. **Security Check**: Analyze request for suspicious activity
4. **Token Rotation**: Generate new refresh token, revoke old one
5. **Response**: Return new access token and refresh token

### Suspicious Activity Detection

The system monitors for:
- **IP Address Changes**: Different IP from original login
- **Device Changes**: Different browser/device fingerprint
- **Rapid Usage**: Multiple requests in short time period
- **Geographic Anomalies**: Impossible travel times
- **Time Anomalies**: Unusual access patterns

### Risk Scoring

Risk scores are calculated (0-100):
- **0-30**: Low risk - normal operation
- **31-70**: Medium risk - increased monitoring
- **71-100**: High risk - automatic token revocation

### Security Events

All security events are logged with:
- Timestamp and correlation ID
- User and session information
- Risk factors and scores
- IP address and user agent
- Action taken (revocation, warning, etc.)

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-for-access-tokens
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security Settings
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=7200000          # 2 hours in milliseconds
SESSION_TIMEOUT=1800000    # 30 minutes in milliseconds

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_ATTEMPTS=5    # 5 attempts per window
REFRESH_RATE_LIMIT_MAX=10    # 10 refresh attempts per window

# Database
MONGODB_URI=mongodb://localhost:27017/stellar-did
MONGODB_TEST_URI=mongodb://localhost:27017/stellar-did-test
```

## Best Practices

### Client Implementation

1. **Secure Storage**: Store refresh tokens in HTTP-only cookies
2. **Automatic Refresh**: Implement automatic token refresh before expiry
3. **Error Handling**: Handle token revocation and expiration gracefully
4. **Security Headers**: Use secure, sameSite, and httpOnly cookie flags

### Token Usage

```javascript
// Example client-side token refresh
async function refreshAccessToken() {
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include' // Include cookies
    });
    
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.tokens.accessToken);
      return data.tokens.accessToken;
    } else {
      // Handle refresh failure - redirect to login
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    window.location.href = '/login';
  }
}

// API request with automatic retry
async function makeAuthenticatedRequest(url, options = {}) {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers
    }
  });
  
  if (response.status === 401) {
    // Token expired, try refresh
    const newToken = await refreshAccessToken();
    
    // Retry request with new token
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${newToken}`,
        ...options.headers
      }
    });
  }
  
  return response;
}
```

### Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Cookie Security**: Use httpOnly, secure, and sameSite flags
3. **Token Expiration**: Keep access tokens short-lived (15 minutes)
4. **Regular Cleanup**: Schedule periodic token cleanup
5. **Monitoring**: Monitor security events and anomalies
6. **User Notifications**: Notify users of suspicious activity

## Testing

### Running Tests

```bash
# Run all authentication tests
npm test -- tests/auth.test.js

# Run specific test suite
npm test -- --testNamePattern="Token Refresh"

# Run with coverage
npm test -- --coverage tests/auth.test.js
```

### Test Coverage

The test suite covers:
- User registration and login
- Token refresh and rotation
- Session management
- Security features
- Rate limiting
- Error handling
- Database operations

## Monitoring and Maintenance

### Token Statistics

Monitor token usage with the statistics endpoint:

```bash
curl -X GET http://localhost:3001/api/v1/auth/stats \
  -H "Authorization: Bearer admin_access_token"
```

### Cleanup Operations

Schedule periodic cleanup of expired tokens:

```bash
# Manual cleanup (admin only)
curl -X POST http://localhost:3001/api/v1/auth/cleanup \
  -H "Authorization: Bearer admin_access_token"

# Automated cleanup (cron job)
0 2 * * * curl -X POST http://localhost:3001/api/v1/auth/cleanup -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Security Monitoring

Monitor for:
- High failed login attempt rates
- Unusual IP address patterns
- Rapid token refresh requests
- Geographic anomalies
- Device fingerprint changes

## Troubleshooting

### Common Issues

1. **Token Not Found**: Check if refresh token cookie is being sent
2. **Token Expired**: Implement automatic refresh before expiry
3. **Session Revoked**: Check for suspicious activity triggers
4. **Rate Limiting**: Verify rate limit configuration
5. **Database Issues**: Check MongoDB connection and indexes

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Performance Optimization

1. **Database Indexes**: Ensure proper indexes on token fields
2. **Connection Pooling**: Use MongoDB connection pooling
3. **Caching**: Cache user data to reduce database queries
4. **Cleanup Scheduling**: Schedule cleanup during low-traffic periods

## Migration Guide

### From Basic JWT

1. **Update Dependencies**: Add required packages
2. **Database Migration**: Create User and RefreshToken collections
3. **Update Client Code**: Implement refresh token handling
4. **Update API Endpoints**: Add refresh token endpoints
5. **Update Middleware**: Use new authentication middleware
6. **Testing**: Update test cases for new authentication flow

### Backward Compatibility

The system maintains backward compatibility:
- Existing JWT tokens continue to work until expiry
- Gradual migration to refresh token system
- Fallback authentication for legacy clients

## Future Enhancements

1. **Biometric Authentication**: Add fingerprint/face ID support
2. **Hardware Tokens**: Support for YubiKey and other hardware tokens
3. **Federated Identity**: OAuth2 and OpenID Connect integration
4. **Advanced Analytics**: Machine learning for anomaly detection
5. **Mobile Push Notifications**: Real-time security alerts
6. **Blockchain Integration**: DID-based authentication

## Support

For issues or questions about the refresh token system:

1. Check this documentation
2. Review the test cases for examples
3. Check application logs for error details
4. Monitor security events for issues
5. Contact the development team for support
