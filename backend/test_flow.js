const axios = require('axios');
const mongoose = require('mongoose');

async function runTest() {
  try {
    console.log('--- Starting Flow Test ---');
    const api = axios.create({ baseURL: 'http://localhost:3001/api' });

    // 1. Register a test user
    const testEmail = `test_${Date.now()}@test.com`;
    console.log(`1. Registering user ${testEmail}...`);
    const regRes = await api.post('/auth/register', {
      name: 'Test User',
      email: testEmail,
      password: 'password123'
    });
    const token = regRes.data.token;
    console.log('✓ Registered. Token obtained.');

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // 2. Create Workspace
    console.log('2. Creating Workspace...');
    const wsRes = await api.post('/workspaces', {
      name: 'My Test Workspace'
    });
    const workspaceId = wsRes.data._id;
    console.log(`✓ Workspace created. ID: ${workspaceId}`);

    // 3. Get Workspaces
    console.log('3. Fetching Workspaces...');
    const getWsRes = await api.get('/workspaces');
    console.log(`✓ Fetched ${getWsRes.data.length} workspaces.`);

    // 4. Create Project
    console.log('4. Creating Project...');
    const projRes = await api.post('/projects', {
      name: 'Test Project',
      workspaceId: workspaceId
    });
    const projectId = projRes.data._id;
    console.log(`✓ Project created. ID: ${projectId}`);

    // 5. Get Projects
    console.log('5. Fetching Projects...');
    const getProjRes = await api.get(`/projects/${workspaceId}`);
    console.log(`✓ Fetched ${getProjRes.data.length} projects.`);

    console.log('--- Flow Test Successful ---');
  } catch (error) {
    console.error('❌ Flow Test Failed!');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runTest();
