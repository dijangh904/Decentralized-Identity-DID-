const { ApolloServer } = require('apollo-server-express');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { createServer } = require('http');
const express = require('express');
const { logger } = require('../middleware');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');

class GraphQLServer {
  constructor(app) {
    this.app = app;
    this.httpServer = null;
    this.apolloServer = null;
  }

  async initialize() {
    try {
      // Create HTTP server for GraphQL subscriptions.
      // This is the single HTTP server the whole application uses —
      // Express, Apollo, and WebSocket all share it.
      this.httpServer = createServer(this.app);

      // Create Apollo Server
      this.apolloServer = new ApolloServer({
        typeDefs,
        resolvers,
        plugins: [
          ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),
          {
            requestDidStart() {
              return {
                didResolveOperation(requestContext) {
                  logger.info('GraphQL operation resolved:', {
                    operation: requestContext.request.operationName,
                    variables: requestContext.request.variables
                  });
                },
                didEncounterErrors(requestContext) {
                  logger.error('GraphQL errors encountered:', {
                    operation: requestContext.request.operationName,
                    errors: requestContext.errors
                  });
                },
                willSendResponse(requestContext) {
                  logger.info('GraphQL response sent:', {
                    operation: requestContext.request.operationName,
                    responseSize: JSON.stringify(requestContext.response).length
                  });
                }
              };
            }
          }
        ],
        context: ({ req, res }) => {
          return {
            req,
            res,
            logger,
            user: req.user,
            requestId: req.headers['x-request-id'] || 'unknown'
          };
        },
        introspection: process.env.NODE_ENV !== 'production',
        playground: process.env.NODE_ENV !== 'production',
        formatError: (err) => {
          logger.error('GraphQL error:', err);
          return {
            message: err.message,
            code: err.extensions?.code || 'INTERNAL_SERVER_ERROR',
            path: err.path,
            locations: err.locations,
            extensions: err.extensions
          };
        },
        validationRules: [],
        debug: process.env.NODE_ENV === 'development'
      });

      await this.apolloServer.start();

      this.apolloServer.applyMiddleware({
        app: this.app,
        path: '/graphql',
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3000',
          credentials: true
        },
        bodyParserConfig: {
          limit: '10mb'
        }
      });

      logger.info('🚀 GraphQL Server initialized successfully');
      logger.info(`📡 GraphQL Playground: http://localhost:${process.env.BACKEND_PORT || 3001}/graphql`);

      return this.httpServer;
    } catch (error) {
      logger.error('Failed to initialize GraphQL server:', error);
      throw error;
    }
  }

  async startServer(port = process.env.BACKEND_PORT || 3001) {
    try {
      if (!this.httpServer) {
        await this.initialize();
      }

      await new Promise((resolve, reject) => {
        this.httpServer.listen(port, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info(`🌐 GraphQL Server with subscriptions running on port ${port}`);
      return this.httpServer;
    } catch (error) {
      logger.error('Failed to start GraphQL server:', error);
      throw error;
    }
  }

  async stopServer() {
    try {
      if (this.apolloServer) {
        await this.apolloServer.stop();
      }

      if (this.httpServer) {
        await new Promise((resolve) => {
          this.httpServer.close(resolve);
        });
      }

      logger.info('🛑 GraphQL Server stopped successfully');
    } catch (error) {
      logger.error('Error stopping GraphQL server:', error);
      throw error;
    }
  }

  getServerInfo() {
    return {
      graphqlPath: '/graphql',
      subscriptionsPath: '/graphql',
      playgroundUrl: `http://localhost:${process.env.BACKEND_PORT || 3001}/graphql`,
      introspectionEnabled: process.env.NODE_ENV !== 'production'
    };
  }
}

module.exports = GraphQLServer;