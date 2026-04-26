const mongoose = require('mongoose');

/**
 * Migration: 001_initial_setup
 * Description: Initial database setup (placeholder for future changes)
 */

module.exports = {
  up: async () => {
    // Example: Create an index
    // await mongoose.connection.collection('credentials').createIndex({ issuer: 1 });
    console.log('Migration 001 Up: Initial setup complete');
  },

  down: async () => {
    // Example: Drop the index
    // await mongoose.connection.collection('credentials').dropIndex('issuer_1');
    console.log('Migration 001 Down: Initial setup rolled back');
  }
};
