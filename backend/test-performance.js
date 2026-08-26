require('dotenv').config();
const mongoose = require('mongoose');
// const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');
const analyticsService = require('./services/analyticsService');

// Mock request/response for controllers
const mockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

const runTests = async () => {
  console.log('--- STARTING COMMIT 57 PERFORMANCE TESTS ---');
  
  await mongoose.connect(process.env.MONGODB_URI);
  
  let testUser, workspace, project, endpoint, recentEvent, oldEvent;

  try {
    // ----------------------------------------------------------------
    // TEST A: INDEXES
    // ----------------------------------------------------------------
    console.log('\n[TEST A] Verifying Indexes...');
    
    // Mongoose creates indexes asynchronously on startup. We wait just in case.
    await Workspace.init();
    await Project.init();
    await WebhookEvent.init();
    await DeliveryAttempt.init();
    
    const workspaceIndexes = await Workspace.collection.getIndexes();
    const projectIndexes = await Project.collection.getIndexes();
    const eventIndexes = await WebhookEvent.collection.getIndexes();
    const attemptIndexes = await DeliveryAttempt.collection.getIndexes();
    
    const hasWorkspaceOwnerIndex = Object.values(workspaceIndexes).some(idx => idx.key && idx.key.owner === 1);
    const hasWorkspaceMembersIndex = Object.values(workspaceIndexes).some(idx => idx.key && idx.key.members === 1);
    const hasProjectWorkspaceIdIndex = Object.values(projectIndexes).some(idx => idx.key && idx.key.workspaceId === 1);
    const hasEventCompoundIndex = Object.values(eventIndexes).some(idx => idx.key && idx.key.projectId === 1 && idx.key.endpointId === 1 && idx.key.receivedAt === -1);
    const hasAttemptCompoundIndex = Object.values(attemptIndexes).some(idx => idx.key && idx.key.endpointId === 1 && idx.key.startedAt === -1);
    
    console.assert(hasWorkspaceOwnerIndex, 'Workspace owner index missing');
    console.assert(hasWorkspaceMembersIndex, 'Workspace members index missing');
    console.assert(hasProjectWorkspaceIdIndex, 'Project workspaceId index missing');
    console.assert(hasEventCompoundIndex, 'WebhookEvent projectId_endpointId_receivedAt index missing');
    console.assert(hasAttemptCompoundIndex, 'DeliveryAttempt endpointId_startedAt index missing');
    console.log('✅ All performance indexes verified in MongoDB.');

    // ----------------------------------------------------------------
    // SETUP MOCK DATA
    // ----------------------------------------------------------------
    testUser = await User.create({ email: 'perf-test@example.com', passwordHash: 'password123', name: 'Perf User' });
    workspace = await Workspace.create({ name: 'Perf Workspace', owner: testUser._id });
    project = await Project.create({ name: 'Perf Project', workspaceId: workspace._id, createdBy: testUser._id });
    endpoint = await WebhookEndpoint.create({ 
      projectId: project._id, 
      destinationUrl: 'https://example.com', 
      secret: 'perfsecret', 
      createdBy: testUser._id,
      name: 'Perf Endpoint'
    });

    // ----------------------------------------------------------------
    // TEST B: ANALYTICS TIME BOUNDARY
    // ----------------------------------------------------------------
    console.log('\n[TEST B] Verifying Analytics Time Boundaries...');

    // 1. Create OLD event (60 days ago) - outside default 30d range
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

    // 2. Create RECENT event (2 days ago) - inside default 30d range
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

    // Run Analytics
    const analytics = await analyticsService.getProjectAnalytics(project._id, '30d');
    
    console.assert(analytics.totalEvents === 1, `Expected 1 total event, got ${analytics.totalEvents}`);
    console.assert(analytics.failedEvents === 1, `Expected 1 failed event, got ${analytics.failedEvents}`);
    console.assert(analytics.processedEvents === 0, `Expected 0 processed events, got ${analytics.processedEvents}`);
    console.log('✅ Historical records outside timeRange successfully excluded from analytics.');


    // ----------------------------------------------------------------
    // TEST C: EVENT RESPONSE SIZE
    // ----------------------------------------------------------------
    console.log('\n[TEST C] Verifying Event Response Truncation...');

    // Create a 50,000 char response body
    const largeBody = 'A'.repeat(50000);
    const smallBody = 'Small response';

    const largeEvent = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint._id,
      requestId: 'req-large',
      payload: { large: true },
      status: 'failed'
    });

    // Attempt 1: small body
    await DeliveryAttempt.create({
      webhookEventId: largeEvent._id,
      endpointId: endpoint._id,
      attemptNumber: 1,
      status: 'failed',
      responseBody: smallBody,
      destinationUrl: 'https://example.com'
    });

    // Attempt 2: large body (50k chars)
    await DeliveryAttempt.create({
      webhookEventId: largeEvent._id,
      endpointId: endpoint._id,
      attemptNumber: 2,
      status: 'failed',
      responseBody: largeBody,
      destinationUrl: 'https://example.com'
    });

    // Fetch via API controller
    const { getEventById } = require('./controllers/webhookController');
    const req = { 
      params: { eventId: largeEvent.eventId },
      user: { id: testUser._id }
    };
    const res = mockResponse();

    await getEventById(req, res);

    const data = res.body;
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.assert(data.attempts.length === 2, `Expected 2 attempts, got ${data.attempts?.length}`);
    
    const attempt1 = data.attempts[0];
    const attempt2 = data.attempts[1];

    console.assert(attempt1.responseBody === smallBody, 'Small body should be untouched');
    console.assert(!attempt1.responseBodyTruncated, 'Small body should not have truncated flag');

    console.assert(attempt2.responseBody.length === 10000, `Large body should be exactly 10,000 chars, got ${attempt2.responseBody.length}`);
    console.assert(attempt2.responseBodyTruncated === true, 'Large body should have truncated flag === true');
    console.assert(!attempt2.responseBody.includes('[Response body truncated'), 'Large body should not have extra text appended to exceed 10000 chars');

    // Verify DB still has 50k chars
    const dbAttempt2 = await DeliveryAttempt.findOne({ webhookEventId: largeEvent._id, attemptNumber: 2 });
    console.assert(dbAttempt2.responseBody.length === 50000, `DB should have 50,000 chars, got ${dbAttempt2.responseBody.length}`);
    
    console.log('✅ Event response body safely truncated in API while preserved in MongoDB.');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    // ----------------------------------------------------------------
    // TEST D: REGRESSION SAFETY (CLEANUP)
    // ----------------------------------------------------------------
    console.log('\n[CLEANUP] Removing test data...');
    if (project) {
      await DeliveryAttempt.deleteMany({ endpointId: endpoint._id });
      await WebhookEvent.deleteMany({ projectId: project._id });
      await WebhookEndpoint.findByIdAndDelete(endpoint._id);
      await Project.findByIdAndDelete(project._id);
    }
    if (workspace) await Workspace.findByIdAndDelete(workspace._id);
    if (testUser) await User.findByIdAndDelete(testUser._id);

    await mongoose.disconnect();
    console.log('✅ Cleanup complete. Exiting.');
  }
};

runTests();
