const mongoose = require('mongoose');
const crypto = require('crypto');

const generateRandomString = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');

const webhookEndpointSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required'],
    index: true
  },
  endpointId: {
    type: String,
    required: true,
    unique: true,
    default: () => generateRandomString(12) // Generates a 24-character hex string
  },
  secret: {
    type: String,
    required: true,
    default: () => generateRandomString(24) // Generates a 48-character hex string
  },
  destinationUrl: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

const WebhookEndpoint = mongoose.model('WebhookEndpoint', webhookEndpointSchema);

module.exports = WebhookEndpoint;
