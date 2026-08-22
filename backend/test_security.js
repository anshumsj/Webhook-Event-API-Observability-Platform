const axios = require('axios');

async function test() {
  const api = axios.create({ baseURL: 'http://localhost:3001/api' });
  
  // 1. Register + login
  const email = 'security_test_' + Date.now() + '@test.com';
  const reg = await api.post('/auth/register', { name: 'Test', email, password: 'pass123' });
  const token = reg.data.token;
  api.defaults.headers.common['Authorization'] = 'Bearer ' + token;

  // 2. Create workspace + project
  const ws = await api.post('/workspaces', { name: 'Security WS' });
  const proj = await api.post('/projects', { name: 'Security Project', workspaceId: ws.data._id });

  // 3. Get endpoint
  const eps = await api.get('/endpoints/project/' + proj.data._id);
  const endpointId = eps.data[0].endpointId;

  // 4. Send webhook with sensitive headers
  await axios.post('http://localhost:3001/api/webhooks/' + endpointId, 
    { message: 'test payload', commits: 3 },
    { headers: {
        'x-github-event': 'push',
        'x-api-key': 'super-secret-key',
        'authorization': 'Bearer my-token',
        'stripe-signature': 'v1=abc123',
        'cookie': 'session=xyz',
        'x-hub-signature': 'sha1=abc',
        'content-type': 'application/json'
    }}
  );

  // 5. Fetch events
  await new Promise(r => setTimeout(r, 500));
  const evts = await api.get('/events/project/' + proj.data._id);
  const eventId = evts.data.events[0].eventId;

  // 6. Fetch event details and validate
  const detail = await api.get('/events/' + eventId);
  const h = detail.data.headers;
  
  console.log('--- Test 1 & 2: Header Redaction ---');
  console.log('x-github-event:', h['x-github-event'], h['x-github-event'] === 'push' ? 'PASS' : 'FAIL');
  console.log('content-type visible:', h['content-type'] ? 'PASS' : 'FAIL');
  console.log('x-api-key redacted:', h['x-api-key'] === '[REDACTED]' ? 'PASS' : 'FAIL (got: ' + h['x-api-key'] + ')');
  console.log('authorization redacted:', h['authorization'] === '[REDACTED]' ? 'PASS' : 'FAIL');
  console.log('stripe-signature redacted:', h['stripe-signature'] === '[REDACTED]' ? 'PASS' : 'FAIL');
  console.log('cookie redacted:', h['cookie'] === '[REDACTED]' ? 'PASS' : 'FAIL');
  console.log('x-hub-signature redacted:', h['x-hub-signature'] === '[REDACTED]' ? 'PASS' : 'FAIL');
  
  console.log('\n--- Test 5: Mongoose Internals ---');
  const internalKeys = Object.keys(h).filter(k => k.startsWith('$__'));
  console.log('No Mongoose internals:', internalKeys.length === 0 ? 'PASS' : 'FAIL (found: ' + internalKeys.join(', ') + ')');
  
  console.log('\n--- Test 6: DTO Fields ---');
  const d = detail.data;
  console.log('eventId present:', !!d.eventId ? 'PASS' : 'FAIL');
  console.log('requestId present:', !!d.requestId ? 'PASS' : 'FAIL');
  console.log('projectName present:', !!d.projectName ? 'PASS' : 'FAIL');
  console.log('payload.message correct:', d.payload && d.payload.message === 'test payload' ? 'PASS' : 'FAIL');
  console.log('No __v field:', d.__v === undefined ? 'PASS' : 'FAIL (got: ' + d.__v + ')');
  console.log('No _id field:', d._id === undefined ? 'PASS' : 'FAIL');
  console.log('status present:', !!d.status ? 'PASS' : 'FAIL');
  console.log('eventType present:', !!d.eventType ? 'PASS' : 'FAIL');
  
  // Ensure no sensitive value leaks
  const responseStr = JSON.stringify(detail.data);
  console.log('\n--- Test: No raw secrets in response ---');
  console.log('super-secret-key not in response:', !responseStr.includes('super-secret-key') ? 'PASS' : 'FAIL - SECRET LEAKED');
  console.log('Bearer my-token not in response:', !responseStr.includes('my-token') ? 'PASS' : 'FAIL - TOKEN LEAKED');
}

test().catch(e => {
  console.error('Test error:', e.response ? JSON.stringify(e.response.data) : e.message);
});
