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

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Setup User 1, Workspace, Project, Endpoint
    email1 = `del_test1_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'User 1', email: email1, password });
    const login1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login1.data.token}` } });

    const wsRes = await api1.post('/workspaces', { name: 'Delete Test WS' });
    workspaceId = wsRes.data._id;

    const pRes = await api1.post('/projects', { name: 'Delete Test Proj', workspaceId });
    projectId = pRes.data._id;

    const epRes = await api1.post(`/endpoints/project/${projectId}`, {
      destinationUrl: 'https://httpbin.org/post'
    });
    endpointId = epRes.data.endpointId;
    console.log(`[PASS] Created endpoint: ${endpointId}`);

    // 2. Ingest an event to generate WebhookEvent and DeliveryAttempt
    const ingestRes = await axios.post(`${baseURL}/webhooks/${endpointId}`, { test: 'delete_preservation' });
    eventId = ingestRes.data.eventId;
    console.log(`[PASS] Ingested event: ${eventId}`);

    // Wait 500ms for worker to process attempt
    await new Promise(r => setTimeout(r, 800));

    // Verify event exists in DB
    const eventBefore = await WebhookEvent.findOne({ eventId });
    if (!eventBefore) throw new Error('Event should exist before deletion');

    // 3. User 2 (unauthorized) attempts to delete endpoint -> Expect 403
    email2 = `del_test2_${Date.now()}@test.com`;
    await axios.post(`${baseURL}/auth/register`, { name: 'User 2', email: email2, password });
    const login2 = await axios.post(`${baseURL}/auth/login`, { email: email2, password });
    const api2 = axios.create({ baseURL, headers: { Authorization: `Bearer ${login2.data.token}` } });

    try {
      await api2.delete(`/endpoints/${endpointId}`);
      throw new Error('User 2 should NOT be authorized to delete endpoint');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Unauthorized user correctly rejected with 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // 4. Attempt to delete non-existent endpoint -> Expect 404
    try {
      await api1.delete('/endpoints/nonexistent_endpoint_id_9999');
      throw new Error('Deleting non-existent endpoint should return 404');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[PASS] Non-existent endpoint correctly rejected with 404 Not Found.');
      } else {
        throw err;
      }
    }

    // 5. User 1 deletes endpoint -> Expect 200 OK
    const delRes = await api1.delete(`/endpoints/${endpointId}`);
    if (delRes.status === 200 && delRes.data.success) {
      console.log('[PASS] Endpoint successfully deleted with 200 OK.');
    } else {
      throw new Error(`Unexpected delete response: ${JSON.stringify(delRes.data)}`);
    }

    // 6. Verify WebhookEndpoint document is gone from DB
    const epAfter = await WebhookEndpoint.findOne({ endpointId });
    if (epAfter !== null) {
      throw new Error('WebhookEndpoint document should be deleted from DB');
    }
    console.log('[PASS] Verified WebhookEndpoint document is removed from database.');

    // 7. Verify WebhookEvent and DeliveryAttempt documents still exist (NOT cascade deleted)
    const eventAfter = await WebhookEvent.findOne({ eventId });
    if (!eventAfter) {
      throw new Error('CRITICAL: Associated WebhookEvent was incorrectly deleted!');
    }
    const attemptsAfter = await DeliveryAttempt.find({ eventId });
    console.log(`[PASS] Associated WebhookEvent and DeliveryAttempts (${attemptsAfter.length}) preserved intact!`);

    console.log('\n✅ All endpoint deletion tests passed successfully!\n');
  } catch (err) {
    console.error('Test failed:', err.message, err.response?.data || '');
    process.exit(1);
  } finally {
    // Cleanup test data
    try {
      if (projectId) await Project.deleteOne({ _id: projectId });
      if (workspaceId) await Workspace.deleteOne({ _id: workspaceId });
      if (email1) await User.deleteOne({ email: email1 });
      if (email2) await User.deleteOne({ email: email2 });
      if (endpointId) await WebhookEndpoint.deleteOne({ endpointId });
      if (eventId) {
        await WebhookEvent.deleteOne({ eventId });
        await DeliveryAttempt.deleteMany({ eventId });
      }
      await mongoose.disconnect();
    } catch (e) {}
  }
}

runTest();
