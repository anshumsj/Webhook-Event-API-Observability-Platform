require('dotenv').config();
const mongoose = require('mongoose');
const { getWorkspaceDeliveryTrends } = require('./services/analyticsService');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');

async function testTrends() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const userId = new mongoose.Types.ObjectId();
  const workspace = await Workspace.create({ name: 'Trends WS', owner: userId });
  const project = await Project.create({ name: 'Trends Project', workspaceId: workspace._id, createdBy: userId });
  const endpoint = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://test', secret: '1' });

  // Generate an event exactly 2 hours ago
  const now = new Date();
  
  const d2HoursAgo = new Date(now);
  d2HoursAgo.setUTCHours(d2HoursAgo.getUTCHours() - 2);
  d2HoursAgo.setUTCMinutes(15); // middle of the hour
  
  const ev1 = await WebhookEvent.create({
    projectId: project._id, endpointId: endpoint._id, requestId: 'r1', status: 'processed', payload: {}, receivedAt: d2HoursAgo
  });
  // 1 success attempt
  await DeliveryAttempt.create({ webhookEventId: ev1._id, endpointId: endpoint._id, attemptNumber: 1, status: 'success', latencyMs: 200, startedAt: d2HoursAgo });

  // Generate an event exactly 4 hours ago, retried
  const d4HoursAgo = new Date(now);
  d4HoursAgo.setUTCHours(d4HoursAgo.getUTCHours() - 4);
  d4HoursAgo.setUTCMinutes(45); // middle of the hour
  
  const ev2 = await WebhookEvent.create({
    projectId: project._id, endpointId: endpoint._id, requestId: 'r2', status: 'processed', payload: {}, receivedAt: d4HoursAgo
  });
  // 2 attempts (retried)
  await DeliveryAttempt.create({ webhookEventId: ev2._id, endpointId: endpoint._id, attemptNumber: 1, status: 'failed', latencyMs: 200, startedAt: d4HoursAgo });
  
  // The retry happens in the NEXT hour, to prove it binds to the event's bucket, not the attempt bucket
  const d3HoursAgo = new Date(now);
  d3HoursAgo.setUTCHours(d3HoursAgo.getUTCHours() - 3);
  d3HoursAgo.setUTCMinutes(10); 
  await DeliveryAttempt.create({ webhookEventId: ev2._id, endpointId: endpoint._id, attemptNumber: 2, status: 'success', latencyMs: 200, startedAt: d3HoursAgo });

  // Generate an event 48 hours ago (should be excluded from 24h)
  const d48HoursAgo = new Date(now);
  d48HoursAgo.setUTCHours(d48HoursAgo.getUTCHours() - 48);
  const ev3 = await WebhookEvent.create({
    projectId: project._id, endpointId: endpoint._id, requestId: 'r3', status: 'processed', payload: {}, receivedAt: d48HoursAgo
  });
  await DeliveryAttempt.create({ webhookEventId: ev3._id, endpointId: endpoint._id, attemptNumber: 1, status: 'success', latencyMs: 200, startedAt: d48HoursAgo });


  // Fetch 24h Trends
  const result = await getWorkspaceDeliveryTrends(workspace._id.toString(), '24h');
  
  if (result.data.length !== 24) throw new Error(`Expected 24 buckets, got ${result.data.length}`);
  
  // Find the bucket for ev2 (4 hours ago)
  const b4UTC = new Date(Date.UTC(d4HoursAgo.getUTCFullYear(), d4HoursAgo.getUTCMonth(), d4HoursAgo.getUTCDate(), d4HoursAgo.getUTCHours(), 0, 0, 0)).toISOString();
  const bucket4 = result.data.find(b => b.timestamp === b4UTC);
  if (!bucket4) throw new Error(`Bucket ${b4UTC} not found in output`);
  
  if (bucket4.totalDeliveries !== 1) throw new Error(`Expected 1 total in bucket 4, got ${bucket4.totalDeliveries}`);
  if (bucket4.retriedDeliveries !== 1) throw new Error(`Expected 1 retry in bucket 4, got ${bucket4.retriedDeliveries}`);

  // Find the bucket for ev1 (2 hours ago)
  const b2UTC = new Date(Date.UTC(d2HoursAgo.getUTCFullYear(), d2HoursAgo.getUTCMonth(), d2HoursAgo.getUTCDate(), d2HoursAgo.getUTCHours(), 0, 0, 0)).toISOString();
  const bucket2 = result.data.find(b => b.timestamp === b2UTC);
  if (!bucket2) throw new Error(`Bucket ${b2UTC} not found in output`);
  if (bucket2.totalDeliveries !== 1) throw new Error(`Expected 1 total in bucket 2, got ${bucket2.totalDeliveries}`);
  if (bucket2.retriedDeliveries !== 0) throw new Error(`Expected 0 retries in bucket 2, got ${bucket2.retriedDeliveries}`);

  // Total deliveries should be exactly 2 for the 24h period (ev1 and ev2)
  const total24h = result.data.reduce((acc, b) => acc + b.totalDeliveries, 0);
  if (total24h !== 2) throw new Error(`Expected exactly 2 deliveries across 24h, got ${total24h}`);
  
  console.log('[PASS] Time boundaries, empty bucket zero-filling, and retry isolation verified');

  // Verify workspace isolation
  const emptyWorkspace = await Workspace.create({ name: 'Empty Trends WS', owner: userId });
  const resultEmpty = await getWorkspaceDeliveryTrends(emptyWorkspace._id.toString(), '24h');
  const emptyTotal = resultEmpty.data.reduce((acc, b) => acc + b.totalDeliveries, 0);
  if (emptyTotal !== 0) throw new Error('Expected 0 total deliveries for empty workspace');
  if (resultEmpty.data.length !== 24) throw new Error('Expected 24 buckets even for empty workspace');
  
  console.log('[PASS] Workspace isolation and zero-filled arrays verified');

  // Cleanup
  await DeliveryAttempt.deleteMany({ endpointId: endpoint._id });
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: project._id });
  await Project.deleteMany({ workspaceId: workspace._id });
  await Workspace.deleteMany({ _id: { $in: [workspace._id, emptyWorkspace._id] } });

  process.exit(0);
}

testTrends().catch(err => {
  console.error(err);
  process.exit(1);
});
