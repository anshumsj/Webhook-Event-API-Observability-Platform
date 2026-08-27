const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');

// Rate limiter for webhook ingestion: 300 requests per IP per minute
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
      requestId: 'unknown'
    }
  },
  store: new RedisStore({
    sendCommand: (...args) => getRedis().call(...args),
    prefix: 'rl:webhook:'
  }),
});

// Webhook ingestion endpoint
// POST /api/webhooks/:endpointId
router.post('/:endpointId', webhookLimiter, webhookController.ingestWebhook);

module.exports = router;
