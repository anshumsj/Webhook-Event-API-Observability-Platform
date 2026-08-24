require('dotenv').config();
const mongoose = require('mongoose');
const { getWorkspaceAnalytics } = require('./services/analyticsService');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');

async function testAnalytics() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  // 1. Create a mock workspace and project
  const workspace = await Workspace.create({
    name: 'Test Analytics Workspace',
    owner: new mongoose.Types.ObjectId()
  });

  const project = await Project.create({
    name: 'Test Project',
    workspaceId: workspace._id,
    createdBy: workspace.owner
  });

  const endpoint = await WebhookEndpoint.create({
    projectId: project._id,
    destinationUrl: 'http://example.com',
    secret: 'secret'
  });

  // 2. Create some events (mix of processed, failed, retry_exhausted)
  // Event 1: Processed, no retries
  const event1 = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-1',
    payload: {},
    status: 'processed',
    receivedAt: new Date()
  });
  await DeliveryAttempt.create({
    webhookEventId: event1._id,
    endpointId: endpoint._id,
    attemptNumber: 1,
    status: 'success',
    latencyMs: 100,
    startedAt: new Date()
  });

  // Event 2: Failed but then processed (retried)
  const event2 = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-2',
    payload: {},
    status: 'processed',
    receivedAt: new Date()
  });
  await DeliveryAttempt.create({
    webhookEventId: event2._id,
    endpointId: endpoint._id,
    attemptNumber: 1,
    status: 'failed',
    latencyMs: 200,
    startedAt: new Date()
  });
  await DeliveryAttempt.create({
    webhookEventId: event2._id,
    endpointId: endpoint._id,
    attemptNumber: 2,
    status: 'success',
    latencyMs: 150,
    startedAt: new Date()
  });

  // Event 3: retry_exhausted
  const event3 = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-3',
    payload: {},
    status: 'retry_exhausted',
    receivedAt: new Date()
  });
  await DeliveryAttempt.create({
    webhookEventId: event3._id,
    endpointId: endpoint._id,
    attemptNumber: 1,
    status: 'failed',
    latencyMs: 300,
    startedAt: new Date()
  });
  await DeliveryAttempt.create({
    webhookEventId: event3._id,
    endpointId: endpoint._id,
    attemptNumber: 2,
    status: 'failed',
    latencyMs: 250,
    startedAt: new Date()
  });

  // Event 4: outside the 24h window
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 2);
  const event4 = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-4',
    payload: {},
    status: 'processed',
    receivedAt: oldDate
  });
  await DeliveryAttempt.create({
    webhookEventId: event4._id,
    endpointId: endpoint._id,
    attemptNumber: 1,
    status: 'success',
    latencyMs: 50,
    startedAt: oldDate
  });

  // 3. Test Analytics Function
  console.log('Testing getWorkspaceAnalytics (24h default)...');
  const stats24h = await getWorkspaceAnalytics(workspace._id);
  console.log(stats24h);
  
  if (stats24h.totalDeliveries !== 3) throw new Error('Expected 3 deliveries in 24h window');
  if (stats24h.successfulDeliveries !== 2) throw new Error('Expected 2 successful');
  if (stats24h.deadLettered !== 1) throw new Error('Expected 1 DLQ');
  if (stats24h.retryRate !== 66.67) throw new Error('Expected 66.67% retry rate (2 retried / 3 total)');
  // Latency: (100 + 200 + 150 + 300 + 250) / 5 = 1000 / 5 = 200
  if (stats24h.averageLatencyMs !== 200) throw new Error(`Expected 200 avg latency, got ${stats24h.averageLatencyMs}`);

  console.log('Testing getWorkspaceAnalytics (7d)...');
  const stats7d = await getWorkspaceAnalytics(workspace._id, '7d');
  console.log(stats7d);
  if (stats7d.totalDeliveries !== 4) throw new Error('Expected 4 deliveries in 7d window');

  console.log('All tests passed!');

  // Cleanup
  await DeliveryAttempt.deleteMany({ endpointId: endpoint._id });
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.findByIdAndDelete(endpoint._id);
  await Project.findByIdAndDelete(project._id);
  await Workspace.findByIdAndDelete(workspace._id);

  process.exit(0);
}

testAnalytics().catch(err => {
  console.error(err);
  process.exit(1);
});
