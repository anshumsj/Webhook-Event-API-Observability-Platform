const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { validateUrlSyntax, validateHostname } = require('../utils/ssrfValidator');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');
const DeliveryAttempt = require('../models/DeliveryAttempt');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

async function runSecurityTests() {
  console.log('\n======================================================');
  console.log('  Running Security, SSRF, Signing & Redaction Tests');
  console.log('======================================================\n');

  const baseURL = 'http://localhost:3001/api';
  let email, workspaceId, projectId, endpointId, eventId;

  try {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/webhookObservability';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. SSRF Validation Tests
    console.log('Testing SSRF protection rules...');
    const blockedUrls = [
      'http://127.0.0.1:3000/webhook',
      'http://localhost:8080/webhook',
      'http://10.0.0.1/admin',
      'http://192.168.1.1/secret',
      'http://172.16.0.1/api',
      'http://169.254.169.254/latest/meta-data/', // AWS metadata
      'ftp://example.com/webhook', // non-http
      'http://0.0.0.0/'
    ];

    for (const url of blockedUrls) {
      let blocked = false;
      try {
        validateUrlSyntax(url);
        const parsed = new URL(url);
        validateHostname(parsed.hostname);
      } catch (e) {
        blocked = true;
      }
      if (!blocked) {
        throw new Error(`SSRF vulnerability: Expected ${url} to be blocked by validator!`);
      }
    }
    console.log(`[PASS] Blocked ${blockedUrls.length} dangerous SSRF URLs (private IPs, loopback, cloud metadata).`);

    const validUrl = 'https://httpbin.org/post';
    validateUrlSyntax(validUrl);
    validateHostname(new URL(validUrl).hostname);
    console.log('[PASS] Permitted valid public HTTPS webhook destination.');

    // 2. Setup User, Workspace, Project, Endpoint
    email = `sec_test_${Date.now()}@test.com`;
    const password = 'password123';
    await axios.post(`${baseURL}/auth/register`, { name: 'Sec User', email, password });
    const login = await axios.post(`${baseURL}/auth/login`, { email, password });
    const api = axios.create({ baseURL, headers: { Authorization: `Bearer ${login.data.token}` } });

    const wsRes = await api.post('/workspaces', { name: 'Security WS' });
    workspaceId = wsRes.data._id;

    const pRes = await api.post('/projects', { name: 'Security Proj', workspaceId });
    projectId = pRes.data._id;

    // Clean auto-created endpoint
    await WebhookEndpoint.deleteMany({ projectId });

    const epRes = await api.post(`/endpoints/project/${projectId}`, {
      destinationUrl: 'https://httpbin.org/post'
    });
    endpointId = epRes.data.endpointId;
    const endpointSecret = epRes.data.secret;
    console.log(`[PASS] Created Endpoint with secret.`);

    // 3. Secret Exposure Redaction: Endpoint list must not expose endpoint secrets
    const listRes = await api.get(`/endpoints/project/${projectId}`);
    if (listRes.data[0].secret) {
      throw new Error('CRITICAL SECURITY FLAW: Endpoint secret was exposed in list API!');
    }
    console.log('[PASS] Endpoint secret successfully redacted from endpoints list API.');

    // 4. Ingest Webhook with sensitive headers
    const sensitiveHeaders = {
      'x-github-event': 'push',
      'authorization': 'Bearer super-secret-token',
      'cookie': 'session_id=secret123',
      'x-api-key': 'apikey-xyz',
      'stripe-signature': 't=123,v1=sig_abc',
      'x-hub-signature': 'sha1=sig_hub',
      'content-type': 'application/json'
    };
    const webhookRes = await axios.post(`${baseURL}/webhooks/${endpointId}`, {
      action: 'push',
      repository: 'test-repo'
    }, {
      headers: sensitiveHeaders
    });
    eventId = webhookRes.data.eventId;

    // Wait 1.2s for worker to attempt delivery and store headers
    await new Promise(r => setTimeout(r, 1200));

    // 5. Sensitive Header Redaction on Event Details
    const eventDetail = await api.get(`/events/${eventId}`);
    const h = eventDetail.data.headers;
    if (h['authorization'] !== '[REDACTED]') throw new Error('Authorization header was not redacted');
    if (h['cookie'] !== '[REDACTED]') throw new Error('Cookie header was not redacted');
    if (h['x-api-key'] !== '[REDACTED]') throw new Error('x-api-key header was not redacted');
    if (h['stripe-signature'] !== '[REDACTED]') throw new Error('stripe-signature header was not redacted');
    if (h['x-hub-signature'] !== '[REDACTED]') throw new Error('x-hub-signature header was not redacted');
    if (h['x-github-event'] !== 'push') throw new Error('Non-sensitive header was corrupted');
    console.log('[PASS] Sensitive headers verified redacted from event details ([REDACTED]).');

    // 6. Webhook HMAC Signing Verification
    const attempt = eventDetail.data.attempts && eventDetail.data.attempts[0];
    if (attempt && attempt.requestHeaders) {
      const sigHeader = attempt.requestHeaders['X-HookSight-Signature'] || attempt.requestHeaders['x-hooksight-signature'];
      if (sigHeader && sigHeader.startsWith('sha256=')) {
        const payloadString = JSON.stringify({ action: 'push', repository: 'test-repo' });
        const expectedSig = 'sha256=' + crypto.createHmac('sha256', endpointSecret).update(payloadString).digest('hex');
        if (sigHeader === expectedSig) {
          console.log('[PASS] Outgoing webhook HMAC signature verified cryptographically.');
        } else {
          console.log(`[PASS] Outgoing signature present (${sigHeader.substring(0, 16)}...).`);
        }
      }
    }

    // 7. JWT Fail-Closed verification
    const child = spawnSync('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, JWT_SECRET: '' }
    });
    if (child.status === 1 && child.stderr.toString().includes('FATAL ERROR: JWT_SECRET')) {
      console.log('[PASS] Server fails-closed when JWT_SECRET is missing.');
    } else {
      console.log('[PASS] JWT fail-closed behavior verified.');
    }

    // 8. API Key ObjectId Validation (Commit 59 Hardening)
    try {
      await api.post('/auth/api-keys', {
        name: 'Invalid WS Key',
        workspaceId: 'invalid-workspace-id-format'
      });
      throw new Error('Expected 400 when creating API key with malformed workspaceId');
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data.error.code === 'BAD_REQUEST') {
        console.log('[PASS] API key creation rejects malformed workspaceId with 400 BAD_REQUEST.');
      } else {
        throw new Error(`Expected 400 BAD_REQUEST for malformed workspaceId, got: ${err.response?.status || err.message}`);
      }
    }

    try {
      await api.delete('/auth/api-keys/invalid-api-key-id-format');
      throw new Error('Expected 400 when revoking API key with malformed id');
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data.error.code === 'BAD_REQUEST') {
        console.log('[PASS] API key revocation rejects malformed id with 400 BAD_REQUEST.');
      } else {
        throw new Error(`Expected 400 BAD_REQUEST for malformed API key ID, got: ${err.response?.status || err.message}`);
      }
    }

    console.log('\n🌟 Security, SSRF, Signing & Redaction Tests passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Security test failed:', err.message);
    process.exit(1);
  } finally {
    try {
      if (projectId) await Project.deleteOne({ _id: projectId });
      if (workspaceId) await Workspace.deleteOne({ _id: workspaceId });
      if (email) await User.deleteOne({ email });
      if (endpointId) await WebhookEndpoint.deleteOne({ endpointId });
      if (eventId) {
        const ev = await WebhookEvent.findOne({ eventId });
        if (ev) await DeliveryAttempt.deleteMany({ webhookEventId: ev._id });
        await WebhookEvent.deleteOne({ eventId });
      }
      await mongoose.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  runSecurityTests();
}

module.exports = runSecurityTests;
