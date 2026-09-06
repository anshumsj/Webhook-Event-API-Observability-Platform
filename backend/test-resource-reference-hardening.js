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
  let email1, email2, workspaceId, projectId, endpointId, eventId;
  let orphanedEndpointId;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Setup User 1, Workspace, Project
    email1 = `harden_test1_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'Harden User 1', email: email1, password });
    const login1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login1.data.token}` } });

    // Test 1: Verify projects do NOT support deletion (no route)
    const dummyProjectId = new mongoose.Types.ObjectId();
    try {
      await api1.delete(`/projects/${dummyProjectId}`);
      throw new Error('DELETE /projects/:projectId should NOT exist');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Confirmed: Projects do not support deletion (DELETE /api/projects/:id returned 404 route not found).');
      } else {
        throw err;
      }
    }

    // Test 2: Project creation with malformed workspaceId -> Expect 400 Bad Request (not 500)
    try {
      await api1.post('/projects', { name: 'Malformed WS Proj', workspaceId: 'invalid-workspace-id' });
      throw new Error('Project creation with malformed workspaceId should return 400');
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data?.error?.code === 'BAD_REQUEST') {
        console.log(`[PASS] Malformed workspaceId rejected cleanly with 400 Bad Request: "${err.response.data.error.message}"`);
      } else {
        throw new Error(`Expected 400 Bad Request, got: ${err.response?.status} ${JSON.stringify(err.response?.data)}`);
      }
    }

    // Test 3: Project creation with non-existent workspaceId -> Expect 403 Forbidden (not 500)
    const randomWsId = new mongoose.Types.ObjectId();
    try {
      await api1.post('/projects', { name: 'Nonexistent WS Proj', workspaceId: randomWsId });
      throw new Error('Project creation with non-existent workspaceId should return 403');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Non-existent workspaceId rejected cleanly with 403 Forbidden.');
      } else {
        throw new Error(`Expected 403 Forbidden, got: ${err.response?.status} ${JSON.stringify(err.response?.data)}`);
      }
    }

    // Create valid workspace and project
    const wsRes = await api1.post('/workspaces', { name: 'Harden Test WS' });
    workspaceId = wsRes.data._id;

    const pRes = await api1.post('/projects', { name: 'Harden Test Proj', workspaceId });
    projectId = pRes.data._id;

    // Create valid endpoint
    const epRes = await api1.post(`/endpoints/project/${projectId}`, {
      destinationUrl: 'https://httpbin.org/post'
    });
    endpointId = epRes.data.endpointId;
    console.log(`[PASS] Created valid project (${projectId}) and endpoint (${endpointId}).`);

    // Ingest valid webhook to establish historical event and attempt
    const ingestRes = await axios.post(`${baseURL}/webhooks/${endpointId}`, { test: 'harden_historical' });
    eventId = ingestRes.data.eventId;
    await new Promise(r => setTimeout(r, 600));
    console.log(`[PASS] Ingested event ${eventId} successfully.`);

    // Test 4: Delete the endpoint, then verify webhook ingestion is rejected with 404
    await api1.delete(`/endpoints/${endpointId}`);
    try {
      await axios.post(`${baseURL}/webhooks/${endpointId}`, { test: 'after_deletion' });
      throw new Error('Deleted endpoint must not accept new webhook ingestion');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Deleted endpoint correctly rejected new webhook ingestion with 404 Not Found.');
      } else {
        throw err;
      }
    }

    // Test 5: Endpoint whose associated project was deleted/missing must not accept webhook ingestion
    const ghostProjectId = new mongoose.Types.ObjectId();
    const ghostEndpoint = await WebhookEndpoint.create({
      projectId: ghostProjectId,
      destinationUrl: 'https://httpbin.org/post'
    });
    orphanedEndpointId = ghostEndpoint.endpointId;

    try {
      await axios.post(`${baseURL}/webhooks/${orphanedEndpointId}`, { test: 'ghost_project' });
      throw new Error('Endpoint referencing missing/deleted project must not accept webhook ingestion');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`[PASS] Endpoint with missing/deleted project correctly rejected webhook ingestion with 404: "${err.response.data?.error?.message}"`);
      } else {
        throw new Error(`Expected 404 Not Found, got: ${err.response?.status} ${JSON.stringify(err.response?.data)}`);
      }
    }

    // Test 6: Historical event and delivery attempts remain inspectable even after endpoint was deleted
    const eventDetailRes = await api1.get(`/events/${eventId}`);
    if (eventDetailRes.data.eventId !== eventId) {
      throw new Error('Failed to retrieve historical event details after endpoint deletion');
    }
    if (!Array.isArray(eventDetailRes.data.attempts)) {
      throw new Error('Attempts must be an array on historical event');
    }
    console.log(`[PASS] Historical event and attempts safely inspectable through GET /api/events/:eventId.`);

    // Test 7: Missing resource references return clean responses (no 500 errors)
    // Non-existent event
    try {
      await api1.get('/events/nonexistent_event_id_xyz');
      throw new Error('Non-existent event should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Non-existent event ID cleanly returned 404 Not Found.');
      } else {
        throw err;
      }
    }

    // Replay on non-existent event
    try {
      await api1.post('/events/nonexistent_event_id_xyz/replay');
      throw new Error('Replay on non-existent event should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Replay on non-existent event ID cleanly returned 404 Not Found.');
      } else {
        throw err;
      }
    }

    // Replay on event whose endpoint was deleted
    await WebhookEvent.updateOne({ eventId }, { status: 'failed' });
    try {
      await api1.post(`/events/${eventId}/replay`);
      throw new Error('Replay on event with deleted endpoint should return 400');
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data?.error?.message?.includes('deleted')) {
        console.log(`[PASS] Replay on event with deleted endpoint cleanly returned 400 Bad Request: "${err.response.data?.error?.message}"`);
      } else {
        throw new Error(`Expected 400 Bad Request with deleted message, got: ${err.response?.status} ${JSON.stringify(err.response?.data)}`);
      }
    }

    // Non-existent endpoint update
    try {
      await api1.patch('/endpoints/nonexistent_ep_xyz', { destinationUrl: 'https://example.com' });
      throw new Error('Updating non-existent endpoint should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Updating non-existent endpoint cleanly returned 404 Not Found.');
      } else {
        throw err;
      }
    }

    // Non-existent endpoint deletion
    try {
      await api1.delete('/endpoints/nonexistent_ep_xyz');
      throw new Error('Deleting non-existent endpoint should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Deleting non-existent endpoint cleanly returned 404 Not Found.');
      } else {
        throw err;
      }
    }

    // Test 8: Multi-tenant isolation across all resources
    email2 = `harden_test2_${Date.now()}@test.com`;
    await axios.post(`${baseURL}/auth/register`, { name: 'Harden User 2', email: email2, password });
    const login2 = await axios.post(`${baseURL}/auth/login`, { email: email2, password });
    const api2 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login2.data.token}` } });

    // Unauthorized user accessing project events
    try {
      await api2.get(`/events/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project events');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: events listing returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // Unauthorized user accessing event details
    try {
      await api2.get(`/events/${eventId}`);
      throw new Error('Unauthorized user should NOT access event details');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: event details returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // Unauthorized user accessing project analytics
    try {
      await api2.get(`/analytics/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project analytics');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: project analytics returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // Unauthorized user accessing project endpoints
    try {
      await api2.get(`/endpoints/project/${projectId}`);
      throw new Error('Unauthorized user should NOT access project endpoints');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation: project endpoints returned 403 Forbidden.');
      } else {
        throw err;
      }
    }

    console.log('\n🌟 All Resource-Reference Hardening & Deletion tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message, err.response?.data || '');
    process.exit(1);
  } finally {
    try {
      if (projectId) await Project.deleteOne({ _id: projectId });
      if (workspaceId) await Workspace.deleteOne({ _id: workspaceId });
      if (email1) await User.deleteOne({ email: email1 });
      if (email2) await User.deleteOne({ email: email2 });
      if (endpointId) await WebhookEndpoint.deleteOne({ endpointId });
      if (orphanedEndpointId) await WebhookEndpoint.deleteOne({ endpointId: orphanedEndpointId });
      if (eventId) {
        const e = await WebhookEvent.findOne({ eventId });
        if (e) await DeliveryAttempt.deleteMany({ webhookEventId: e._id });
        await WebhookEvent.deleteOne({ eventId });
      }
      await mongoose.disconnect();
    } catch (e) {}
  }
}

runTest();
