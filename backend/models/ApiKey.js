const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  keyPrefix: {
    type: String,
    required: true,
    index: true
  },
  hash: {
    type: String,
    required: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  lastUsedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
