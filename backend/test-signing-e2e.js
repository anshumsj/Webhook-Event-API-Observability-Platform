const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const WebhookEndpoint = require('./models/WebhookEndpoint');
const DeliveryAttempt = require('./models/DeliveryAttempt');
const WebhookEvent = require('./models/WebhookEvent');

async function run() {
  let endpointSecret;
  let endpointId;
  let eventId;
  let hasFailed = false;

  // Use a separate test env var to avoid picking up the Atlas production URL from .env
  const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';

  try {
    await mongoose.connect(mongoUri);
    const api = axios.create({ baseURL: apiBaseUrl });

    // 1. Register a user
    const email = `test_${Date.now()}@test.com`;
    const password = 'password123';
    await api.post('/auth/register', { name: 'E2E Tester', email, password });

    // 2. Login
    const loginRes = await api.post('/auth/login', { email, password });
    const token = loginRes.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // 3. Create Workspace and Project
    const wsRes = await api.post('/workspaces', { name: 'E2E Workspace' });
    const workspaceId = wsRes.data._id;
    const projRes = await api.post('/projects', { name: 'E2E Project', workspaceId });
    const projectId = projRes.data._id;

    // 4. Create Endpoint with httpbin as the destination (since mock-server is blocked by production SSRF)
    const destinationUrl = 'https://httpbin.org/post';
    const createRes = await api.post(`/endpoints/project/${projectId}`, { destinationUrl });
    endpointId = createRes.data.endpointId;
    endpointSecret = createRes.data.secret;

    if (!endpointId || !endpointSecret) {
      throw new Error('Failed to retrieve endpointId or secret from API response.');
    }

    console.log('\n--- Endpoint Created ---');
    console.log(`Destination URL: ${destinationUrl}`);
    console.log(`Endpoint ID: ${endpointId}`);
    console.log(`Secret Captured: ${endpointSecret}`);

    // 5. Send webhook
    const payload = { event: 'payment.success', amount: 4999, test: true };
    const webhookRes = await api.post(`/webhooks/${endpointId}`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    eventId = webhookRes.data.eventId;

    if (!eventId) throw new Error('Failed to retrieve eventId from ingestion API.');

    console.log('\n--- Webhook Sent ---');
    console.log(`Event ID: ${eventId}`);

    // 6. Polling for delivery attempt (max 30 seconds)
    console.log('\nWaiting for worker to process and deliver...');
    let attempt = null;
    let eventDoc = null;
    const maxPolls = 30;

    for (let i = 0; i < maxPolls; i++) {
      eventDoc = await WebhookEvent.findOne({ eventId });
      if (eventDoc) {
        attempt = await DeliveryAttempt.findOne({ webhookEventId: eventDoc._id });
        if (attempt && attempt.status !== 'pending') {
          break; // It has finished
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!attempt || attempt.status === 'pending') {
      throw new Error('Timeout: No completed delivery attempt found within 30 seconds.');
    }

    console.log('\n--- Delivery Attempt Recorded ---');
    console.log(`Attempt ID: ${attempt._id}`);
    console.log(`Status Code: ${attempt.responseStatusCode}`);
    console.log(`Final Event Status: ${eventDoc.status}`);

    if (attempt.responseStatusCode !== 200) {
      console.log(`[FAIL] Outbound delivery did not return 200 OK.`);
      hasFailed = true;
    }

    // 8. Capture signature from headers sent to destination
    const sentHeaders = attempt.requestHeaders;
    if (!sentHeaders) throw new Error('No requestHeaders found on DeliveryAttempt.');

    const headersObj = sentHeaders instanceof Map ? Object.fromEntries(sentHeaders) : sentHeaders;
    const sigKey = Object.keys(headersObj).find(k => k.toLowerCase() === 'x-hooksight-signature');
    const capturedSignature = headersObj[sigKey];

    if (!capturedSignature) {
      throw new Error('X-HookSight-Signature header was missing from the outbound request headers.');
    }

    console.log('\n--- Signature Verification ---');
    console.log(`Captured Signature from Header: ${capturedSignature}`);

    // 9. Independently calculate
    const payloadString = JSON.stringify(payload);
    const expectedHash = crypto.createHmac('sha256', endpointSecret).update(payloadString).digest('hex');
    const expectedSignature = `sha256=${expectedHash}`;

    console.log(`Expected Signature:             ${expectedSignature}`);

    if (capturedSignature === expectedSignature) {
      console.log('\n[PASS] Signatures match perfectly!');
    } else {
      console.log('\n[FAIL] Signatures do not match.');
      hasFailed = true;
    }

  } catch (error) {
    console.error('\n[FAIL] Error during E2E test:', error.response?.data || error.message);
    hasFailed = true;
  } finally {
    await mongoose.disconnect();
    if (hasFailed) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

run();
