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

async function runFlowTest() {
  console.log('\n======================================================');
  console.log('  Running End-to-End System Flow Test');
  console.log('======================================================\n');

  const baseURL = 'http://localhost:3001/api';
  let email1, email2, workspaceId, projectId1;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);

    // 1. Setup User 1
    email1 = `flow_test1_${Date.now()}@test.com`;
    const password = 'password123';
    console.log('-> Registering User 1...');
    await axios.post(`${baseURL}/auth/register`, { name: 'Flow User 1', email: email1, password });

    console.log('-> Logging in User 1...');
    const loginRes1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const token1 = loginRes1.data.token;
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${token1}` } });

    // 2. Create Workspace and Project
    console.log('-> Creating Workspace for User 1...');
    const wsRes = await api1.post('/workspaces', { name: 'Flow Workspace 1' });
    workspaceId = wsRes.data._id;

    console.log('-> Creating Project 1...');
    const p1Res = await api1.post('/projects', { name: 'Flow Project 1', workspaceId });
    projectId1 = p1Res.data._id;

    // Clean auto-created endpoint so we create an explicit test endpoint
    await WebhookEndpoint.deleteMany({ projectId: projectId1 });
    const endpointRes = await api1.post(`/endpoints/project/${projectId1}`, {
      destinationUrl: 'https://httpbin.org/post'
    });
    const endpointId = endpointRes.data.endpointId;
    console.log(`-> Created Endpoint: ${endpointId}`);

    // 3. Test Ingestion with Different Provider Formats
    console.log('-> Ingesting GitHub Webhook...');
    await axios.post(`${baseURL}/webhooks/${endpointId}`, { action: 'push' }, {
      headers: { 'x-github-event': 'push' }
    });

    console.log('-> Ingesting Stripe Webhook...');
    await axios.post(`${baseURL}/webhooks/${endpointId}`, { type: 'charge.succeeded' }, {
      headers: { 'stripe-signature': 'sig_123' }
    });

    console.log('-> Ingesting Generic Webhook...');
    await axios.post(`${baseURL}/webhooks/${endpointId}`, { custom: 'data' });

    // 4. Test Event Retrieval and Pagination
    console.log('-> Fetching Paginated Events...');
    const eventsRes = await api1.get(`/events/project/${projectId1}?page=1&limit=2`);
    if (eventsRes.data.events.length !== 2) {
      throw new Error(`Expected page limit 2, got ${eventsRes.data.events.length}`);
    }
    if (eventsRes.data.pagination.total !== 3) {
      throw new Error(`Expected total 3 events, got ${eventsRes.data.pagination.total}`);
    }
    console.log(`[PASS] Fetched 2 of ${eventsRes.data.pagination.total} events with pagination.`);

    // 5. Multi-Tenant Isolation
    console.log('-> Registering User 2 (Unauthorized)...');
    email2 = `flow_test2_${Date.now()}@test.com`;
    await axios.post(`${baseURL}/auth/register`, { name: 'Flow User 2', email: email2, password });
    const loginRes2 = await axios.post(`${baseURL}/auth/login`, { email: email2, password });
    const api2 = axios.create({ baseURL, headers: { Authorization: `Bearer ${loginRes2.data.token}` } });

    try {
      await api2.get(`/events/project/${projectId1}`);
      throw new Error('User 2 should NOT access User 1 project events');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('[PASS] Multi-tenant isolation enforced: User 2 correctly received 403 Forbidden.');
      } else {
        throw err;
      }
    }

    console.log('\n🌟 End-to-End System Flow Test passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Flow test failed:', err.message);
    process.exit(1);
  } finally {
    try {
      if (projectId1) {
        await WebhookEvent.deleteMany({ projectId: projectId1 });
        await WebhookEndpoint.deleteMany({ projectId: projectId1 });
        await Project.deleteOne({ _id: projectId1 });
      }
      if (workspaceId) await Workspace.deleteOne({ _id: workspaceId });
      if (email1) await User.deleteOne({ email: email1 });
      if (email2) await User.deleteOne({ email: email2 });
      await mongoose.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  runFlowTest();
}

module.exports = runFlowTest;
