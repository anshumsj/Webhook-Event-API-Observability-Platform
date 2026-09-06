const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getEventsByProject, getProjectEventTypes } = require('../controllers/webhookController');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');

// Mock response helper
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

async function runEventsFilteringTests() {
  console.log('\n=============================================');
  console.log('  Running Events Filtering & Sorting Tests');
  console.log('=============================================\n');

  let workspace, project, endpoint1, endpoint2;
  let otherWorkspace, otherProject, otherEndpoint;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const userId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({ name: 'Filter WS', owner: userId });
    project = await Project.create({ name: 'Filter Proj', workspaceId: workspace._id, createdBy: userId });
    endpoint1 = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'https://httpbin.org/post', secret: '1' });
    endpoint2 = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'https://httpbin.org/post', secret: '2' });

    otherWorkspace = await Workspace.create({ name: 'Other WS', owner: new mongoose.Types.ObjectId() });
    otherProject = await Project.create({ name: 'Other Proj', workspaceId: otherWorkspace._id, createdBy: otherWorkspace.owner });
    otherEndpoint = await WebhookEndpoint.create({ projectId: otherProject._id, destinationUrl: 'https://httpbin.org/post', secret: '3' });

    // Populate events across time and status
    const e1 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint1._id,
      requestId: 'req-1',
      status: 'processed',
      eventType: 'order.created',
      payload: {},
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2h ago
    });
    const e2 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint2._id,
      requestId: 'req-2',
      status: 'failed',
      eventType: 'order.updated',
      payload: {},
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2d ago
    });
    const e3 = await WebhookEvent.create({
      projectId: project._id,
      endpointId: endpoint1._id,
      requestId: 'req-3',
      status: 'retry_exhausted',
      eventType: 'order.created',
      payload: {},
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10) // 10d ago
    });

    const testCases = [
      { name: 'Unfiltered (All)', query: {}, expectedTotal: 3 },
      { name: 'Filter by Status: failed', query: { status: 'failed' }, expectedTotal: 1 },
      { name: 'Filter by Endpoint 1', query: { endpointId: endpoint1.endpointId }, expectedTotal: 2 },
      { name: 'Filter by Event Type', query: { eventType: 'order.updated' }, expectedTotal: 1 },
      { name: 'Combined Filters (endpoint 1 + order.created)', query: { endpointId: endpoint1.endpointId, eventType: 'order.created' }, expectedTotal: 2 },
      { name: 'Time Range (from 24h)', query: { from: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }, expectedTotal: 1 },
      { name: 'Time Range (from 7d)', query: { from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString() }, expectedTotal: 2 },
      { name: 'Search (requestId)', query: { search: 'req-1' }, expectedTotal: 1 }
    ];

    for (const tc of testCases) {
      const req = {
        params: { projectId: project._id },
        query: tc.query,
        user: { id: userId }
      };
      const res = mockResponse();
      await getEventsByProject(req, res);
      if (res.statusCode !== 200) throw new Error(`[${tc.name}] Failed with ${res.statusCode}`);
      if (res.data.pagination.total !== tc.expectedTotal) {
        throw new Error(`[${tc.name}] Expected ${tc.expectedTotal}, got ${res.data.pagination.total}`);
      }
      console.log(`[PASS] ${tc.name}`);
    }

    // Foreign endpoint isolation
    const reqIso = {
      params: { projectId: project._id },
      query: { endpointId: otherEndpoint.endpointId },
      user: { id: userId }
    };
    const resIso = mockResponse();
    await getEventsByProject(reqIso, resIso);
    if (resIso.statusCode !== 404) throw new Error(`Isolation failed: expected 404, got ${resIso.statusCode}`);
    console.log('[PASS] Isolation test (foreign endpoint rejected with 404).');

    // Sorting & Pagination tests
    const sortTests = [
      {
        name: 'Default sorting (newest first)',
        query: {},
        expectedOrder: [e1.eventId, e2.eventId, e3.eventId]
      },
      {
        name: 'Oldest-first sorting (order=asc)',
        query: { order: 'asc' },
        expectedOrder: [e3.eventId, e2.eventId, e1.eventId]
      },
      {
        name: 'Invalid sorting fallback',
        query: { sort: 'invalid', order: 'INVALID' },
        expectedOrder: [e1.eventId, e2.eventId, e3.eventId]
      },
      {
        name: 'Combined filtering + sorting',
        query: { endpointId: endpoint1.endpointId, order: 'asc' },
        expectedOrder: [e3.eventId, e1.eventId]
      },
      {
        name: 'Pagination + sorting (asc page 1, limit 1)',
        query: { order: 'asc', page: 1, limit: 1 },
        expectedOrder: [e3.eventId]
      }
    ];

    for (const tc of sortTests) {
      const req = {
        params: { projectId: project._id },
        query: tc.query,
        user: { id: userId }
      };
      const res = mockResponse();
      await getEventsByProject(req, res);
      if (res.statusCode !== 200) throw new Error(`[${tc.name}] Failed with ${res.statusCode}`);
      const returnedIds = res.data.events.map(e => e.eventId);
      if (JSON.stringify(returnedIds) !== JSON.stringify(tc.expectedOrder)) {
        throw new Error(`[${tc.name}] Expected ${JSON.stringify(tc.expectedOrder)}, got ${JSON.stringify(returnedIds)}`);
      }
      console.log(`[PASS] ${tc.name}`);
    }

    // Event Types extraction test
    const reqTypes = { params: { projectId: project._id }, user: { id: userId } };
    const resTypes = mockResponse();
    await getProjectEventTypes(reqTypes, resTypes);
    if (resTypes.statusCode !== 200 || resTypes.data.length !== 2) {
      throw new Error(`Expected 2 event types, got ${resTypes.data?.length}`);
    }
    console.log('[PASS] Event Types extraction verified.');

    console.log('\n🌟 Events Filtering & Sorting Tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Filtering test failed:', err.message);
    process.exit(1);
  } finally {
    try {
      if (project) await WebhookEvent.deleteMany({ projectId: project._id });
      if (project) await WebhookEndpoint.deleteMany({ projectId: project._id });
      if (otherProject) await WebhookEndpoint.deleteMany({ projectId: otherProject._id });
      if (project) await Project.deleteOne({ _id: project._id });
      if (otherProject) await Project.deleteOne({ _id: otherProject._id });
      if (workspace) await Workspace.deleteOne({ _id: workspace._id });
      if (otherWorkspace) await Workspace.deleteOne({ _id: otherWorkspace._id });
      await mongoose.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  runEventsFilteringTests();
}

module.exports = runEventsFilteringTests;
