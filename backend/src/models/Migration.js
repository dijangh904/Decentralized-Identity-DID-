const mongoose = require('mongoose');

const migrationSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Migration', migrationSchema);
