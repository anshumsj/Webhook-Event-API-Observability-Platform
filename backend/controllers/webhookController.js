const WebhookEndpoint = require('../models/WebhookEndpoint');

const ingestWebhook = async (req, res) => {
  try {
    const { endpointId } = req.params;

    // 1. Validate endpoint
    const endpoint = await WebhookEndpoint.findOne({ endpointId });
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        message: 'Webhook endpoint not found'
      });
    }

    // 2. Log payload (for now)
    console.log(`\n--- [Webhook Ingest] Received Event ---`);
    console.log(`Endpoint ID: ${endpointId}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Payload:', JSON.stringify(req.body, null, 2));
    console.log(`---------------------------------------\n`);

    // 3. Return success response
    // Using 202 Accepted to indicate successful receipt before async processing
    res.status(202).json({ success: true, message: 'Webhook received' });

  } catch (error) {
    console.error('Error ingesting webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error processing webhook'
    });
  }
};

module.exports = {
  ingestWebhook
};
