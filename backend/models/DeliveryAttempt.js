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
  }
}, {
  timestamps: true
});

// Enforce unique attempt numbers per webhook event
deliveryAttemptSchema.index({ webhookEventId: 1, attemptNumber: 1 }, { unique: true });

const DeliveryAttempt = mongoose.model('DeliveryAttempt', deliveryAttemptSchema);

module.exports = DeliveryAttempt;
