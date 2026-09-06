const axios = require('axios');
const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const WebhookEndpoint = require('../models/WebhookEndpoint');
const Project = require('../models/Project');
const WebhookEvent = require('../models/WebhookEvent');
const DeliveryAttempt = require('../models/DeliveryAttempt');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

async function runWorkerTruncationTest() {
  const baseURL = 'http://localhost:3001/api';
  let mockServer;
  let email1, workspaceId, projectId1;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);

    // ---- SETUP MOCK DESTINATION SERVER ----
    const app = express();
    app.post('/large-response', (req, res) => {
      // Send 2MB response to test bounding
      const largeChunk = 'A'.repeat(1024 * 1024 * 2); 
      res.status(400).send(largeChunk); // Non-2xx so it gets recorded in DeliveryAttempt
    });
    
    app.post('/timeout', (req, res) => {
      // Hang the request
      setTimeout(() => res.status(200).send('OK'), 11000); 
    });

    await new Promise((resolve) => {
      mockServer = app.listen(3002, resolve);
    });
    console.log('-> Mock Destination Server running on port 3002');

    // ---- SETUP USER 1 & WORKSPACE & PROJECT ----
    email1 = `test_rel_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'User Rel', email: email1, password });
    const loginRes1 = await axios.post(`${baseURL}/auth/login`, { email: email1, password });
    const token1 = loginRes1.data.token;
    const api1 = axios.create({ baseURL, headers: { Authorization: `Bearer ${token1}` } });
    
    const wsRes = await api1.post('/workspaces', { name: 'Workspace Rel' });
    workspaceId = wsRes.data._id;
    
    const p1Res = await api1.post('/projects', { name: 'Project Rel', workspaceId });
    projectId1 = p1Res.data._id;
    
    // ---- 1. TEST LARGE RESPONSE (OOM PROTECTION) ----
    console.log('\n-> Testing Large Response Bounding (1MB limit)...');
    const endpointLarge = new WebhookEndpoint({ 
      projectId: projectId1, 
      destinationUrl: 'http://localhost:3002/large-response' 
    });
    await endpointLarge.save();
    
    const largeIngestRes = await axios.post(`${baseURL}/webhooks/${endpointLarge.endpointId}`, { test: 'large' });
    const largeEventId = largeIngestRes.data.eventId;
    
    // Wait for worker to process
    await new Promise(r => setTimeout(r, 2500));
    
    const largeEvent = await WebhookEvent.findOne({ eventId: largeEventId });
    const largeAttempt = await DeliveryAttempt.findOne({ webhookEventId: largeEvent._id }).sort({ attemptNumber: -1 });
    
    if (largeAttempt && typeof largeAttempt.responseBody === 'string' && largeAttempt.responseBody.includes('[Response truncated: exceeded 1MB limit]')) {
      console.log('✅ SUCCESS: Large response was safely truncated!');
      if (largeEvent.status === 'retrying' || largeEvent.status === 'failed' || largeEvent.status === 'retry_exhausted') {
         console.log(`✅ SUCCESS: Event status transitioned safely to ${largeEvent.status}`);
      } else {
         console.log(`⚠️ Note: Event status is ${largeEvent.status}`);
      }
    } else {
      console.log('❌ FAIL: Large response was not truncated properly or delivery failed:');
      console.log('Status:', largeAttempt?.status);
      console.log('Error:', largeAttempt?.error);
      console.log('Body length:', largeAttempt?.responseBody?.length);
      process.exitCode = 1;
    }

    console.log('\n✅ Worker Truncation Test completed successfully!');
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
    try {
      if (projectId1) {
        const eventIds = await WebhookEvent.find({ projectId: projectId1 }).distinct('_id');
        await DeliveryAttempt.deleteMany({ webhookEventId: { $in: eventIds } });
        await WebhookEvent.deleteMany({ projectId: projectId1 });
        await WebhookEndpoint.deleteMany({ projectId: projectId1 });
        await Project.findByIdAndDelete(projectId1);
      }
      if (workspaceId) {
        await Workspace.findByIdAndDelete(workspaceId);
      }
      if (email1) {
        await User.deleteOne({ email: email1 });
      }
      if (mockServer) mockServer.close();
      await mongoose.disconnect();
    } catch (cleanupErr) {}
    process.exit();
  }
}

if (require.main === module) {
  runWorkerTruncationTest();
}

module.exports = runWorkerTruncationTest;
