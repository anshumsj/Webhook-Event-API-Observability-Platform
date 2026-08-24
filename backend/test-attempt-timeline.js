require('dotenv').config();
const mongoose = require('mongoose');
const { getEventById } = require('./controllers/webhookController');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');

// Mock req and res
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function testAttemptTimeline() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const userId = new mongoose.Types.ObjectId();
  const workspace = await Workspace.create({ name: 'Timeline WS', owner: userId });
  const project = await Project.create({ name: 'Timeline Project', workspaceId: workspace._id, createdBy: userId });
  const endpoint = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://t', secret: '1' });

  // 1. Create an event with multiple attempts
  const event = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-timeline-1',
    status: 'processed',
    eventType: 'order.created',
    payload: { hello: "world" },
    receivedAt: new Date(Date.now() - 1000 * 60)
  });

  // Create attempts in mixed insertion order but we expect them sorted by attemptNumber
  await DeliveryAttempt.create({
    webhookEventId: event._id,
    endpointId: endpoint._id,
    attemptNumber: 2,
    status: 'success',
    responseStatusCode: 200,
    latencyMs: 150,
    startedAt: new Date(Date.now() - 1000 * 30),
    completedAt: new Date(Date.now() - 1000 * 29)
  });

  await DeliveryAttempt.create({
    webhookEventId: event._id,
    endpointId: endpoint._id,
    attemptNumber: 1,
    status: 'failed',
    responseStatusCode: 500,
    latencyMs: 250,
    startedAt: new Date(Date.now() - 1000 * 50),
    completedAt: new Date(Date.now() - 1000 * 49)
  });

  // Execute request
  const req = {
    params: { eventId: event.eventId },
    user: { id: userId }
  };
  const res = mockResponse();
  
  await getEventById(req, res);
  
  if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  const dto = res.data;
  
  if (!dto.attempts || dto.attempts.length !== 2) throw new Error(`Expected 2 attempts, got ${dto.attempts?.length}`);
  
  // Verify ordering
  if (dto.attempts[0].attemptNumber !== 1) throw new Error('Attempt 1 should be first');
  if (dto.attempts[1].attemptNumber !== 2) throw new Error('Attempt 2 should be second');
  
  if (dto.attempts[0].status !== 'failed' || dto.attempts[0].responseStatusCode !== 500) {
      throw new Error('Attempt 1 data mismatch');
  }

  // Isolation test: Unrelated user
  const unrelatedUser = new mongoose.Types.ObjectId();
  const reqIso = {
      params: { eventId: event.eventId },
      user: { id: unrelatedUser }
  };
  const resIso = mockResponse();
  await getEventById(reqIso, resIso);
  if (resIso.statusCode !== 403) throw new Error('Expected 403 for unrelated user');

  console.log('[PASS] Timeline retrieval and chronological sorting');
  console.log('[PASS] Workspace isolation');

  // Cleanup
  await DeliveryAttempt.deleteMany({ webhookEventId: event._id });
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: project._id });
  await Project.findByIdAndDelete(project._id);
  await Workspace.findByIdAndDelete(workspace._id);
  process.exit(0);
}

testAttemptTimeline().catch(err => {
  console.error(err);
  process.exit(1);
});
