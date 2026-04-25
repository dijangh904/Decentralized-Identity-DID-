const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const StellarSDK = require('stellar-sdk');

// Load environment variables
dotenv.config();

// Import routes
const didRoutes = require('./routes/did');
const credentialRoutes = require('./routes/credentials');
const batchRoutes = require('./routes/batch');
const sharingRoutes = require('./routes/credentialSharing');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stellar server
const server = new StellarSDK.Horizon.Server(
  process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
);

// Set network passphrase
StellarSDK.Network.useTestNetwork();
if (process.env.STELLAR_NETWORK === 'PUBLIC') {
  StellarSDK.Network.usePublicNetwork();
}

// Routes
app.use('/api/did', didRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/sharing', sharingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    network: process.env.STELLAR_NETWORK || 'TESTNET',
    horizon: process.env.STELLAR_HORIZON_URL,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Stellar DID Platform',
    version: '1.0.0',
    description: 'Decentralized Identity platform on Stellar network',
    endpoints: {
      did: '/api/did',
      credentials: '/api/credentials',
      batch: '/api/batch',
      sharing: '/api/sharing',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint was not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stellar DID Platform running on port ${PORT}`);
  console.log(`📡 Network: ${process.env.STELLAR_NETWORK || 'TESTNET'}`);
  console.log(`🌐 Horizon: ${process.env.STELLAR_HORIZON_URL}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

module.exports = app;
