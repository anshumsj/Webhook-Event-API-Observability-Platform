require('dotenv').config();
const mongoose = require('mongoose');
const { getEventsByProject, getProjectEventTypes } = require('./controllers/webhookController');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');

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

async function testFilters() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const userId = new mongoose.Types.ObjectId();
  const workspace = await Workspace.create({ name: 'Test WS', owner: userId });
  const project = await Project.create({ name: 'Test Project', workspaceId: workspace._id, createdBy: userId });
  const endpoint1 = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://a', secret: '1' });
  const endpoint2 = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://b', secret: '2' });

  const otherWorkspace = await Workspace.create({ name: 'Other WS', owner: new mongoose.Types.ObjectId() });
  const otherProject = await Project.create({ name: 'Other Project', workspaceId: otherWorkspace._id, createdBy: otherWorkspace.owner });
  const otherEndpoint = await WebhookEndpoint.create({ projectId: otherProject._id, destinationUrl: 'http://c', secret: '3' });

  // Create events
  const e1 = await WebhookEvent.create({ projectId: project._id, endpointId: endpoint1._id, requestId: 'req-1', status: 'processed', eventType: 'order.created', payload: {}, receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 2) }); // 2h ago
  const e2 = await WebhookEvent.create({ projectId: project._id, endpointId: endpoint2._id, requestId: 'req-2', status: 'failed', eventType: 'order.updated', payload: {}, receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) }); // 2d ago
  const e3 = await WebhookEvent.create({ projectId: project._id, endpointId: endpoint1._id, requestId: 'req-3', status: 'retry_exhausted', eventType: 'order.created', payload: {}, receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10) }); // 10d ago

  const testCases = [
    {
      name: 'Unfiltered (All)',
      query: {},
      expectedTotal: 3
    },
    {
      name: 'Filter by Status: failed',
      query: { status: 'failed' },
      expectedTotal: 1
    },
    {
      name: 'Filter by Endpoint 1',
      query: { endpointId: endpoint1.endpointId },
      expectedTotal: 2
    },
    {
      name: 'Filter by Event Type',
      query: { eventType: 'order.updated' },
      expectedTotal: 1
    },
    {
      name: 'Combined Filters (endpoint 1 + order.created)',
      query: { endpointId: endpoint1.endpointId, eventType: 'order.created' },
      expectedTotal: 2
    },
    {
      name: 'Time Range (from 24h)',
      query: { from: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
      expectedTotal: 1 // only e1
    },
    {
      name: 'Time Range (from 7d)',
      query: { from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString() },
      expectedTotal: 2 // e1, e2
    },
    {
      name: 'Search (regex safety)',
      query: { search: 'req-1' },
      expectedTotal: 1
    }
  ];

  for (const tc of testCases) {
    const req = {
      params: { projectId: project._id },
      query: tc.query,
      user: { id: userId }
    };
    const res = mockResponse();
    await getEventsByProject(req, res);
    if (res.statusCode !== 200) throw new Error(`[${tc.name}] Failed with ${res.statusCode}: ${JSON.stringify(res.data)}`);
    if (res.data.pagination.total !== tc.expectedTotal) {
      throw new Error(`[${tc.name}] Expected ${tc.expectedTotal}, got ${res.data.pagination.total}`);
    }
    console.log(`[PASS] ${tc.name}`);
  }

  // Isolation test: Try to query with endpoint belonging to another project
  const reqIso = {
    params: { projectId: project._id },
    query: { endpointId: otherEndpoint.endpointId },
    user: { id: userId }
  };
  const resIso = mockResponse();
  await getEventsByProject(reqIso, resIso);
  if (resIso.statusCode !== 404) throw new Error(`Isolation failed, expected 404 but got ${resIso.statusCode}`);
  console.log(`[PASS] Isolation test (foreign endpoint)`);

  // Sorting tests
  const sortTests = [
    {
      name: 'Default sorting (No sort/order -> newest first)',
      query: {},
      expectedOrder: [e1.eventId, e2.eventId, e3.eventId]
    },
    {
      name: 'Oldest-first sorting (order=asc)',
      query: { order: 'asc' },
      expectedOrder: [e3.eventId, e2.eventId, e1.eventId]
    },
    {
      name: 'Invalid sorting (fallback to newest-first)',
      query: { sort: 'payload', order: 'DROP_TABLE' },
      expectedOrder: [e1.eventId, e2.eventId, e3.eventId]
    },
    {
      name: 'Combined filtering + sorting (endpoint 1 + asc)',
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

  // Event types test
  const reqTypes = { params: { projectId: project._id }, user: { id: userId } };
  const resTypes = mockResponse();
  await getProjectEventTypes(reqTypes, resTypes);
  if (resTypes.statusCode !== 200) throw new Error('Types failed');
  if (resTypes.data.length !== 2) throw new Error(`Expected 2 event types, got ${resTypes.data.length}`);
  console.log(`[PASS] Event Types extraction`);

  console.log('All backend filter tests passed!');

  // Cleanup
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: otherProject._id });
  await Project.findByIdAndDelete(project._id);
  await Project.findByIdAndDelete(otherProject._id);
  await Workspace.findByIdAndDelete(workspace._id);
  await Workspace.findByIdAndDelete(otherWorkspace._id);
  process.exit(0);
}

testFilters().catch(err => {
  console.error(err);
  process.exit(1);
});
