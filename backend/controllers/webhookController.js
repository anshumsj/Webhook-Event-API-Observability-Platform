const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

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

    // Attempt to extract event type from common webhook headers
    const eventType = req.headers['x-github-event'] || req.headers['x-event-type'] || req.body?.type || 'webhook.received';

    // 2. Save incoming webhook request
    const event = new WebhookEvent({
      projectId: endpoint.projectId,
      requestId: req.requestId,
      payload: req.body,
      headers: req.headers,
      status: 'received',
      eventType
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

const getEventsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    
    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to access events for this project' });
    }
    
    // 3. Paginate
    const skip = (page - 1) * limit;
    const total = await WebhookEvent.countDocuments({ projectId });
    const events = await WebhookEvent.find({ projectId })
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit);
      
    res.status(200).json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Server error retrieving events' });
  }
};

module.exports = {
  ingestWebhook,
  getEventsByProject
};
