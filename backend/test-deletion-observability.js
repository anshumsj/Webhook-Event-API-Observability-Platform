const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');
const Project = require('./models/Project');
const Workspace = require('./models/Workspace');
const User = require('./models/User');

async function runTest() {
  const baseURL = 'http://localhost:3001/api';
  let email1, email2, workspaceId, projectId, endpointIdA, endpointIdB, eventId1, eventId2, eventId3;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Setup User 1, Workspace, Project
    email1 = `obs_test1_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'Obs User 1', email: email1, password });
    const login1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login1.data.token}` } });

    const wsRes = await api1.post('/workspaces', { name: 'Observability Test WS' });
    workspaceId = wsRes.data._id;

    const pRes = await api1.post('/projects', { name: 'Observability Test Proj', workspaceId });
    projectId = pRes.data._id;

    // Clean up any auto-generated endpoint so the test has deterministic endpoints
    await WebhookEndpoint.deleteMany({ projectId });

    // 2. Create Endpoint A and Endpoint B
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
    console.log(`[PASS] Created Endpoint A (${endpointIdA}) and Endpoint B (${endpointIdB})`);

    // 3. Populate historical events and delivery attempts
    // Event 1 (Endpoint A): order.created, retried (attempt 1 failed, attempt 2 success)
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

    // Event 2 (Endpoint A): invoice.paid, failed
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

    // Event 3 (Endpoint B): user.signup, processed (1 attempt)
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

    // 4. Check initial project analytics (before deletion)
    const preAnalytics = await api1.get(`/analytics/project/${projectId}`);
    if (preAnalytics.data.totalEvents !== 3) throw new Error(`Expected 3 total events, got ${preAnalytics.data.totalEvents}`);
    if (preAnalytics.data.retryRate !== 33.33) throw new Error(`Expected 33.33% retry rate, got ${preAnalytics.data.retryRate}`);
    // Average latency: (200 + 100 + 300 + 150) / 4 = 188
    if (preAnalytics.data.averageLatencyMs !== 188) throw new Error(`Expected 188ms avg latency, got ${preAnalytics.data.averageLatencyMs}`);
    console.log(`[PASS] Initial project analytics verified: total=${preAnalytics.data.totalEvents}, retryRate=${preAnalytics.data.retryRate}%, avgLatency=${preAnalytics.data.averageLatencyMs}ms`);

    // 5. Delete Endpoint A
    const delResA = await api1.delete(`/endpoints/${endpointIdA}`);
    if (delResA.status !== 200 || !delResA.data.success) {
      throw new Error(`Failed to delete Endpoint A: ${JSON.stringify(delResA.data)}`);
    }
    console.log('[PASS] Successfully deleted Endpoint A via DELETE /api/endpoints/:endpointId');

    // 6. Endpoint health and listing: should ONLY represent currently existing endpoints
    const epListRes = await api1.get(`/endpoints/project/${projectId}`);
    const remainingEpIds = epListRes.data.map(e => e.endpointId);
    if (remainingEpIds.includes(endpointIdA)) throw new Error('Deleted Endpoint A should not appear in endpoints list');
    if (!remainingEpIds.includes(endpointIdB)) throw new Error('Existing Endpoint B must appear in endpoints list');
    console.log(`[PASS] Endpoint listing contains only existing endpoints (${remainingEpIds.join(', ')}).`);

    const epHealthRes = await api1.get(`/analytics/project/${projectId}/endpoints`);
    const epHealthList = Array.isArray(epHealthRes.data) ? epHealthRes.data : (epHealthRes.data.endpoints || []);
    const healthEpIds = epHealthList.map(e => e.endpointId);
    if (healthEpIds.includes(endpointIdA)) throw new Error('Deleted Endpoint A should not appear in endpoint health');
    if (!healthEpIds.includes(endpointIdB)) throw new Error('Existing Endpoint B must appear in endpoint health');
    console.log('[PASS] Endpoint health contains only existing endpoints.');

    // 7. Historical WebhookEvents must remain accessible after endpoint deletion
    const allEventsRes = await api1.get(`/events/project/${projectId}`);
    const returnedEventIds = allEventsRes.data.events.map(e => e.eventId);
    if (!returnedEventIds.includes(eventId1) || !returnedEventIds.includes(eventId2) || !returnedEventIds.includes(eventId3)) {
      throw new Error(`All historical events must be returned. Got: ${returnedEventIds.join(', ')}`);
    }
    console.log('[PASS] All historical events (including from deleted Endpoint A) are accessible.');

    // 8. Event filtering by status/event type/time range/search must continue working
    // Filter by status=processed
    const processedRes = await api1.get(`/events/project/${projectId}?status=processed`);
    const processedIds = processedRes.data.events.map(e => e.eventId);
    if (!processedIds.includes(eventId1) || !processedIds.includes(eventId3) || processedIds.includes(eventId2)) {
      throw new Error(`Status filter failed: ${processedIds.join(', ')}`);
    }
    console.log('[PASS] Status filtering works across active and deleted endpoints.');

    // Filter by status=failed
    const failedRes = await api1.get(`/events/project/${projectId}?status=failed`);
    const failedIds = failedRes.data.events.map(e => e.eventId);
    if (!failedIds.includes(eventId2) || failedIds.length !== 1) {
      throw new Error(`Failed status filter failed: ${failedIds.join(', ')}`);
    }
    console.log('[PASS] Status filter for failed event belonging to deleted endpoint works.');

    // Filter by eventType=order.created
    const typeRes = await api1.get(`/events/project/${projectId}?eventType=order.created`);
    const typeIds = typeRes.data.events.map(e => e.eventId);
    if (!typeIds.includes(eventId1) || typeIds.length !== 1) {
      throw new Error(`EventType filter failed: ${typeIds.join(', ')}`);
    }
    console.log('[PASS] EventType filtering for deleted endpoint event works.');

    // Filter by search (searches eventId, eventType, requestId)
    const searchRes = await api1.get(`/events/project/${projectId}?search=req_ev2`);
    const searchIds = searchRes.data.events.map(e => e.eventId);
    if (!searchIds.includes(eventId2) || searchIds.length !== 1) {
      throw new Error(`Search filter failed: ${searchIds.join(', ')}`);
    }
    console.log('[PASS] Search filtering for deleted endpoint event works.');

    // Filter by time range
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const future = new Date(now.getTime() + 60000);
    const timeRes = await api1.get(`/events/project/${projectId}?from=${past.toISOString()}&to=${future.toISOString()}`);
    if (timeRes.data.events.length !== 3) {
      throw new Error(`Time range filter failed: expected 3, got ${timeRes.data.events.length}`);
    }
    console.log('[PASS] Time range filtering works when events reference deleted endpoints.');

    // 9. Historical DeliveryAttempts must remain accessible through Event Details
    const detailRes1 = await api1.get(`/events/${eventId1}`);
    if (!detailRes1.data || detailRes1.data.eventId !== eventId1) {
      throw new Error('Failed to retrieve Event 1 details');
    }
    if (!detailRes1.data.attempts || detailRes1.data.attempts.length !== 2) {
      throw new Error(`Expected 2 delivery attempts for Event 1, got ${detailRes1.data.attempts?.length}`);
    }
    if (detailRes1.data.attempts[0].status !== 'failed' || detailRes1.data.attempts[1].status !== 'success') {
      throw new Error('Delivery attempt statuses do not match expected values');
    }
    console.log('[PASS] Historical delivery attempts fully accessible through Event Details for deleted endpoint.');

    // 10. Project-level analytics must continue accounting for historical events/delivery attempts belonging to deleted endpoints
    const postAnalyticsA = await api1.get(`/analytics/project/${projectId}`);
    if (postAnalyticsA.data.totalEvents !== 3) {
      throw new Error(`Analytics totalEvents lost after deletion: expected 3, got ${postAnalyticsA.data.totalEvents}`);
    }
    if (postAnalyticsA.data.retryRate !== 33.33) {
      throw new Error(`Analytics retryRate silently lost historical retries: expected 33.33, got ${postAnalyticsA.data.retryRate}`);
    }
    if (postAnalyticsA.data.averageLatencyMs !== 188) {
      throw new Error(`Analytics averageLatencyMs silently lost historical latency: expected 188, got ${postAnalyticsA.data.averageLatencyMs}`);
    }
    console.log(`[PASS] Project analytics retained telemetry after Endpoint A deletion: total=${postAnalyticsA.data.totalEvents}, retryRate=${postAnalyticsA.data.retryRate}%, avgLatency=${postAnalyticsA.data.averageLatencyMs}ms`);

    // 11. Delete Endpoint B as well (zero active endpoints in project)
    const delResB = await api1.delete(`/endpoints/${endpointIdB}`);
    if (delResB.status !== 200 || !delResB.data.success) {
      throw new Error(`Failed to delete Endpoint B: ${JSON.stringify(delResB.data)}`);
    }
    console.log('[PASS] Successfully deleted Endpoint B (0 active endpoints remaining).');

    // Verify analytics STILL preserve telemetry even when ALL endpoints in project are deleted
    const postAnalyticsAllDeleted = await api1.get(`/analytics/project/${projectId}`);
    if (postAnalyticsAllDeleted.data.totalEvents !== 3) {
      throw new Error(`Analytics totalEvents lost when all endpoints deleted: expected 3, got ${postAnalyticsAllDeleted.data.totalEvents}`);
    }
    if (postAnalyticsAllDeleted.data.retryRate !== 33.33) {
      throw new Error(`Analytics retryRate lost when all endpoints deleted: expected 33.33, got ${postAnalyticsAllDeleted.data.retryRate}`);
    }
    if (postAnalyticsAllDeleted.data.averageLatencyMs !== 188) {
      throw new Error(`Analytics averageLatencyMs lost when all endpoints deleted: expected 188, got ${postAnalyticsAllDeleted.data.averageLatencyMs}`);
    }
    console.log('[PASS] Project analytics preserved all historical telemetry even with 0 active endpoints in project!');

    // 12. A deleted endpoint must not be resurrected or treated as active (Replay check)
    try {
      await api1.post(`/events/${eventId1}/replay`);
      throw new Error('Replaying event on deleted endpoint should have failed!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`[PASS] Replay rejected as expected (400 Bad Request): "${err.response.data?.error?.message || err.response.data?.message}"`);
      } else {
        throw err;
      }
    }

    // 13. Multi-tenant isolation: unauthorized user cannot access deleted endpoint's events or analytics
    email2 = `obs_test2_${Date.now()}@test.com`;
    await axios.post(`${baseURL}/auth/register`, { name: 'Obs User 2', email: email2, password });
    const login2 = await axios.post(`${baseURL}/auth/login`, { email: email2, password });
    const api2 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login2.data.token}` } });

    try {
      await api2.get(`/events/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project events');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: unauthorized events access returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    try {
      await api2.get(`/events/${eventId1}`);
      throw new Error('Unauthorized user should NOT access event details');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: unauthorized event details returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    try {
      await api2.get(`/analytics/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project analytics');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: unauthorized project analytics returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    console.log('\n🌟 All Historical Observability Deletion tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message, err.response?.data || '');
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

runTest();
