const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');
const DeliveryAttempt = require('../models/DeliveryAttempt');
const analyticsService = require('../services/analyticsService');
const { getEventById } = require('../controllers/webhookController');

const mockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

const runBenchmarks = async () => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        HookSight DB Index & Cache Performance Benchmark      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
  await mongoose.connect(mongoUri);
  
  let testUser, workspace, project, endpoint, recentEvent, oldEvent;

  try {
    // ----------------------------------------------------------------
    // 1. VERIFY INDEXES
    // ----------------------------------------------------------------
    console.log('[1/3] Verifying Database Indexes...');
    
    await Workspace.createIndexes();
    await Project.createIndexes();
    await WebhookEvent.createIndexes();
    await DeliveryAttempt.createIndexes();
    
    const workspaceIndexes = await Workspace.collection.getIndexes();
    const projectIndexes = await Project.collection.getIndexes();
    const eventIndexes = await WebhookEvent.collection.getIndexes();
    const attemptIndexes = await DeliveryAttempt.collection.getIndexes();
    
    const hasIndex = (idxObj, key) => Object.keys(idxObj).some(n => n.includes(key)) || Object.values(idxObj).some(v => Array.isArray(v) && v.some(([k]) => k === key));
    
    if (!hasIndex(workspaceIndexes, 'owner')) throw new Error('Workspace owner index missing');
    if (!hasIndex(workspaceIndexes, 'members')) throw new Error('Workspace members index missing');
    if (!hasIndex(projectIndexes, 'workspaceId')) throw new Error('Project workspaceId index missing');
    if (!hasIndex(eventIndexes, 'projectId')) throw new Error('WebhookEvent compound index missing');
    if (!hasIndex(attemptIndexes, 'endpointId')) throw new Error('DeliveryAttempt compound index missing');
    console.log('[PASS] All MongoDB compound indexes verified.');

    // ----------------------------------------------------------------
    // 2. QUERY TIMING & TIME BOUNDARIES
    // ----------------------------------------------------------------
    console.log('\n[2/3] Benchmarking Query Execution Timing & Time Boundaries...');
    testUser = await User.create({ email: `perf_${Date.now()}@example.com`, passwordHash: 'password123', name: 'Perf User' });
    workspace = await Workspace.create({ name: 'Perf Workspace', owner: testUser._id });
    project = await Project.create({ name: 'Perf Project', workspaceId: workspace._id, createdBy: testUser._id });
    endpoint = await WebhookEndpoint.create({ 
      projectId: project._id, 
      destinationUrl: 'https://example.com', 
      secret: 'perfsecret', 
      createdBy: testUser._id,
      name: 'Perf Endpoint'
    });

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60);
    oldEvent = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-old',
      payload: { old: true },
      status: 'processed',
      receivedAt: oldDate
    });
    await DeliveryAttempt.create({
      webhookEventId: oldEvent._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'success',
      startedAt: oldDate,
      destinationUrl: 'https://example.com'
    });

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2);
    recentEvent = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-recent',
      payload: { recent: true },
      status: 'failed',
      receivedAt: recentDate
    });
    await DeliveryAttempt.create({
      webhookEventId: recentEvent._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'failed',
      startedAt: recentDate,
      destinationUrl: 'https://example.com'
    });

    const tStart = Date.now();
    const analytics = await analyticsService.getProjectAnalytics(project._id, '30d');
    const queryDurationMs = Date.now() - tStart;
    
    if (analytics.totalEvents !== 1) throw new Error(`Expected 1 total event, got ${analytics.totalEvents}`);
    if (analytics.failedEvents !== 1) throw new Error(`Expected 1 failed event, got ${analytics.failedEvents}`);
    console.log(`[PASS] Time-bounded analytics query completed in ${queryDurationMs}ms (indexed lookup).`);

    // ----------------------------------------------------------------
    // 3. EVENT RESPONSE TRUNCATION BENCHMARK
    // ----------------------------------------------------------------
    console.log('\n[3/3] Benchmarking API Response Body Truncation Overhead...');
    const largeBody = 'A'.repeat(50000);
    const largeEvent = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-large',
      payload: { large: true },
      status: 'failed'
    });

    await DeliveryAttempt.create({
      webhookEventId: largeEvent._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'failed',
      responseBody: 'Small response',
      destinationUrl: 'https://example.com'
    });
    await DeliveryAttempt.create({
      webhookEventId: largeEvent._id,
      endpointId: endpoint._id,
      attemptNumber: 2,
      status: 'failed',
      responseBody: largeBody,
      destinationUrl: 'https://example.com'
    });

    const req = { 
      params: { eventId: largeEvent.eventId },
      user: { id: testUser._id }
    };
    const res = mockResponse();

    const tTruncStart = Date.now();
    await getEventById(req, res);
    const truncDurationMs = Date.now() - tTruncStart;

    const data = res.body;
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (data.attempts[1].responseBody.length !== 10000) {
      throw new Error(`Large body was not truncated to 10000 chars (got ${data.attempts[1].responseBody.length})`);
    }
    console.log(`[PASS] API response payload truncation completed in ${truncDurationMs}ms.`);

    console.log('\n🌟 DB Indexes and Performance Benchmarks PASSED!\n');
  } catch (error) {
    console.error('\n❌ BENCHMARK FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (project) {
      await DeliveryAttempt.deleteMany({ endpointId: endpoint?._id });
      await WebhookEvent.deleteMany({ projectId: project?._id });
      await WebhookEndpoint.deleteMany({ projectId: project?._id });
      await Project.deleteOne({ _id: project?._id });
    }
    if (workspace) await Workspace.deleteOne({ _id: workspace._id });
    if (testUser) await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  runBenchmarks();
}

module.exports = runBenchmarks;
