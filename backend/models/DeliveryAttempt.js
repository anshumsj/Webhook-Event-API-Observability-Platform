const mongoose = require('mongoose');

const deliveryAttemptSchema = new mongoose.Schema({
  webhookEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebhookEvent',
    required: true,
    index: true
  },
  endpointId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebhookEndpoint',
    required: true,
    index: true
  },
  attemptNumber: {
    type: Number,
    required: true
  },
  attemptType: {
    type: String,
    enum: ['automatic', 'manual'],
    default: 'automatic'
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'timeout'],
    required: true,
    default: 'pending'
  },
  responseStatusCode: {
    type: Number
  },
  responseBody: {
    type: String
  },
  errorMessage: {
    type: String
  },
  latencyMs: {
    type: Number
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  destinationUrl: {
    type: String
  },
  requestMethod: {
    type: String,
    default: 'POST'
  },
  requestHeaders: {
    type: Map,
    of: String
  },
  responseHeaders: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Enforce unique attempt numbers per webhook event
deliveryAttemptSchema.index({ webhookEventId: 1, attemptNumber: 1 }, { unique: true });
deliveryAttemptSchema.index({ endpointId: 1, startedAt: -1 });

const DeliveryAttempt = mongoose.model('DeliveryAttempt', deliveryAttemptSchema);

module.exports = DeliveryAttempt;
