require('dotenv').config();
const http = require('http');

const makeRequest = (options) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

const runTests = async () => {
  console.log('--- STARTING COMMIT 58 OPERATIONAL OBSERVABILITY TESTS ---');
  let errors = 0;

  try {
    const port = process.env.PORT || 3001;

    // Test 1: /api/health returns 200 when healthy
    console.log('\n[Test 1] Fetching /api/health ...');
    const res1 = await makeRequest({ method: 'GET', host: '127.0.0.1', port, path: '/api/health' });
    
    if (res1.statusCode !== 200) {
      console.error(`❌ Expected 200, got ${res1.statusCode}`);
      errors++;
    } else {
      console.log('✅ PASS: /api/health returned 200 OK');
    }

    // Test 3 & 4: Queue counts and NO secrets exposed
    console.log('\n[Test 2] Verifying health payload contents...');
    const data = res1.data;
    
    if (data.status !== 'healthy') {
      console.error(`❌ Expected status="healthy", got ${data.status}`);
      errors++;
    }
    
    if (data.dependencies?.mongodb !== 'ready' || data.dependencies?.redis !== 'ready') {
      console.error(`❌ Expected MongoDB and Redis to be ready, got ${JSON.stringify(data.dependencies)}`);
      errors++;
    }
    
    if (!data.dependencies?.queue || typeof data.dependencies.queue.waiting !== 'number') {
      console.error(`❌ Missing queue counts in payload: ${JSON.stringify(data.dependencies)}`);
      errors++;
    } else {
      console.log('✅ PASS: Health payload includes queue counts (waiting, active, etc.)');
    }
    
    const payloadStr = JSON.stringify(data);
    if (payloadStr.includes('redis://') || payloadStr.includes('mongodb://') || payloadStr.includes('password')) {
      console.error('❌ Health payload leaks credentials/connection strings!');
      errors++;
    } else {
      console.log('✅ PASS: Health payload does not expose secrets');
    }

    if (errors > 0) {
      throw new Error(`Failed with ${errors} errors`);
    }

    console.log('\n🎉 All Commit 58 Operational Observability Tests Passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
};

runTests();
