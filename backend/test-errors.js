require('dotenv').config();
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:3001/api';

const axios = require('axios');

async function runTests() {
  console.log('--- Running Global Error Contract Tests ---\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const userId = new mongoose.Types.ObjectId();
  const token = jwt.sign({ user: { id: userId } }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const workspace = await Workspace.create({ name: 'Error WS', owner: userId });
  const project = await Project.create({ name: 'Error Proj', workspaceId: workspace._id, createdBy: userId });
  const endpoint = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://a', secret: 'abc' });
  const event = await WebhookEvent.create({ projectId: project._id, endpointId: endpoint._id, requestId: 'req1', status: 'processing', eventType: 'test', payload: {} });

  try {
    // 1. Missing Token Error
    console.log('[Test] Missing Token (authMiddleware)');
    let noAuthRes, noAuthData;
    try {
      await axios.get(`${API_BASE}/projects`);
    } catch (e) {
      noAuthRes = e.response;
      noAuthData = e.response.data;
    }
    if (noAuthRes && noAuthRes.status === 401 && noAuthData.error && noAuthData.error.code === 'UNAUTHORIZED') {
      console.log('✅ PASS: Missing token returns standard error');
    } else {
      throw new Error(`FAIL: Missing token response format invalid. Got: ${JSON.stringify(noAuthData)}`);
    }

    // 2. Invalid API Key Error
    console.log('[Test] Invalid API Key (authMiddleware)');
    let badKeyRes, badKeyData;
    try {
      await axios.get(`${API_BASE}/projects`, { headers: { Authorization: 'Bearer hk_test_invalid_123456789' } });
    } catch (e) {
      badKeyRes = e.response;
      badKeyData = e.response.data;
    }
    if (badKeyRes && badKeyRes.status === 401 && badKeyData.error && badKeyData.error.code === 'UNAUTHORIZED') {
      console.log('✅ PASS: Invalid API key returns standard error');
    } else {
      throw new Error(`FAIL: Invalid API key response format invalid. Got: ${JSON.stringify(badKeyData)}`);
    }

    // 3. Replay Non-Terminal Error
    console.log('[Test] Replay Non-Terminal (webhookController)');
    let replayRes, replayData;
    try {
      await axios.post(`${API_BASE}/events/${event.eventId}/replay`, {}, { headers });
    } catch (e) {
      replayRes = e.response;
      replayData = e.response.data;
    }
    if (replayRes && replayRes.status === 400 && replayData.error && replayData.error.code === 'BAD_REQUEST' && replayData.error.message.includes('non-terminal')) {
      console.log('✅ PASS: Replay non-terminal returns standard error');
    } else {
      throw new Error(`FAIL: Replay non-terminal response format invalid. Got: ${JSON.stringify(replayData)}`);
    }

    // 4. Missing Register Fields Error
    console.log('[Test] Missing Register Fields (authController)');
    let regRes, regData;
    try {
      await axios.post(`${API_BASE}/auth/register`, { name: 'Only Name' }, { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      regRes = e.response;
      regData = e.response.data;
    }
    if (regRes && regRes.status === 400 && regData.error && regData.error.code === 'BAD_REQUEST') {
      console.log('✅ PASS: Missing register fields returns standard error');
    } else {
      throw new Error(`FAIL: Missing register fields response format invalid. Got: ${JSON.stringify(regData)}`);
    }

    console.log('\n🎉 All Error Contract Tests Passed!');
  } finally {
    // Cleanup
    await WebhookEvent.deleteMany({ projectId: project._id });
    await WebhookEndpoint.deleteMany({ projectId: project._id });
    await Project.findByIdAndDelete(project._id);
    await Workspace.findByIdAndDelete(workspace._id);
    process.exit();
  }
}

runTests().catch(err => {
  console.error('\n❌ Error Tests Failed:', err.message);
  process.exit(1);
});
