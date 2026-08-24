require('dotenv').config();
const mongoose = require('mongoose');
const { getWorkspaceEndpointHealth } = require('./services/analyticsService');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');

async function testHealth() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const userId = new mongoose.Types.ObjectId();
  const workspace = await Workspace.create({ name: 'Health WS', owner: userId });
  const project = await Project.create({ name: 'Health Project', workspaceId: workspace._id, createdBy: userId });

  // Endpoint 1: Healthy (100% success, low latency)
  const epHealthy = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://h', secret: '1' });
  const evHealthy = await WebhookEvent.create({
    projectId: project._id, endpointId: epHealthy._id, requestId: 'r1', status: 'processed', payload: {}, receivedAt: new Date()
  });
  await DeliveryAttempt.create({ webhookEventId: evHealthy._id, endpointId: epHealthy._id, attemptNumber: 1, status: 'success', latencyMs: 200, startedAt: new Date() });

  // Endpoint 2: Degraded by Latency (100% success, 800ms latency)
  const epDegL = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://dl', secret: '2' });
  const evDegL = await WebhookEvent.create({
    projectId: project._id, endpointId: epDegL._id, requestId: 'r2', status: 'processed', payload: {}, receivedAt: new Date()
  });
  await DeliveryAttempt.create({ webhookEventId: evDegL._id, endpointId: epDegL._id, attemptNumber: 1, status: 'success', latencyMs: 800, startedAt: new Date() });

  // Endpoint 3: Degraded by Success Rate (96% success, low latency -> simulated by 25 total, 24 success = 96%)
  const epDegS = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://ds', secret: '3' });
  for (let i = 0; i < 25; i++) {
    const isSuccess = i < 24;
    const ev = await WebhookEvent.create({
      projectId: project._id, endpointId: epDegS._id, requestId: `r3-${i}`, status: isSuccess ? 'processed' : 'failed', payload: {}, receivedAt: new Date()
    });
    await DeliveryAttempt.create({ webhookEventId: ev._id, endpointId: epDegS._id, attemptNumber: 1, status: isSuccess ? 'success' : 'failed', latencyMs: 200, startedAt: new Date() });
  }

  // Endpoint 4: Unhealthy by Latency (100% success, 1200ms latency)
  const epUnL = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://ul', secret: '4' });
  const evUnL = await WebhookEvent.create({
    projectId: project._id, endpointId: epUnL._id, requestId: 'r4', status: 'processed', payload: {}, receivedAt: new Date()
  });
  await DeliveryAttempt.create({ webhookEventId: evUnL._id, endpointId: epUnL._id, attemptNumber: 1, status: 'success', latencyMs: 1200, startedAt: new Date() });

  // Endpoint 5: Unhealthy by Success Rate (90% success)
  const epUnS = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://us', secret: '5' });
  for (let i = 0; i < 10; i++) {
    const isSuccess = i < 9;
    const ev = await WebhookEvent.create({
      projectId: project._id, endpointId: epUnS._id, requestId: `r5-${i}`, status: isSuccess ? 'processed' : 'failed', payload: {}, receivedAt: new Date()
    });
    await DeliveryAttempt.create({ webhookEventId: ev._id, endpointId: epUnS._id, attemptNumber: 1, status: isSuccess ? 'success' : 'failed', latencyMs: 200, startedAt: new Date() });
  }

  // Endpoint 6: No Data
  const epEmpty = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://empty', secret: '6' });

  // Fetch health
  const result = await getWorkspaceEndpointHealth(workspace._id.toString(), '24h');
  
  const hMap = {};
  for (const ep of result.endpoints) {
    hMap[ep.destinationUrl] = ep.health;
  }

  if (hMap['http://h'] !== 'healthy') throw new Error(`Expected http://h to be healthy, got ${hMap['http://h']}`);
  if (hMap['http://dl'] !== 'degraded') throw new Error(`Expected http://dl to be degraded, got ${hMap['http://dl']}`);
  if (hMap['http://ds'] !== 'degraded') throw new Error(`Expected http://ds to be degraded, got ${hMap['http://ds']}`);
  if (hMap['http://ul'] !== 'unhealthy') throw new Error(`Expected http://ul to be unhealthy, got ${hMap['http://ul']}`);
  if (hMap['http://us'] !== 'unhealthy') throw new Error(`Expected http://us to be unhealthy, got ${hMap['http://us']}`);
  if (hMap['http://empty'] !== 'no_data') throw new Error(`Expected http://empty to be no_data, got ${hMap['http://empty']}`);

  console.log('[PASS] Endpoint health rules verified');

  // Verify sorting: unhealthy, degraded, healthy, no_data
  const order = result.endpoints.map(e => e.health);
  const expectedOrder = ['unhealthy', 'unhealthy', 'degraded', 'degraded', 'healthy', 'no_data'];
  if (JSON.stringify(order) !== JSON.stringify(expectedOrder)) {
     throw new Error(`Expected sort order ${expectedOrder} but got ${order}`);
  }
  console.log('[PASS] Endpoint sort order verified');

  // Verify workspace isolation
  const emptyWorkspace = await Workspace.create({ name: 'Empty WS', owner: userId });
  const resultEmpty = await getWorkspaceEndpointHealth(emptyWorkspace._id.toString(), '24h');
  if (resultEmpty.endpoints.length !== 0) throw new Error('Expected 0 endpoints for empty workspace');
  console.log('[PASS] Workspace isolation verified');

  // Cleanup
  await DeliveryAttempt.deleteMany({ endpointId: { $in: [epHealthy._id, epDegL._id, epDegS._id, epUnL._id, epUnS._id, epEmpty._id] } });
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: project._id });
  await Project.deleteMany({ workspaceId: workspace._id });
  await Workspace.deleteMany({ _id: { $in: [workspace._id, emptyWorkspace._id] } });

  process.exit(0);
}

testHealth().catch(err => {
  console.error(err);
  process.exit(1);
});
