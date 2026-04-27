// Initialize tracing before any other module
require('./tracing');

const app = require('./secure-server');

module.exports = app;
