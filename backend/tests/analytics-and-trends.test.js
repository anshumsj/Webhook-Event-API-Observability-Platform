const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  classifyEndpointHealth,
  getWorkspaceAnalytics,
  getWorkspaceEndpointHealth,
  getWorkspaceDeliveryTrends,
  getProjectAnalytics,
  getEndpointHealth
} = require('../services/analyticsService');

const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');
const DeliveryAttempt = require('../models/DeliveryAttempt');

async function runAnalyticsAndTrendsTests() {
  console.log('\n======================================================');
  console.log('  Running Analytics, Delivery Trends & Health Tests');
  console.log('======================================================\n');

  let workspace, project, endpoint;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Setup Workspace, Project, Endpoint
    const userId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({
      name: 'Analytics Test Workspace',
      owner: userId,
      members: [userId]
    });

    project = await Project.create({
      name: 'Analytics Test Project',
      workspaceId: workspace._id,
      createdBy: userId
    });

    endpoint = await WebhookEndpoint.create({
      projectId: project._id,
      destinationUrl: 'https://httpbin.org/post',
      secret: 'test-secret'
    });

    // 2. Populate Events & Attempts
    // Event 1: Processed, 1 attempt (100ms success)
    const ev1 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-1',
      payload: {},
      status: 'processed',
      receivedAt: new Date()
    });
    await DeliveryAttempt.create({
      webhookEventId: ev1._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'success',
      latencyMs: 100,
      startedAt: new Date()
    });

    // Event 2: Processed with retry (attempt 1 failed 200ms, attempt 2 success 150ms)
    const ev2 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-2',
      payload: {},
      status: 'processed',
      receivedAt: new Date()
    });
    await DeliveryAttempt.create({
      webhookEventId: ev2._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'failed',
      latencyMs: 200,
      startedAt: new Date()
    });
    await DeliveryAttempt.create({
      webhookEventId: ev2._id,
      endpointId: endpoint._id,
      attemptNumber: 2,
      status: 'success',
      latencyMs: 150,
      startedAt: new Date()
    });

    // Event 3: retry_exhausted (attempt 1 failed 300ms, attempt 2 failed 250ms)
    const ev3 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-3',
      payload: {},
      status: 'retry_exhausted',
      receivedAt: new Date()
    });
    await DeliveryAttempt.create({
      webhookEventId: ev3._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'failed',
      latencyMs: 300,
      startedAt: new Date()
    });
    await DeliveryAttempt.create({
      webhookEventId: ev3._id,
      endpointId: endpoint._id,
      attemptNumber: 2,
      status: 'failed',
      latencyMs: 250,
      startedAt: new Date()
    });

    // Event 4: outside 24h window (2 days ago), processed (50ms)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 2);
    const ev4 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-4',
      payload: {},
      status: 'processed',
      receivedAt: oldDate
    });
    await DeliveryAttempt.create({
      webhookEventId: ev4._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'success',
      latencyMs: 50,
      startedAt: oldDate
    });

    // 3. Test getWorkspaceAnalytics (24h default)
    console.log('Testing getWorkspaceAnalytics (24h)...');
    const wsStats24h = await getWorkspaceAnalytics(workspace._id);
    if (wsStats24h.totalDeliveries !== 3) throw new Error(`Expected 3 total deliveries, got ${wsStats24h.totalDeliveries}`);
    if (wsStats24h.successfulDeliveries !== 2) throw new Error(`Expected 2 successful, got ${wsStats24h.successfulDeliveries}`);
    if (wsStats24h.deadLettered !== 1) throw new Error(`Expected 1 DLQ, got ${wsStats24h.deadLettered}`);
    if (wsStats24h.retryRate !== 66.67) throw new Error(`Expected 66.67% retry rate, got ${wsStats24h.retryRate}`);
    // Average Latency: (100 + 200 + 150 + 300 + 250) / 5 = 200
    if (wsStats24h.averageLatencyMs !== 200) throw new Error(`Expected 200ms latency, got ${wsStats24h.averageLatencyMs}`);
    console.log('[PASS] Workspace analytics (24h) calculations verified.');

    // Test getWorkspaceAnalytics (7d)
    console.log('Testing getWorkspaceAnalytics (7d)...');
    const wsStats7d = await getWorkspaceAnalytics(workspace._id, '7d');
    if (wsStats7d.totalDeliveries !== 4) throw new Error(`Expected 4 deliveries in 7d, got ${wsStats7d.totalDeliveries}`);
    console.log('[PASS] Workspace analytics (7d) window verified.');

    // 4. Test getProjectAnalytics (24h and 30d default)
    console.log('Testing getProjectAnalytics (24h)...');
    const prStats24h = await getProjectAnalytics(project._id, '24h');
    if (prStats24h.totalEvents !== 3) throw new Error(`Expected 3 events, got ${prStats24h.totalEvents}`);
    if (prStats24h.processedEvents !== 2) throw new Error(`Expected 2 processed, got ${prStats24h.processedEvents}`);
    if (prStats24h.retryExhaustedEvents !== 1) throw new Error(`Expected 1 retry_exhausted, got ${prStats24h.retryExhaustedEvents}`);
    if (prStats24h.retryRate !== 66.67) throw new Error(`Expected 66.67% retry rate, got ${prStats24h.retryRate}`);
    if (prStats24h.averageLatencyMs !== 200) throw new Error(`Expected 200ms latency, got ${prStats24h.averageLatencyMs}`);
    console.log('[PASS] Project analytics (24h) calculations verified.');

    const prStats30d = await getProjectAnalytics(project._id);
    if (prStats30d.totalEvents !== 4) throw new Error(`Expected 4 events in 30d, got ${prStats30d.totalEvents}`);
    console.log('[PASS] Project analytics (30d default) verified.');

    // 5. Test Delivery Trends (Hourly Buckets & Zero-filling)
    console.log('Testing getWorkspaceDeliveryTrends (24h)...');
    const trends24h = await getWorkspaceDeliveryTrends(workspace._id, '24h');
    if (trends24h.bucket !== 'hour' || trends24h.data.length !== 24) {
      throw new Error(`Expected 24 hourly buckets, got ${trends24h.data.length}`);
    }
    // Sum of deliveries in buckets must equal 24h total
    const totalTrendDeliveries = trends24h.data.reduce((acc, b) => acc + b.totalDeliveries, 0);
    if (totalTrendDeliveries !== 3) {
      throw new Error(`Expected 3 total deliveries across trends buckets, got ${totalTrendDeliveries}`);
    }
    console.log('[PASS] Delivery trends 24h hourly bucketing and zero-filling verified.');

    // Test Delivery Trends (7d Daily Buckets)
    console.log('Testing getWorkspaceDeliveryTrends (7d)...');
    const trends7d = await getWorkspaceDeliveryTrends(workspace._id, '7d');
    if (trends7d.bucket !== 'day' || trends7d.data.length !== 7) {
      throw new Error(`Expected 7 daily buckets, got ${trends7d.data.length}`);
    }
    const total7dDeliveries = trends7d.data.reduce((acc, b) => acc + b.totalDeliveries, 0);
    if (total7dDeliveries !== 4) {
      throw new Error(`Expected 4 deliveries across 7d trends, got ${total7dDeliveries}`);
    }
    console.log('[PASS] Delivery trends 7d daily bucketing verified.');

    // 6. Test Endpoint Health Classification & Classifier Boundary Semantics
    console.log('Testing endpoint health metrics and classifier boundary semantics...');
    
    // Verify all 9 classifier boundary scenarios:
    // 1. 0 attempts => no_data
    if (classifyEndpointHealth(0, 0, 0) !== 'no_data') {
      throw new Error(`Expected 'no_data' for 0 attempts, got ${classifyEndpointHealth(0, 0, 0)}`);
    }
    // 2. 100% success + 500ms => healthy
    if (classifyEndpointHealth(100, 500, 1) !== 'healthy') {
      throw new Error(`Expected 'healthy' for 100% success + 500ms, got ${classifyEndpointHealth(100, 500, 1)}`);
    }
    // 3. 100% success + 999ms => healthy
    if (classifyEndpointHealth(100, 999, 1) !== 'healthy') {
      throw new Error(`Expected 'healthy' for 100% success + 999ms, got ${classifyEndpointHealth(100, 999, 1)}`);
    }
    // 4. 100% success + 1000ms => degraded
    if (classifyEndpointHealth(100, 1000, 1) !== 'degraded') {
      throw new Error(`Expected 'degraded' for 100% success + 1000ms, got ${classifyEndpointHealth(100, 1000, 1)}`);
    }
    // 5. 100% success + 1087ms => degraded (production scenario 1)
    if (classifyEndpointHealth(100, 1087, 1) !== 'degraded') {
      throw new Error(`Expected 'degraded' for 100% success + 1087ms, got ${classifyEndpointHealth(100, 1087, 1)}`);
    }
    // 6. 98% success + 500ms => degraded
    if (classifyEndpointHealth(98, 500, 100) !== 'degraded') {
      throw new Error(`Expected 'degraded' for 98% success + 500ms, got ${classifyEndpointHealth(98, 500, 100)}`);
    }
    // 7. 80% success + 500ms => degraded
    if (classifyEndpointHealth(80, 500, 10) !== 'degraded') {
      throw new Error(`Expected 'degraded' for 80% success + 500ms, got ${classifyEndpointHealth(80, 500, 10)}`);
    }
    // 8. 79.99% success + 500ms => unhealthy
    if (classifyEndpointHealth(79.99, 500, 100) !== 'unhealthy') {
      throw new Error(`Expected 'unhealthy' for 79.99% success + 500ms, got ${classifyEndpointHealth(79.99, 500, 100)}`);
    }
    // 9. 71.43% success + 640ms => unhealthy (production scenario 2)
    if (classifyEndpointHealth(71.43, 640, 7) !== 'unhealthy') {
      throw new Error(`Expected 'unhealthy' for 71.43% success + 640ms, got ${classifyEndpointHealth(71.43, 640, 7)}`);
    }
    console.log('[PASS] All 9 classifier boundary semantics verified (healthy, degraded, unhealthy, no_data).');

    const healthResult = await getEndpointHealth(project._id);
    if (!Array.isArray(healthResult) || healthResult.length !== 1) {
      throw new Error('Expected 1 endpoint in health result array');
    }
    const epStat = healthResult[0];
    if (epStat.totalAttempts !== 5) throw new Error(`Expected 5 total attempts, got ${epStat.totalAttempts}`);
    if (epStat.successfulAttempts !== 2) throw new Error(`Expected 2 successful attempts, got ${epStat.successfulAttempts}`);
    if (epStat.failedAttempts !== 3) throw new Error(`Expected 3 failed attempts, got ${epStat.failedAttempts}`);
    if (epStat.health !== 'unhealthy') throw new Error(`Expected endpoint health 'unhealthy' for 40% success rate, got ${epStat.health}`);
    console.log(`[PASS] Endpoint health metrics verified: health=${epStat.health}, successRate=${epStat.successRate}%, avgLatency=${epStat.averageLatencyMs}ms`);

    // 7. Workspace Isolation check
    const emptyWorkspace = await Workspace.create({ name: 'Empty WS', owner: userId });
    const emptyTrends = await getWorkspaceDeliveryTrends(emptyWorkspace._id, '24h');
    if (emptyTrends.data.reduce((a, b) => a + b.totalDeliveries, 0) !== 0) {
      throw new Error('Empty workspace trends must be zero-filled');
    }
    const emptyHealth = await getWorkspaceEndpointHealth(emptyWorkspace._id, '24h');
    if (emptyHealth.endpoints.length !== 0) {
      throw new Error('Empty workspace must have 0 endpoints in health');
    }
    await Workspace.deleteOne({ _id: emptyWorkspace._id });
    console.log('[PASS] Workspace isolation verified across analytics and health.');

    // 8. Operational Health Check (/api/health)
    console.log('Testing operational health endpoint (/api/health)...');
    const healthRes = await axios.get('http://localhost:3001/api/health');
    if (healthRes.status !== 200) throw new Error(`Expected 200 from /api/health, got ${healthRes.status}`);
    const hData = healthRes.data;
    if (hData.status !== 'healthy') throw new Error(`Expected status='healthy', got ${hData.status}`);
    if (hData.dependencies?.mongodb !== 'ready' || hData.dependencies?.redis !== 'ready') {
      throw new Error(`Expected mongodb and redis dependencies ready, got ${JSON.stringify(hData.dependencies)}`);
    }
    if (!hData.dependencies?.queue || typeof hData.dependencies.queue.waiting !== 'number') {
      throw new Error('Expected queue statistics in health response');
    }
    const rawPayload = JSON.stringify(hData);
    if (rawPayload.includes('redis://') || rawPayload.includes('mongodb://') || rawPayload.includes('password')) {
      throw new Error('Health check leaked connection strings or passwords');
    }
    console.log('[PASS] Operational health endpoint verified (/api/health returns healthy with queue stats and no secret leakage).');

    console.log('\n🌟 Analytics, Delivery Trends & Health Tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Analytics test failed:', err.message);
    process.exit(1);
  } finally {
    try {
      if (endpoint) await DeliveryAttempt.deleteMany({ endpointId: endpoint._id });
      if (project) await WebhookEvent.deleteMany({ projectId: project._id });
      if (endpoint) await WebhookEndpoint.deleteOne({ _id: endpoint._id });
      if (project) await Project.deleteOne({ _id: project._id });
      if (workspace) await Workspace.deleteOne({ _id: workspace._id });
      await mongoose.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  runAnalyticsAndTrendsTests();
}

module.exports = runAnalyticsAndTrendsTests;
