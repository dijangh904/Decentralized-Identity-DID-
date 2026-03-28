const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import routes and services
const didRoutes = require('./routes/did');
const credentialRoutes = require('./routes/credentials');
const contractRoutes = require('./routes/contracts');
const authRoutes = require('./routes/auth');
const { logger, errorHandler } = require('./middleware');
const { connectDatabase } = require('./utils/database');
const { sanitizeQuery } = require('./middleware/inputValidation');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const GraphQLServer = require('./graphql/server');
const { WebSocketManager, EVENTS } = require('./websocket');

// Initialize Express app
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Initialize GraphQL Server (creates the shared HTTP server internally)
const graphqlServer = new GraphQLServer(app);

// Security middleware with comprehensive CSP headers
const cspDirectives = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'", 
      "'unsafe-inline'", 
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com"
    ],
    scriptSrc: [
      "'self'",
      "'unsafe-eval'", // Required for React development mode
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : [])
    ],
    imgSrc: [
      "'self'", 
      "data:", 
      "https:", 
      "blob:"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
      "data:"
    ],
    connectSrc: [
      "'self'",
      ...(process.env.NODE_ENV === 'development' ? ["ws:", "wss:"] : ["wss:"]),
      "https://*.stellar.org",
      "https://horizon-testnet.stellar.org",
      "https://horizon-mainnet.stellar.org"
    ],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  }
};

// Remove null directives for production
if (process.env.NODE_ENV === 'production') {
  Object.keys(cspDirectives.directives).forEach(key => {
    if (cspDirectives.directives[key] === null) {
      delete cspDirectives.directives[key];
    }
  });
}

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? cspDirectives : false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 100000 : 100,
});
app.use("/api", limiter);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization middleware
app.use(sanitizeQuery);

// Logging
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "stellar-did-backend",
    version: "1.0.0",
    network: process.env.STELLAR_NETWORK || "TESTNET",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api/v1/did", didRoutes);
app.use("/api/v1/credentials", credentialRoutes);
app.use("/api/v1/contracts", contractRoutes);
app.use("/api/v1/auth", authRoutes);

// Swagger Documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Stellar DID Backend API",
    version: "1.0.0",
    description: "Backend microservice for Stellar DID Platform",
    endpoints: {
      did: '/api/v1/did',
      credentials: '/api/v1/credentials',
      contracts: '/api/v1/contracts',
      auth: '/api/v1/auth',
      graphql: '/graphql',
      health: '/health',
      websocket: `ws://localhost:${PORT}/ws`,
    },
    documentation: '/api/docs',
    graphqlPlayground: `http://localhost:${PORT}/graphql`,
    websocket: `ws://localhost:${PORT}/ws`,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: "The requested endpoint was not found",
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown — close WebSocket connections before exiting
let wsManager = null;

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  if (wsManager) await wsManager.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  if (wsManager) await wsManager.close();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize GraphQL — this creates the shared HTTP server
    await graphqlServer.initialize();

    // Attach WebSocket to the same HTTP server GraphQL uses.
    // This is the critical step: one HTTP server, two upgrade handlers.
    // WebSocket connections arrive at ws://host/ws
    // GraphQL/REST connections arrive at http://host/...
    wsManager = new WebSocketManager(graphqlServer.httpServer);
    wsManager.initialize();

    // Expose wsManager so route handlers can broadcast events.
    // Usage in a route: req.app.get('wsManager').broadcast(EVENTS.DID_CREATED, { ... })
    app.set('wsManager', wsManager);
    app.set('wsEvents', EVENTS);

    // Start listening
    await graphqlServer.startServer(PORT);

    logger.info(`🚀 Stellar DID Backend running on port ${PORT}`);
    logger.info(`📡 Network: ${process.env.STELLAR_NETWORK || 'TESTNET'}`);
    logger.info(`🌐 REST API: http://localhost:${PORT}/api`);
    logger.info(`📊 GraphQL API: http://localhost:${PORT}/graphql`);
    logger.info(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
    logger.info(`📚 Health: http://localhost:${PORT}/health`);
    logger.info(`📖 Documentation: http://localhost:${PORT}/api/docs`);
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, EVENTS };