const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');

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

    // 2. Save incoming webhook request
    const event = new WebhookEvent({
      projectId: endpoint.projectId,
      requestId: req.requestId,
      payload: req.body,
      headers: req.headers,
      status: 'received'
    });
    await event.save();

    // 3. Log payload
    console.log(`\n--- [Webhook Ingest] Received Event ---`);
    console.log(`Request ID: ${req.requestId}`);
    console.log(`Endpoint ID: ${endpointId}`);
    console.log(`Event ID: ${event.eventId}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Payload:', JSON.stringify(req.body, null, 2));
    console.log(`---------------------------------------\n`);

    // 4. Return success response
    // Using 202 Accepted to indicate successful receipt before async processing
    res.status(202).json({ success: true, message: 'Webhook received', eventId: event.eventId, requestId: req.requestId });

  } catch (error) {
    console.error(`[${req.requestId}] Error ingesting webhook:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error processing webhook',
      requestId: req.requestId
    });
  }
};

module.exports = {
  ingestWebhook
};
