const mongoose = require('mongoose');

const credentialTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: String,
  credentialType: {
    type: String,
    required: true,
  },
  schemaUri: String,
  requiredClaims: [{
    name: String,
    type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'object'] },
    description: String,
    required: { type: Boolean, default: true },
  }],
  issuerDid: String,
  active: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: Map,
    of: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

credentialTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CredentialTemplate', credentialTemplateSchema);
