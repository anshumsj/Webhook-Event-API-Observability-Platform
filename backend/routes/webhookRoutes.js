const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Webhook ingestion endpoint
// POST /api/webhooks/:endpointId
router.post('/:endpointId', webhookController.ingestWebhook);

module.exports = router;
