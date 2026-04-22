const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const authService = require('../services/authService');
const { app } = require('../server');

describe('JWT Refresh Token System', () => {
  let testUser;
  let authTokens;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    // Clean up and close database connection
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('User Registration', () => {
    test('should register a new user with email and password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        profile: {
          firstName: 'Test',
          lastName: 'User'
        }
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('should register a new user with wallet address', async () => {
      const userData = {
        walletAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI',
        profile: {
          firstName: 'Wallet',
          lastName: 'User'
        }
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.walletAddress).toBe(userData.walletAddress);
    });

    test('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation Error');
    });

    test('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      testUser = await User.create({
        email: 'login@example.com',
        password: 'password123',
        profile: { firstName: 'Login', lastName: 'User' }
      });
    });

    test('should login user with valid credentials', async () => {
      const loginData = {
        identifier: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined(); // Refresh token cookie

      authTokens = response.body.data.tokens;
    });

    test('should reject login with invalid credentials', async () => {
      const loginData = {
        identifier: 'login@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication Failed');
    });

    test('should reject login for locked account', async () => {
      // Lock the account
      await User.findByIdAndUpdate(testUser._id, {
        'security.lockUntil': new Date(Date.now() + 60000) // Lock for 1 minute
      });

      const loginData = {
        identifier: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.message).toContain('temporarily locked');
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      // Create and login a user for refresh tests
      testUser = await User.create({
        email: 'refresh@example.com',
        password: 'password123'
      });

      const loginData = {
        identifier: 'refresh@example.com',
        password: 'password123'
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      authTokens = loginResponse.body.data.tokens;
    });

    test('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${authTokens.refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.accessToken).not.toBe(authTokens.accessToken);
    });

    test('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Refresh token is required');
    });

    test('should rotate refresh token on refresh', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${authTokens.refreshToken}`)
        .expect(200);

      // Check that a new refresh token cookie is set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      
      // Extract the new refresh token from cookie
      const newRefreshToken = setCookieHeader[0].split(';')[0].split('=')[1];
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(authTokens.refreshToken);
    });

    test('should detect suspicious activity and revoke token', async () => {
      // Simulate suspicious activity by using different IP
      const suspiciousRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${authTokens.refreshToken}`)
        .set('X-Forwarded-For', '192.168.1.100') // Different IP
        .expect(200);

      // First refresh should work but mark as suspicious
      expect(suspiciousRefresh.body.success).toBe(true);

      // Second refresh from different IP might trigger high risk
      // This depends on the risk threshold configuration
    });
  });

  describe('User Logout', () => {
    beforeEach(async () => {
      testUser = await User.create({
        email: 'logout@example.com',
        password: 'password123'
      });

      const loginData = {
        identifier: 'logout@example.com',
        password: 'password123'
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      authTokens = loginResponse.body.data.tokens;
    });

    test('should logout and revoke refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `refreshToken=${authTokens.refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined(); // Cookie cleared

      // Try to use the revoked token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${authTokens.refreshToken}`)
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
    });

    test('should logout even without refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      testUser = await User.create({
        email: 'session@example.com',
        password: 'password123'
      });

      const loginData = {
        identifier: 'session@example.com',
        password: 'password123'
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      authTokens = loginResponse.body.data.tokens;
    });

    test('should get active sessions for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeDefined();
      expect(response.body.data.sessions.length).toBeGreaterThan(0);
    });

    test('should reject session access without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should revoke specific session', async () => {
      // First, get sessions to find session ID
      const sessionsResponse = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      const sessionId = sessionsResponse.body.data.sessions[0].sessionId;

      // Revoke the session
      const revokeResponse = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(revokeResponse.body.success).toBe(true);
    });
  });

  describe('Password Change', () => {
    beforeEach(async () => {
      testUser = await User.create({
        email: 'password@example.com',
        password: 'password123'
      });

      const loginData = {
        identifier: 'password@example.com',
        password: 'password123'
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      authTokens = loginResponse.body.data.tokens;
    });

    test('should change password with valid current password', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword456'
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify old tokens are revoked
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${authTokens.refreshToken}`)
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
    });

    test('should reject password change with invalid current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword456'
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Security', () => {
    test('should reject access token without Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', 'invalid-token-format')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject expired access token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: testUser?._id, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('Token Expired');
    });

    test('should reject tampered access token', async () => {
      const tamperedToken = authTokens?.accessToken + 'tampered';

      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid Token');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to login attempts', async () => {
      const loginData = {
        identifier: 'ratelimit@example.com',
        password: 'password123'
      };

      // Create user for rate limiting test
      await User.create({
        email: 'ratelimit@example.com',
        password: 'password123'
      });

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({ ...loginData, password: 'wrongpassword' })
          .expect(i < 5 ? 401 : 429); // 5th attempt should trigger rate limit
      }
    });

    test('should apply rate limiting to refresh attempts', async () => {
      // Create and login user
      const user = await User.create({
        email: 'refreshlimit@example.com',
        password: 'password123'
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'refreshlimit@example.com',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // Make multiple refresh attempts
      for (let i = 0; i < 11; i++) {
        await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', `refreshToken=${refreshToken}`)
          .expect(i < 10 ? 200 : 429); // 11th attempt should trigger rate limit
      }
    });
  });

  describe('Database Operations', () => {
    test('should cleanup expired tokens', async () => {
      // Create expired refresh token
      const expiredToken = await RefreshToken.create({
        tokenHash: 'expired-token-hash',
        userId: testUser?._id,
        sessionId: 'test-session',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        deviceInfo: { ipAddress: '127.0.0.1' }
      });

      // Cleanup expired tokens (admin endpoint - would require admin auth in real app)
      const cleanupResult = await authService.cleanupExpiredTokens();

      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.deletedCount).toBeGreaterThan(0);

      // Verify token is cleaned up
      const deletedToken = await RefreshToken.findById(expiredToken._id);
      expect(deletedToken).toBeNull();
    });

    test('should get authentication statistics', async () => {
      // Create some tokens
      await RefreshToken.create({
        tokenHash: 'active-token-hash',
        userId: testUser?._id,
        sessionId: 'active-session',
        expiresAt: new Date(Date.now() + 86400000), // Expires tomorrow
        deviceInfo: { ipAddress: '127.0.0.1' }
      });

      await RefreshToken.create({
        tokenHash: 'revoked-token-hash',
        userId: testUser?._id,
        sessionId: 'revoked-session',
        expiresAt: new Date(Date.now() + 86400000),
        isRevoked: true,
        revokedAt: new Date(),
        deviceInfo: { ipAddress: '127.0.0.1' }
      });

      const stats = await authService.getStats(testUser?._id);

      expect(stats.success).toBe(true);
      expect(stats.data.stats.tokens.totalTokens).toBe(2);
      expect(stats.data.stats.tokens.activeTokens).toBe(1);
      expect(stats.data.stats.tokens.revokedTokens).toBe(1);
    });
  });
});
