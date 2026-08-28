require('dotenv').config();
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:3001/api';

async function runTests() {
  console.log('--- Running Commit 54 Security Tests ---\n');
  process.env.MONGODB_URI = 'mongodb://localhost:27018/hooksightTest';
  process.env.REDIS_URL = 'redis://localhost:6380';

  // 1. Test JWT Fail-Closed
  console.log('[Test] JWT configuration fail-closed behavior');
  const child = spawnSync('node', ['server.js'], {
    env: { ...process.env, JWT_SECRET: '' }
  });
  if (child.status === 1 && child.stderr.toString().includes('FATAL ERROR: JWT_SECRET')) {
    console.log('✅ PASS: Server refuses to start without JWT_SECRET');
  } else {
    throw new Error(`FAIL: Server did not exit properly. Status: ${child.status}`);
  }

  // Set up data for API tests
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = new mongoose.Types.ObjectId();
  const token = jwt.sign({ user: { id: userId } }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const workspace = await Workspace.create({ name: 'Sec WS', owner: userId, members: [userId] });
  const project = await Project.create({ name: 'Sec Proj', workspaceId: workspace._id, createdBy: userId });
  const endpoint = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://a', secret: 'super_secret_value' });

  try {
    // 2. Secret Exposure Test
    console.log('\n[Test] Endpoint secret exposure redaction');
    const epRes = await fetch(`${API_BASE}/endpoints/project/${project._id}`, { headers });
    const endpoints = await epRes.json();
    if (epRes.status === 200 && endpoints[0] && !endpoints[0].secret) {
      console.log('✅ PASS: Endpoint secret is successfully redacted from list API');
    } else {
      throw new Error(`FAIL: Secret was exposed or request failed. Status: ${epRes.status}, Data: ${JSON.stringify(endpoints[0])}`);
    }

    // 3. ObjectId Validation Test
    console.log('\n[Test] ObjectId Validation');
    const badIdRes = await fetch(`${API_BASE}/endpoints/project/not-an-object-id`, { headers });
    if (badIdRes.status === 400) {
      console.log('✅ PASS: Malformed ObjectId returns 400 Bad Request');
    } else {
      throw new Error(`FAIL: Expected 400, got ${badIdRes.status}`);
    }

    // 3b. Bypass via query params check
    console.log('\n[Test] ObjectId Validation bypass via query parameter');
    const bypassRes = await fetch(`${API_BASE}/endpoints/project/${project._id}?projectId=not-an-object-id`, { headers });
    if (bypassRes.status === 200) {
      console.log('✅ PASS: Route authorization and validation remains intact despite malicious query parameter');
    } else {
      throw new Error(`FAIL: Expected 200, got ${bypassRes.status}`);
    }

    // 4. Rate Limiting Test - Authentication (Login)
    console.log('\n[Test] Authentication (Login) Rate Limiter');
    let loginStatus;
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fake@example.com', password: 'password123' })
      });
      loginStatus = res.status;
    }
    if (loginStatus === 429) {
      console.log('✅ PASS: Login endpoint rate limits properly (429)');
    } else {
      throw new Error(`FAIL: Expected 429 on login abuse, got ${loginStatus}`);
    }

    // 5. Rate Limiting Test - Replay
    console.log('\n[Test] Manual Replay Rate Limiter');
    let replayStatus;
    // Limit is 50, but we don't want to spam 50 reqs if we can avoid it. We'll just trust the config or hit it 51 times.
    // Given node `fetch`, hitting it 52 times is fast enough locally.
    for (let i = 0; i < 52; i++) {
      const res = await fetch(`${API_BASE}/events/someEventId123/replay`, { method: 'POST', headers });
      replayStatus = res.status;
    }
    if (replayStatus === 429) {
      console.log('✅ PASS: Manual Replay endpoint rate limits properly (429)');
    } else {
      throw new Error(`FAIL: Expected 429 on replay abuse, got ${replayStatus}`);
    }

    console.log('\n🎉 All Commit 54 Security Tests Passed!');
  } finally {
    // Cleanup
    await WebhookEndpoint.deleteMany({ projectId: project._id });
    await Project.findByIdAndDelete(project._id);
    await Workspace.findByIdAndDelete(workspace._id);
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('\n❌ Security Tests Failed:', err.message);
  process.exit(1);
});
