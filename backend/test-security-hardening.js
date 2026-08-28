require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const ApiKey = require('./models/ApiKey');
const { connectRedis, getRedis, closeRedis } = require('./config/redis');

let app;
let server;
let testUser1, testUser2, testWorkspace1, testWorkspace2, testProject1, testProject2;
let jwt1, jwt2;

async function setup() {
  console.log('--- Setting up Security Hardening Tests ---');
  process.env.MONGODB_URI = 'mongodb://localhost:27018/hooksightTest';
  process.env.REDIS_URL = 'redis://localhost:6380';
  await mongoose.connect(process.env.MONGODB_URI);
  await connectRedis();
  
  // We need to bypass the server.js starting its own listener if we just require it.
  // Actually, supertest can take the express app. But server.js starts listening.
  // We can just hit http://localhost:3001 if the dev server is running, or we can use supertest.
  // Let's use axios against http://localhost:3001 to avoid app lifecycle issues.
  try {
    const redis = getRedis();
    if (redis) {
      const keys = await redis.keys('rl:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    }
  } catch (e) {
    console.error('Redis cleanup error:', e.message);
  }
}

async function cleanup() {
  console.log('--- Cleaning up Test Data ---');
  if (testUser1) await User.deleteOne({ _id: testUser1._id });
  if (testUser2) await User.deleteOne({ _id: testUser2._id });
  if (testWorkspace1) await Workspace.deleteOne({ _id: testWorkspace1._id });
  if (testWorkspace2) await Workspace.deleteOne({ _id: testWorkspace2._id });
  if (testProject1) await Project.deleteOne({ _id: testProject1._id });
  if (testProject2) await Project.deleteOne({ _id: testProject2._id });
  await ApiKey.deleteMany({ name: { $regex: /^test_sec_/ } });
  
  await mongoose.disconnect();
  // Don't close redis here if it wasn't opened in this script properly, or just ignore errors
  try {
    const redis = getRedis();
    if (redis) {
      const keys = await redis.keys('rl:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
      await closeRedis();
    }
  } catch (e) {}
}

async function runTests() {
  const axios = require('axios');
  const baseURL = 'http://localhost:3001';
  
  const generateRandomStr = () => Math.random().toString(36).substring(7);

  try {
    // 1. Create Users
    const u1 = generateRandomStr();
    const u2 = generateRandomStr();
    
    let res = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'SecTest1', email: `sec1_${u1}@test.com`, password: 'password123'
    });
    testUser1 = res.data.user;
    jwt1 = res.data.token;

    res = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'SecTest2', email: `sec2_${u2}@test.com`, password: 'password123'
    });
    testUser2 = res.data.user;
    jwt2 = res.data.token;
    
    // 2. Create Workspaces
    res = await axios.post(`${baseURL}/api/workspaces`, { name: 'SecWorkspace1' }, { headers: { Authorization: `Bearer ${jwt1}` } });
    testWorkspace1 = res.data;
    
    res = await axios.post(`${baseURL}/api/workspaces`, { name: 'SecWorkspace2' }, { headers: { Authorization: `Bearer ${jwt2}` } });
    testWorkspace2 = res.data;
    
    // 3. Create Projects
    res = await axios.post(`${baseURL}/api/projects`, { name: 'SecProject1', workspaceId: testWorkspace1._id }, { headers: { Authorization: `Bearer ${jwt1}` } });
    testProject1 = res.data;
    
    res = await axios.post(`${baseURL}/api/projects`, { name: 'SecProject2', workspaceId: testWorkspace2._id }, { headers: { Authorization: `Bearer ${jwt2}` } });
    testProject2 = res.data;

    // --- TEST 1: NoSQL Injection Defense ---
    console.log('Running Test 1: NoSQL Injection Defense');
    try {
      await axios.post(`${baseURL}/api/auth/login`, {
        email: { "$ne": null },
        password: 'password123'
      });
      throw new Error('NoSQL injection payload was accepted!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✅ NoSQL injection correctly blocked (400 Bad Request).');
      } else {
        throw new Error(`Expected 400 Bad Request, got ${err.response?.status}`);
      }
    }

    // --- TEST 2: Helmet Headers ---
    console.log('Running Test 2: Helmet Headers');
    res = await axios.get(`${baseURL}/api/health`);
    if (res.headers['x-dns-prefetch-control'] === 'off' && res.headers['x-frame-options'] === 'SAMEORIGIN') {
      console.log('✅ Helmet headers are present.');
    } else {
      throw new Error('Helmet headers are missing!');
    }

    // --- TEST 3: Workspace-Scoped API Keys (Cross-Workspace Blocking) ---
    console.log('Running Test 3: Workspace-Scoped API Keys');
    // Generate key for Workspace 1 using User 1
    res = await axios.post(`${baseURL}/api/auth/api-keys`, {
      name: 'test_sec_key1',
      workspaceId: testWorkspace1._id
    }, { headers: { Authorization: `Bearer ${jwt1}` } });
    const rawApiKey1 = res.data.rawKey;

    // Use API Key 1 to access Workspace 1 Project
    res = await axios.get(`${baseURL}/api/projects/${testWorkspace1._id}`, { headers: { Authorization: `Bearer ${rawApiKey1}` } });
    if (res.status === 200) console.log('✅ API Key successfully accessed its own workspace.');

    // Use API Key 1 to access Workspace 2 (Cross-workspace)
    try {
      await axios.get(`${baseURL}/api/projects/${testWorkspace2._id}`, { headers: { Authorization: `Bearer ${rawApiKey1}` } });
      throw new Error('API Key successfully accessed a foreign workspace!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ API Key correctly blocked from accessing a foreign workspace (403 Forbidden).');
      } else {
        throw new Error(`Expected 403, got ${err.response?.status}`);
      }
    }

    // --- TEST 4: API Key Revocation ---
    console.log('Running Test 4: API Key Revocation');
    // Get keys
    res = await axios.get(`${baseURL}/api/auth/api-keys`, { headers: { Authorization: `Bearer ${jwt1}` } });
    const keyId = res.data[0]._id;
    
    // Revoke
    res = await axios.delete(`${baseURL}/api/auth/api-keys/${keyId}`, { headers: { Authorization: `Bearer ${jwt1}` } });
    if (res.data.success === true) {
      console.log('✅ API key revocation success contract correct.');
    } else {
      throw new Error('API key revocation response format is wrong.');
    }

    // Try to use revoked key
    try {
      await axios.get(`${baseURL}/api/projects/${testWorkspace1._id}`, { headers: { Authorization: `Bearer ${rawApiKey1}` } });
      throw new Error('Revoked API Key was accepted!');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log('✅ Revoked API Key correctly rejected (401 Unauthorized).');
      } else {
        throw new Error(`Expected 401, got ${err.response?.status}`);
      }
    }
    
    console.log('\n🎉 ALL SECURITY HARDENING TESTS PASSED!');
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    process.exitCode = 1;
  }
}

async function main() {
  await setup();
  try {
    await runTests();
  } finally {
    await cleanup();
  }
}

main();
