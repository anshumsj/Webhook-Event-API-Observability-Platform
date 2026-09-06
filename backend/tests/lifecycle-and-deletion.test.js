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

async function runLifecycleAndDeletionTests() {
  console.log('\n======================================================');
  console.log('  Running Lifecycle, Deletion & Hardening Tests');
  console.log('======================================================\n');

  const baseURL = 'http://localhost:3001/api';
  let email1, email2, workspaceId, projectId;
  let endpointIdA, endpointIdB;
  let eventId1, eventId2, eventId3;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Setup User 1, Workspace, Project
    email1 = `life_test1_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'Lifecycle User 1', email: email1, password });
    const login1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login1.data.token}` } });

    // 2. Audit: Projects do NOT support deletion
    const dummyProjId = new mongoose.Types.ObjectId();
    try {
      await api1.delete(`/projects/${dummyProjId}`);
      throw new Error('DELETE /projects/:id should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Confirmed: Projects do not support deletion (DELETE /api/projects/:id returns 404).');
      } else {
        throw err;
      }
    }

    // 3. Resource reference validation: Malformed and non-existent workspaceId
    try {
      await api1.post('/projects', { name: 'Bad WS Proj', workspaceId: 'not-valid-id' });
      throw new Error('Malformed workspaceId should return 400');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('[PASS] Malformed workspaceId rejected with clean 400 Bad Request.');
      } else {
        throw err;
      }
    }

    try {
      await api1.post('/projects', { name: 'Ghost WS Proj', workspaceId: new mongoose.Types.ObjectId() });
      throw new Error('Non-existent workspaceId should return 403');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Non-existent workspaceId rejected with clean 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // Create valid workspace and project
    const wsRes = await api1.post('/workspaces', { name: 'Lifecycle WS' });
    workspaceId = wsRes.data._id;
    const pRes = await api1.post('/projects', { name: 'Lifecycle Proj', workspaceId });
    projectId = pRes.data._id;

    // Clean auto-created endpoints for exact control
    await WebhookEndpoint.deleteMany({ projectId });

    // 4. Create Endpoint A and Endpoint B
    const epResA = await api1.post(`/endpoints/project/${projectId}`, {
      destinationUrl: 'https://httpbin.org/post'
    });
    endpointIdA = epResA.data.endpointId;
    const endpointDocA = await WebhookEndpoint.findOne({ endpointId: endpointIdA });

    const epResB = await api1.post(`/endpoints/project/${projectId}`, {
      destinationUrl: 'https://httpbin.org/status/200'
    });
    endpointIdB = epResB.data.endpointId;
    const endpointDocB = await WebhookEndpoint.findOne({ endpointId: endpointIdB });
    console.log(`[PASS] Created Endpoint A (${endpointIdA}) and Endpoint B (${endpointIdB}).`);

    // 5. Populate historical events and delivery attempts
    // Event 1 (Endpoint A): order.created, retried (attempt 1 failed 200ms, attempt 2 success 100ms)
    const ev1Doc = await WebhookEvent.create({
      projectId,
      endpointId: endpointDocA._id,
      eventType: 'order.created',
      requestId: `req_ev1_${Date.now()}`,
      status: 'processed',
      payload: { orderId: '1001', amount: 49.99 },
      headers: { 'x-test': 'value-1' },
      processingTimeMs: 15,
      receivedAt: new Date()
    });
    eventId1 = ev1Doc.eventId;

    await DeliveryAttempt.create({
      webhookEventId: ev1Doc._id,
      endpointId: endpointDocA._id,
      attemptNumber: 1,
      status: 'failed',
      responseStatusCode: 500,
      responseBody: 'Internal Server Error',
      destinationUrl: 'https://httpbin.org/post',
      latencyMs: 200,
      startedAt: new Date()
    });
    await DeliveryAttempt.create({
      webhookEventId: ev1Doc._id,
      endpointId: endpointDocA._id,
      attemptNumber: 2,
      status: 'success',
      responseStatusCode: 200,
      responseBody: '{"ok":true}',
      destinationUrl: 'https://httpbin.org/post',
      latencyMs: 100,
      startedAt: new Date()
    });

    // Event 2 (Endpoint A): invoice.paid, failed (1 attempt 300ms)
    const ev2Doc = await WebhookEvent.create({
      projectId,
      endpointId: endpointDocA._id,
      eventType: 'invoice.paid',
      requestId: `req_ev2_${Date.now()}`,
      status: 'failed',
      payload: { invoiceId: 'inv_2002' },
      headers: { 'x-test': 'value-2' },
      processingTimeMs: 25,
      receivedAt: new Date()
    });
    eventId2 = ev2Doc.eventId;

    await DeliveryAttempt.create({
      webhookEventId: ev2Doc._id,
      endpointId: endpointDocA._id,
      attemptNumber: 1,
      status: 'failed',
      responseStatusCode: 502,
      responseBody: 'Bad Gateway',
      destinationUrl: 'https://httpbin.org/post',
      latencyMs: 300,
      startedAt: new Date()
    });

    // Event 3 (Endpoint B): user.signup, processed (1 attempt 150ms)
    const ev3Doc = await WebhookEvent.create({
      projectId,
      endpointId: endpointDocB._id,
      eventType: 'user.signup',
      requestId: `req_ev3_${Date.now()}`,
      status: 'processed',
      payload: { userId: 'usr_3003' },
      headers: { 'x-test': 'value-3' },
      processingTimeMs: 10,
      receivedAt: new Date()
    });
    eventId3 = ev3Doc.eventId;

    await DeliveryAttempt.create({
      webhookEventId: ev3Doc._id,
      endpointId: endpointDocB._id,
      attemptNumber: 1,
      status: 'success',
      responseStatusCode: 200,
      responseBody: 'OK',
      destinationUrl: 'https://httpbin.org/status/200',
      latencyMs: 150,
      startedAt: new Date()
    });
    console.log('[PASS] Populated 3 events and 4 delivery attempts with latencies and retries.');

    // 6. Delete Endpoint A via DELETE /api/endpoints/:endpointId
    const delResA = await api1.delete(`/endpoints/${endpointIdA}`);
    if (delResA.status !== 200 || !delResA.data.success) {
      throw new Error('Failed to delete Endpoint A');
    }
    console.log('[PASS] Successfully deleted Endpoint A (200 OK).');

    // Verify endpoint document is gone from DB
    const epAfter = await WebhookEndpoint.findOne({ endpointId: endpointIdA });
    if (epAfter !== null) throw new Error('Endpoint document was not removed from DB');
    console.log('[PASS] WebhookEndpoint document verified deleted from database.');

    // 7. Active Endpoints listing and Health scoping
    const epList = await api1.get(`/endpoints/project/${projectId}`);
    const listedIds = epList.data.map(e => e.endpointId);
    if (listedIds.includes(endpointIdA)) throw new Error('Deleted Endpoint A must not appear in endpoints list');
    if (!listedIds.includes(endpointIdB)) throw new Error('Existing Endpoint B must appear in endpoints list');
    console.log('[PASS] Endpoints listing only represents active endpoints.');

    const epHealth = await api1.get(`/analytics/project/${projectId}/endpoints`);
    const healthList = Array.isArray(epHealth.data) ? epHealth.data : (epHealth.data.endpoints || []);
    const healthIds = healthList.map(e => e.endpointId);
    if (healthIds.includes(endpointIdA)) throw new Error('Deleted Endpoint A must not appear in endpoint health');
    if (!healthIds.includes(endpointIdB)) throw new Error('Existing Endpoint B must appear in endpoint health');
    console.log('[PASS] Endpoint health only represents active endpoints.');

    // 8. Historical WebhookEvents remain accessible after endpoint deletion
    const eventsRes = await api1.get(`/events/project/${projectId}`);
    const returnedIds = eventsRes.data.events.map(e => e.eventId);
    if (!returnedIds.includes(eventId1) || !returnedIds.includes(eventId2) || !returnedIds.includes(eventId3)) {
      throw new Error('Historical events from deleted endpoints must remain accessible');
    }
    console.log('[PASS] All historical events accessible after endpoint deletion.');

    // 9. Historical DeliveryAttempts remain accessible through Event Details
    const detailRes = await api1.get(`/events/${eventId1}`);
    if (detailRes.data.eventId !== eventId1 || detailRes.data.attempts.length !== 2) {
      throw new Error('Historical delivery attempts not preserved on event details');
    }
    console.log('[PASS] Historical delivery attempts preserved on event details.');

    // 10. Project Analytics preserves historical telemetry (retries, latency)
    const analyticsA = await api1.get(`/analytics/project/${projectId}`);
    if (analyticsA.data.totalEvents !== 3) throw new Error(`Expected 3 total events, got ${analyticsA.data.totalEvents}`);
    if (analyticsA.data.retryRate !== 33.33) throw new Error(`Expected 33.33% retry rate, got ${analyticsA.data.retryRate}`);
    if (analyticsA.data.averageLatencyMs !== 188) throw new Error(`Expected 188ms avg latency, got ${analyticsA.data.averageLatencyMs}`);
    console.log(`[PASS] Project analytics retained telemetry after endpoint deletion: total=3, retryRate=33.33%, avgLatency=188ms.`);

    // 11. Delete Endpoint B as well (0 active endpoints remaining)
    await api1.delete(`/endpoints/${endpointIdB}`);
    const analyticsZeroEp = await api1.get(`/analytics/project/${projectId}`);
    if (analyticsZeroEp.data.totalEvents !== 3 || analyticsZeroEp.data.retryRate !== 33.33 || analyticsZeroEp.data.averageLatencyMs !== 188) {
      throw new Error('Project analytics lost telemetry when zero active endpoints remained');
    }
    console.log('[PASS] Project analytics preserved telemetry with 0 active endpoints in project.');

    // 12. Replay Protection: Deleted endpoint replay rejection
    try {
      await api1.post(`/events/${eventId1}/replay`);
      throw new Error('Replaying event on deleted endpoint should have failed');
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data?.error?.message?.includes('deleted')) {
        console.log(`[PASS] Replay on deleted endpoint cleanly rejected with 400 Bad Request: "${err.response.data.error.message}"`);
      } else {
        throw err;
      }
    }

    // 13. Non-existent resource lookups
    try {
      await api1.get('/events/nonexistent_event_id_xyz');
      throw new Error('Non-existent event should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Non-existent event returns 404.');
      } else {
        throw err;
      }
    }

    try {
      await api1.delete('/endpoints/nonexistent_ep_xyz');
      throw new Error('Non-existent endpoint deletion should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Non-existent endpoint deletion returns 404.');
      } else {
        throw err;
      }
    }

    // 14. Multi-tenant isolation: Unauthorized user checks
    email2 = `life_test2_${Date.now()}@test.com`;
    await axios.post(`${baseURL}/auth/register`, { name: 'Lifecycle User 2', email: email2, password });
    const login2 = await axios.post(`${baseURL}/auth/login`, { email: email2, password });
    const api2 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login2.data.token}` } });

    try {
      await api2.get(`/events/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project events');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: project events returns 403 Forbidden.');
      } else {
        throw err;
      }
    }

    try {
      await api2.get(`/events/${eventId1}`);
      throw new Error('Unauthorized user should NOT access event details');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: event details returns 403 Forbidden.');
      } else {
        throw err;
      }
    }

    try {
      await api2.get(`/analytics/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project analytics');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: project analytics returns 403 Forbidden.');
      } else {
        throw err;
      }
    }

    console.log('\n🌟 Lifecycle, Deletion & Hardening Tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Lifecycle test failed:', err.message, err.response?.data || '');
    process.exit(1);
  } finally {
    try {
      if (projectId) await Project.deleteOne({ _id: projectId });
      if (workspaceId) await Workspace.deleteOne({ _id: workspaceId });
      if (email1) await User.deleteOne({ email: email1 });
      if (email2) await User.deleteOne({ email: email2 });
      if (endpointIdA) await WebhookEndpoint.deleteOne({ endpointId: endpointIdA });
      if (endpointIdB) await WebhookEndpoint.deleteOne({ endpointId: endpointIdB });
      if (eventId1) {
        const e1 = await WebhookEvent.findOne({ eventId: eventId1 });
        if (e1) await DeliveryAttempt.deleteMany({ webhookEventId: e1._id });
        await WebhookEvent.deleteOne({ eventId: eventId1 });
      }
      if (eventId2) {
        const e2 = await WebhookEvent.findOne({ eventId: eventId2 });
        if (e2) await DeliveryAttempt.deleteMany({ webhookEventId: e2._id });
        await WebhookEvent.deleteOne({ eventId: eventId2 });
      }
      if (eventId3) {
        const e3 = await WebhookEvent.findOne({ eventId: eventId3 });
        if (e3) await DeliveryAttempt.deleteMany({ webhookEventId: e3._id });
        await WebhookEvent.deleteOne({ eventId: eventId3 });
      }
      await mongoose.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  runLifecycleAndDeletionTests();
}

module.exports = runLifecycleAndDeletionTests;
