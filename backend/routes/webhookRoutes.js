const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

const rateLimit = require('express-rate-limit');

// Rate limiter for webhook ingestion: 300 requests per IP per minute
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Webhook ingestion endpoint
// POST /api/webhooks/:endpointId
router.post('/:endpointId', webhookLimiter, webhookController.ingestWebhook);

module.exports = router;
