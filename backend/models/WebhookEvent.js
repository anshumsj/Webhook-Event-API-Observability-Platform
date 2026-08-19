const mongoose = require('mongoose');
const crypto = require('crypto');

const generateRandomString = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');

const webhookEventSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required'],
    index: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true,
    default: () => generateRandomString(12)
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
    enum: ['received', 'processed', 'failed'],
    default: 'received'
  },
  receivedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = WebhookEvent;
