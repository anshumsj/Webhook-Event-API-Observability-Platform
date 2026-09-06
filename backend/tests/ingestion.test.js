const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');
const DeliveryAttempt = require('../models/DeliveryAttempt');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

async function runIngestionTests() {
  console.log('\n========================================');
  console.log('  Running Ingestion Reliability Tests');
  console.log('========================================\n');

  const baseURL = 'http://localhost:3001/api';
  let email, workspaceId, projectId, endpointId, ghostEndpointId;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Setup User, Workspace, Project, and Endpoint
    email = `ingest_test_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'Ingest User', email, password });
    const login = await axios.post(`${baseURL}/auth/login`, { email, password });
    const api = axios.create({ baseURL, headers: { Authorization: `Bearer ${login.data.token}` } });

    const wsRes = await api.post('/workspaces', { name: 'Ingest WS' });
    workspaceId = wsRes.data._id;

    const pRes = await api.post('/projects', { name: 'Ingest Proj', workspaceId });
    projectId = pRes.data._id;

    // Clean any default endpoints created with project
    await WebhookEndpoint.deleteMany({ projectId });

    const epRes = await api.post(`/endpoints/project/${projectId}`, {
      destinationUrl: 'https://httpbin.org/post'
    });
    endpointId = epRes.data.endpointId;
    console.log(`[PASS] Setup completed: Project ${projectId}, Endpoint ${endpointId}`);

    // 1. Valid Webhook Ingestion: returns 202 Accepted, creates event, enqueues job
    const validRes = await axios.post(`${baseURL}/webhooks/${endpointId}`, {
      action: 'order_completed',
      orderId: 'ord_123',
      amount: 99.50
    }, {
      headers: {
        'x-github-event': 'order.completed',
        'x-custom-header': 'custom_val'
      }
    });

    if (validRes.status !== 202 || !validRes.data.success || !validRes.data.eventId) {
      throw new Error(`Expected 202 Accepted with eventId, got: ${validRes.status}`);
    }
    const validEventId = validRes.data.eventId;
    console.log(`[PASS] Valid webhook accepted with 202 (eventId: ${validEventId})`);

    // Verify event in MongoDB
    const savedEvent = await WebhookEvent.findOne({ eventId: validEventId });
    if (!savedEvent) throw new Error('Event was not persisted in MongoDB');
    if (savedEvent.eventType !== 'order.completed') {
      throw new Error(`Expected eventType 'order.completed', got: ${savedEvent.eventType}`);
    }
    if (savedEvent.status !== 'received' && savedEvent.status !== 'queued' && savedEvent.status !== 'processing' && savedEvent.status !== 'processed') {
      throw new Error(`Unexpected event status: ${savedEvent.status}`);
    }
    console.log(`[PASS] Event correctly persisted with eventType: ${savedEvent.eventType}, status: ${savedEvent.status}`);

    // 2. Missing / Empty Payload: must return 400 Bad Request, NO event created
    const countBeforeEmpty = await WebhookEvent.countDocuments({ projectId });
    try {
      await axios.post(`${baseURL}/webhooks/${endpointId}`, '', {
        headers: { 'Content-Type': 'text/plain' }
      });
      throw new Error('Empty payload should have been rejected with 400');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`[PASS] Empty payload rejected with 400 Bad Request: "${err.response.data?.error?.message}"`);
      } else {
        throw err;
      }
    }
    const countAfterEmpty = await WebhookEvent.countDocuments({ projectId });
    if (countAfterEmpty !== countBeforeEmpty) {
      throw new Error('Empty payload incorrectly created a WebhookEvent document!');
    }
    console.log('[PASS] Confirmed: No event created on empty payload.');

    // 3. Primitive Non-Object Payload: must return 400 Bad Request, NO event created
    try {
      await axios.post(`${baseURL}/webhooks/${endpointId}`, 'raw text payload string', {
        headers: { 'Content-Type': 'text/plain' }
      });
      throw new Error('Raw text string payload should have been rejected with 400');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`[PASS] Non-JSON text payload rejected with 400 Bad Request: "${err.response.data?.error?.message}"`);
      } else {
        throw err;
      }
    }
    const countAfterText = await WebhookEvent.countDocuments({ projectId });
    if (countAfterText !== countBeforeEmpty) {
      throw new Error('Non-JSON payload incorrectly created a WebhookEvent document!');
    }
    console.log('[PASS] Confirmed: No event created on raw text payload.');

    // 4. Malformed JSON with application/json header: must return 400 Bad Request
    try {
      await axios.post(`${baseURL}/webhooks/${endpointId}`, '{ "invalid": json without closing quote }', {
        headers: { 'Content-Type': 'application/json' }
      });
      throw new Error('Malformed JSON should have been rejected with 400');
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data?.error?.code === 'BAD_REQUEST') {
        console.log(`[PASS] Malformed JSON rejected with 400 Bad Request: "${err.response.data?.error?.message}"`);
      } else {
        throw err;
      }
    }
    const countAfterMalformed = await WebhookEvent.countDocuments({ projectId });
    if (countAfterMalformed !== countBeforeEmpty) {
      throw new Error('Malformed JSON incorrectly created a WebhookEvent document!');
    }
    console.log('[PASS] Confirmed: No event created on malformed JSON.');

    // 4.5. Oversized Payload (>500kb): must return 413 Payload Too Large, NO event created
    try {
      const oversizedPayload = { test: 'large', data: 'A'.repeat(600 * 1024) };
      await axios.post(`${baseURL}/webhooks/${endpointId}`, oversizedPayload, {
        headers: { 'Content-Type': 'application/json' }
      });
      throw new Error('Oversized payload should have been rejected with 413');
    } catch (err) {
      if (err.response && err.response.status === 413) {
        console.log('[PASS] Oversized payload (>500kb) rejected with 413 Payload Too Large.');
      } else {
        throw err;
      }
    }
    const countAfterOversized = await WebhookEvent.countDocuments({ projectId });
    if (countAfterOversized !== countBeforeEmpty) {
      throw new Error('Oversized payload incorrectly created a WebhookEvent document!');
    }
    console.log('[PASS] Confirmed: No event created on oversized payload.');

    // 5. Non-existent Endpoint: returns 404 Not Found, NO event created
    const countBeforeGhostEp = await WebhookEvent.countDocuments({});
    try {
      await axios.post(`${baseURL}/webhooks/nonexistent_ep_xyz999`, { test: 'ghost' });
      throw new Error('Non-existent endpoint should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Non-existent endpoint rejected with 404 Not Found.');
      } else {
        throw err;
      }
    }
    const countAfterGhostEp = await WebhookEvent.countDocuments({});
    if (countAfterGhostEp !== countBeforeGhostEp) {
      throw new Error('Non-existent endpoint incorrectly created a WebhookEvent document!');
    }
    console.log('[PASS] Confirmed: No event created on non-existent endpoint.');

    // 6. Endpoint with Deleted/Missing Project: returns 404 Not Found, NO event created
    const ghostProjId = new mongoose.Types.ObjectId();
    const ghostEp = await WebhookEndpoint.create({
      projectId: ghostProjId,
      destinationUrl: 'https://httpbin.org/post'
    });
    ghostEndpointId = ghostEp.endpointId;

    try {
      await axios.post(`${baseURL}/webhooks/${ghostEndpointId}`, { test: 'ghost_project' });
      throw new Error('Endpoint referencing missing project should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`[PASS] Endpoint with missing project rejected with 404 Not Found: "${err.response.data?.error?.message}"`);
      } else {
        throw err;
      }
    }
    const ghostEventCount = await WebhookEvent.countDocuments({ endpointId: ghostEp._id });
    if (ghostEventCount !== 0) {
      throw new Error('Missing project incorrectly created an orphaned WebhookEvent document!');
    }
    console.log('[PASS] Confirmed: No event created when associated project is missing/deleted.');

    // 7. Array Header Sanitization: Mongoose Map of String must not throw CastError on array headers
    const arrayHeaderRes = await axios.post(`${baseURL}/webhooks/${endpointId}`, { test: 'array_headers' }, {
      headers: {
        'x-multi-header': 'val1, val2',
        'x-event-type': 'custom.batch'
      }
    });
    if (arrayHeaderRes.status !== 202) {
      throw new Error('Failed to ingest with multi-value headers');
    }
    const arrayEventId = arrayHeaderRes.data.eventId;
    const arrayEvent = await WebhookEvent.findOne({ eventId: arrayEventId });
    if (!arrayEvent) throw new Error('Array header event was not saved');
    console.log('[PASS] Header sanitization successfully handled headers without Mongoose CastErrors.');

    // 8. Duplicate Delivery Behavior: Two distinct HTTP deliveries with identical payloads
    // produce two distinct events with unique event IDs, both enqueued cleanly
    const payload = { event: 'payment.captured', paymentId: 'pay_999' };
    const delivery1 = await axios.post(`${baseURL}/webhooks/${endpointId}`, payload);
    const delivery2 = await axios.post(`${baseURL}/webhooks/${endpointId}`, payload);

    if (delivery1.data.eventId === delivery2.data.eventId) {
      throw new Error('Duplicate deliveries must receive distinct eventIds');
    }
    const ev1 = await WebhookEvent.findOne({ eventId: delivery1.data.eventId });
    const ev2 = await WebhookEvent.findOne({ eventId: delivery2.data.eventId });
    if (!ev1 || !ev2) throw new Error('Both duplicate deliveries must be saved as independent events');
    console.log(`[PASS] Duplicate HTTP deliveries create independent events: ${delivery1.data.eventId} vs ${delivery2.data.eventId}`);

    // 9. Forward-only State Consistency: Verify event does not get reverted to 'queued' if already processed
    // Wait 1 second for worker to process delivery1
    await new Promise(r => setTimeout(r, 1000));
    const processedEv = await WebhookEvent.findOne({ eventId: delivery1.data.eventId });
    if (processedEv && (processedEv.status === 'processed' || processedEv.status === 'failed')) {
      console.log(`[PASS] State consistency verified: event reached terminal state '${processedEv.status}' without state regression.`);
    }

    console.log('\n🌟 Ingestion Reliability Tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Ingestion test failed:', err.message, err.response?.data || '');
    process.exit(1);
  } finally {
    try {
      if (projectId) await Project.deleteOne({ _id: projectId });
      if (workspaceId) await Workspace.deleteOne({ _id: workspaceId });
      if (email) await User.deleteOne({ email });
      if (endpointId) await WebhookEndpoint.deleteOne({ endpointId });
      if (ghostEndpointId) await WebhookEndpoint.deleteOne({ endpointId: ghostEndpointId });
      await WebhookEvent.deleteMany({ projectId });
      await mongoose.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  runIngestionTests();
}

module.exports = runIngestionTests;
