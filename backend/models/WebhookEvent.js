const mongoose = require('mongoose');
const crypto = require('crypto');

const generateRandomString = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');

const webhookEventSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required']
  },
  endpointId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebhookEndpoint',
    required: [true, 'Endpoint ID is required'],
    index: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => generateRandomString(12)
  },
  requestId: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  headers: {
    type: Map,
    of: String,
    default: {}
  },
  status: {
    type: String,
    enum: ['received', 'queued', 'processing', 'processed', 'failed', 'retry_exhausted'],
    default: 'received'
  },
  eventType: {
    type: String,
    default: 'webhook.received'
  },
  processingTimeMs: {
    type: Number,
    default: 0
  },
  processedAt: {
    type: Date
  },
  receivedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for optimal event listing & pagination
webhookEventSchema.index({ projectId: 1, receivedAt: -1, _id: -1 });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = WebhookEvent;
