const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes and services
const didRoutes = require('./routes/did');
const credentialRoutes = require('./routes/credentials');
const contractRoutes = require('./routes/contracts');
const authRoutes = require('./routes/auth');
const { logger, errorHandler, smartRateLimiter, getRateLimitStatus } = require('./middleware');
const { connectDatabase } = require('./utils/database');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Initialize Express app
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// Smart rate limiting with different limits for different operations
app.use('/api', smartRateLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'stellar-did-backend',
    version: '1.0.0',
    network: process.env.STELLAR_NETWORK || 'TESTNET',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/v1/did', didRoutes);
app.use('/api/v1/credentials', credentialRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/auth', authRoutes);

// Swagger Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Stellar DID Backend API',
    version: '1.0.0',
    description: 'Backend microservice for Stellar DID Platform',
    endpoints: {
      did: '/api/v1/did',
      credentials: '/api/v1/credentials',
      contracts: '/api/v1/contracts',
      auth: '/api/v1/auth',
      health: '/health',
      rateLimit: '/api/rate-limit/status'
    },
    documentation: '/api/docs'
  });
});

// Rate limiting status endpoint
app.get('/api/rate-limit/status', async (req, res) => {
  try {
    const status = await getRateLimitStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status',
      message: error.message
    });
  }
});


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint was not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    app.listen(PORT, () => {
      logger.info(`🚀 Stellar DID Backend running on port ${PORT}`);
      logger.info(`📡 Network: ${process.env.STELLAR_NETWORK || 'TESTNET'}`);
      logger.info(`🌐 API: http://localhost:${PORT}/api`);
      logger.info(`📚 Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
