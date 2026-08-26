require('dotenv').config();
const mongoose = require('mongoose');
const { getWorkspaceEndpointHealth, getEndpointHealth } = require('./services/analyticsService');
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

  // Helper to quickly create test data
  let reqCounter = 0;
  async function createData(ep, statusArray, latencies) {
    for (let i = 0; i < statusArray.length; i++) {
      const status = statusArray[i];
      const ev = await WebhookEvent.create({
        projectId: project._id, endpointId: ep._id, requestId: `r-${reqCounter++}`, status: status === 'success' ? 'processed' : 'failed', payload: {}, receivedAt: new Date()
      });
      await DeliveryAttempt.create({ webhookEventId: ev._id, endpointId: ep._id, attemptNumber: 1, status, latencyMs: latencies[i], startedAt: new Date() });
    }
  }

  // Endpoint 1: Healthy (100% success, low latency)
  const epHealthy = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://h', secret: '1' });
  await createData(epHealthy, ['success'], [200]);

  // Endpoint 2: Degraded by Latency (100% success, 800ms latency)
  const epDegL = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://dl', secret: '2' });
  await createData(epDegL, ['success'], [800]);

  // Endpoint 3: Degraded by Success Rate (96% success, low latency)
  const epDegS = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://ds', secret: '3' });
  const statusesDegS = Array(25).fill('success');
  statusesDegS[24] = 'failed'; // 24/25 = 96%
  await createData(epDegS, statusesDegS, Array(25).fill(200));

  // Endpoint 4: Unhealthy by Latency (100% success, 1200ms latency)
  const epUnL = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://ul', secret: '4' });
  await createData(epUnL, ['success'], [1200]);

  // Endpoint 5: Unhealthy by Success Rate (70% success)
  const epUnS = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://us', secret: '5' });
  const statusesUnS = Array(10).fill('success');
  statusesUnS[7] = 'failed';
  statusesUnS[8] = 'failed';
  statusesUnS[9] = 'failed'; // 7/10 = 70%
  await createData(epUnS, statusesUnS, Array(10).fill(200));

  // Endpoint 6: No Data
  const epEmpty = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://empty', secret: '6' });

  // Endpoint 7: Timeout Semantic test (Timeout counts as failure)
  const epTimeout = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://timeout', secret: '7' });
  await createData(epTimeout, ['success', 'timeout'], [200, null]); // 1 success, 1 timeout -> 50% success = Unhealthy

  // Endpoint 8: Pending Semantic test (Pending doesn't corrupt success rate)
  const epPending = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://pending', secret: '8' });
  await createData(epPending, ['success', 'pending'], [200, null]); // 1 success, 1 pending -> 100% success of COMPLETED attempts = Healthy

  // Endpoint 9: Retry semantics
  const epRetry = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://retry', secret: '9' });
  const evRetry = await WebhookEvent.create({
    projectId: project._id, endpointId: epRetry._id, requestId: `r-retry`, status: 'processed', payload: {}, receivedAt: new Date()
  });
  // 1 event, 3 attempts (failed, failed, success)
  await DeliveryAttempt.create({ webhookEventId: evRetry._id, endpointId: epRetry._id, attemptNumber: 1, status: 'failed', latencyMs: 200, startedAt: new Date() });
  await DeliveryAttempt.create({ webhookEventId: evRetry._id, endpointId: epRetry._id, attemptNumber: 2, status: 'failed', latencyMs: 200, startedAt: new Date() });
  await DeliveryAttempt.create({ webhookEventId: evRetry._id, endpointId: epRetry._id, attemptNumber: 3, status: 'success', latencyMs: 200, startedAt: new Date() });

  // Fetch health
  const wsResult = await getWorkspaceEndpointHealth(workspace._id.toString(), '24h');
  const prResult = await getEndpointHealth(project._id.toString());
  
  // They should be mathematically identical in their output definitions (since they query the exact same data here)
  const hMap = {};
  for (const ep of wsResult.endpoints) {
    hMap[ep.destinationUrl] = ep;
  }
  const pMap = {};
  for (const ep of prResult) {
    pMap[ep.destinationUrl] = ep;
  }

  // Invariants checking
  for (const ep of wsResult.endpoints) {
    const pep = pMap[ep.destinationUrl];
    if (ep.totalAttempts !== pep.totalAttempts) throw new Error(`Mismatch in totalAttempts for ${ep.destinationUrl}`);
    if (ep.successfulAttempts !== pep.successfulAttempts) throw new Error(`Mismatch in successfulAttempts for ${ep.destinationUrl}`);
    if (ep.failedAttempts !== pep.failedAttempts) throw new Error(`Mismatch in failedAttempts for ${ep.destinationUrl}`);
    if (ep.completedAttempts !== ep.successfulAttempts + ep.failedAttempts) throw new Error(`Completed invariant failed for ${ep.destinationUrl}`);
    if (ep.totalAttempts !== ep.completedAttempts + ep.pendingAttempts) throw new Error(`Total invariant failed for ${ep.destinationUrl}`);
    if (ep.retryCount > ep.totalAttempts) throw new Error(`Retry invariant failed for ${ep.destinationUrl}`);
    if (ep.successRate < 0 || ep.successRate > 100) throw new Error(`Success rate out of bounds for ${ep.destinationUrl}`);
    if (ep.averageLatencyMs < 0) throw new Error(`Latency out of bounds for ${ep.destinationUrl}`);
  }
  console.log('[PASS] Mathematical invariants and project/workspace parity verified');

  if (hMap['http://h'].health !== 'healthy') throw new Error(`Expected http://h to be healthy, got ${hMap['http://h'].health}`);
  if (hMap['http://dl'].health !== 'degraded') throw new Error(`Expected http://dl to be degraded, got ${hMap['http://dl'].health}`);
  if (hMap['http://ds'].health !== 'degraded') throw new Error(`Expected http://ds to be degraded, got ${hMap['http://ds'].health}`);
  if (hMap['http://ul'].health !== 'unhealthy') throw new Error(`Expected http://ul to be unhealthy, got ${hMap['http://ul'].health}`);
  if (hMap['http://us'].health !== 'unhealthy') throw new Error(`Expected http://us to be unhealthy, got ${hMap['http://us'].health}`);
  if (hMap['http://empty'].health !== 'no_data') throw new Error(`Expected http://empty to be no_data, got ${hMap['http://empty'].health}`);
  
  if (hMap['http://timeout'].health !== 'unhealthy') throw new Error(`Expected http://timeout to be unhealthy, got ${hMap['http://timeout'].health}`);
  if (hMap['http://timeout'].failedAttempts !== 1) throw new Error(`Expected http://timeout to have 1 failed attempt`);

  if (hMap['http://pending'].health !== 'healthy') throw new Error(`Expected http://pending to be healthy, got ${hMap['http://pending'].health}`);
  if (hMap['http://pending'].pendingAttempts !== 1) throw new Error(`Expected http://pending to have 1 pending attempt`);
  if (hMap['http://pending'].successRate !== 100) throw new Error(`Expected http://pending to have 100% success rate on completed attempts`);

  if (hMap['http://retry'].totalAttempts !== 3) throw new Error(`Expected http://retry to have 3 total attempts`);
  if (hMap['http://retry'].retryCount !== 2) throw new Error(`Expected http://retry to have 2 retries`);
  if (hMap['http://retry'].successRate !== 33.33) throw new Error(`Expected http://retry to have 33.33% success rate`);

  console.log('[PASS] Endpoint health semantics verified');

  // Verify workspace isolation
  const emptyWorkspace = await Workspace.create({ name: 'Empty WS', owner: userId });
  const resultEmpty = await getWorkspaceEndpointHealth(emptyWorkspace._id.toString(), '24h');
  if (resultEmpty.endpoints.length !== 0) throw new Error('Expected 0 endpoints for empty workspace');
  console.log('[PASS] Workspace isolation verified');

  // Cleanup
  await DeliveryAttempt.deleteMany({ webhookEventId: { $in: [epHealthy, epDegL, epDegS, epUnL, epUnS, epEmpty, epTimeout, epPending, epRetry].map(e => e ? e._id : null) } }); // Not fully accurate but better than deleting everything, actually let's delete by projectId
  await DeliveryAttempt.deleteMany({ endpointId: { $in: await WebhookEndpoint.find({ projectId: project._id }).distinct('_id') } });
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: project._id });
  await Project.deleteMany({ workspaceId: workspace._id });
  await Workspace.deleteMany({ owner: userId });

  process.exit(0);
}

testHealth().catch(err => {
  console.error(err);
  process.exit(1);
});
