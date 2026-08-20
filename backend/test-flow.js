const axios = require('axios');

async function runTest() {
  const baseURL = 'http://localhost:3001/api';
  
  try {
    const email = `test_${Date.now()}@test.com`;
    const password = 'password123';
    
    console.log('-> POST /api/auth/register (Registering user)');
    await axios.post(`${baseURL}/auth/register`, { name: 'Test User', email, password });
    
    console.log('-> POST /api/auth/login (Logging in)');
    const loginRes = await axios.post(`${baseURL}/auth/login`, { email, password });
    const token = loginRes.data.token;
    console.log('   JWT Received:', token.substring(0, 20) + '...');
    
    const api = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('-> GET /api/auth/me (Fetching profile)');
    const meRes = await api.get('/auth/me');
    console.log('   User ID:', meRes.data._id);
    
    console.log('-> POST /api/workspaces (Creating Workspace)');
    const wsRes = await api.post('/workspaces', { name: 'Test Workspace' });
    const workspaceId = wsRes.data._id;
    
    console.log('-> GET /api/workspaces (Fetching user workspaces)');
    const getWsRes = await api.get('/workspaces');
    const activeWorkspace = getWsRes.data[0];
    console.log('   Active Workspace:', activeWorkspace.name);
    
    console.log(`-> POST /api/projects (Creating Project in ${activeWorkspace._id})`);
    await api.post('/projects', { name: 'Test Project', workspaceId: activeWorkspace._id });
    
    console.log(`-> GET /api/projects/${activeWorkspace._id} (Fetching projects for workspace)`);
    const getProjRes = await api.get(`/projects/${activeWorkspace._id}`);
    console.log('   Projects fetched:', getProjRes.data.length);
    console.log('   First Project Name:', getProjRes.data[0].name);
    
    console.log('\n✅ End-to-end API test completed successfully!');
  } catch (err) {
    console.error('\n❌ Test failed:');
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

runTest();
