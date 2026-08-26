const axios = require('axios');
const mongoose = require('mongoose');

// Need to load models to inject an endpoint since we don't have an API for it yet
require('dotenv').config();
const WebhookEndpoint = require('./models/WebhookEndpoint');
const Project = require('./models/Project');

async function runTest() {
  const baseURL = 'http://localhost:3001/api';
  
  let email1, email2, workspaceId, projectId1;
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // ---- SETUP USER 1 & WORKSPACE & PROJECT ----
    email1 = `test1_${Date.now()}@test.com`;
    const password = 'password123';
    
    console.log('-> Registering User 1...');
    await axios.post(`${baseURL}/auth/register`, { name: 'User 1', email: email1, password });
    
    console.log('-> Logging in User 1...');
    const loginRes1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const token1 = loginRes1.data.token;
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${token1}` } });
    
    console.log('-> Creating Workspace for User 1...');
    const wsRes = await api1.post('/workspaces', { name: 'Workspace 1' });
    workspaceId = wsRes.data._id;
    
    console.log('-> Creating Project 1...');
    const p1Res = await api1.post('/projects', { name: 'Project 1', workspaceId });
    projectId1 = p1Res.data._id;
    
    // ---- INJECT ENDPOINT DIRECTLY ----
    console.log('-> Mocking Endpoint in DB...');
    const endpoint = new WebhookEndpoint({ projectId: projectId1 });
    await endpoint.save();
    
    // ---- TEST INGESTION (Event Type Extraction) ----
    console.log('-> Ingesting GitHub Webhook...');
    await axios.post(`${baseURL}/webhooks/${endpoint.endpointId}`, { action: 'push' }, {
      headers: { 'x-github-event': 'push' }
    });
    
    console.log('-> Ingesting Stripe Webhook...');
    await axios.post(`${baseURL}/webhooks/${endpoint.endpointId}`, { type: 'charge.succeeded' }, {
      headers: { 'stripe-signature': 'sig_123' }
    });

    console.log('-> Ingesting Generic Webhook...');
    await axios.post(`${baseURL}/webhooks/${endpoint.endpointId}`, { data: 'hello' });

    // ---- TEST GET EVENTS API (Project Scoped & Pagination) ----
    console.log(`-> GET /api/events/project/${projectId1}?page=1&limit=2`);
    const getEvRes = await api1.get(`/events/project/${projectId1}?page=1&limit=2`);
    
    const { events, pagination } = getEvRes.data;
    console.log(`   Fetched ${events.length} events.`);
    console.log(`   Pagination: Page ${pagination.page} of ${pagination.totalPages} (Total: ${pagination.total})`);
    
    events.forEach(e => console.log(`   - ID: ${e.eventId} | Type: ${e.eventType} | Status: ${e.status}`));
    
    // ---- TEST AUTHORIZATION ----
    email2 = `test2_${Date.now()}@test.com`;
    console.log('\n-> Registering User 2...');
    await axios.post(`${baseURL}/auth/register`, { name: 'User 2', email: email2, password });
    const loginRes2 = await axios.post(`${baseURL}/auth/login`, { email: email2, password });
    const api2 = axios.create({ baseURL, headers: { Authorization: `Bearer ${loginRes2.data.token}` } });

    console.log('-> User 2 attempting to access Project 1 Events...');
    try {
      await api2.get(`/events/project/${projectId1}`);
      console.log('❌ FAIL: User 2 was able to access Project 1!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ SUCCESS: User 2 correctly received 403 Forbidden.');
      } else {
        console.log('❌ FAIL: User 2 received unexpected error:', err.response?.status);
      }
    }
    
    console.log('\n✅ End-to-end Event Test completed successfully!');
  } catch(e) {
    console.error('\n❌ Test failed:');
    if (e.response) {
      console.error(e.response.status, e.response.data);
    } else {
      console.error(e.message);
    }
    process.exitCode = 1;
  } finally {
    console.log('\n-> Cleaning up test data...');
    if (projectId1) {
      const WebhookEvent = require('./models/WebhookEvent');
      const DeliveryAttempt = require('./models/DeliveryAttempt');
      
      const eventIds = await WebhookEvent.find({ projectId: projectId1 }).distinct('_id');
      await DeliveryAttempt.deleteMany({ webhookEventId: { $in: eventIds } });
      await WebhookEvent.deleteMany({ projectId: projectId1 });
      await WebhookEndpoint.deleteMany({ projectId: projectId1 });
      await Project.findByIdAndDelete(projectId1);
    }
    if (workspaceId) {
      const Workspace = require('./models/Workspace');
      await Workspace.findByIdAndDelete(workspaceId);
    }
    if (email1 || email2) {
      const User = require('./models/User');
      if (email1) await User.deleteOne({ email: email1 });
      if (email2) await User.deleteOne({ email: email2 });
    }
    process.exit();
  }
}
runTest();
