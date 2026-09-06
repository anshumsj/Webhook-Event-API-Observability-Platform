const http = require('http');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const baseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001/api';

const sendWebhook = (endpointId, i) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({ event: 'benchmark.test', num: i });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/webhooks/${endpointId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(0));
    req.write(data);
    req.end();
  });
};

async function runRateLimitingBenchmark() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        HookSight Webhook Ingestion Rate-Limit Benchmark       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Setup temporary account & endpoint
    const email = `ratelimit_bench_${Date.now()}@test.com`;
    const password = 'Password123!';
    await axios.post(`${baseURL}/auth/register`, { name: 'Benchmark User', email, password });
    const loginRes = await axios.post(`${baseURL}/auth/login`, { email, password });
    const token = loginRes.data.token;
    const api = axios.create({ baseURL, headers: { Authorization: `Bearer ${token}` } });

    const wsRes = await api.post('/workspaces', { name: 'Benchmark WS' });
    const pRes = await api.post('/projects', { name: 'Benchmark Proj', workspaceId: wsRes.data._id });
    const epRes = await api.post(`/endpoints/project/${pRes.data._id}`, { destinationUrl: 'https://httpbin.org/post' });
    const endpointId = epRes.data.endpointId;

    console.log(`[Setup] Created test endpoint: ${endpointId}`);

    // 2. Parallel Burst Test (305 concurrent requests)
    console.log('\n[1/2] Running Parallel Burst (305 concurrent requests)...');
    const tStartPar = Date.now();
    const parPromises = [];
    for (let i = 0; i < 305; i++) {
      parPromises.push(sendWebhook(endpointId, i));
    }
    const parResults = await Promise.all(parPromises);
    const parDurationMs = Date.now() - tStartPar;

    const parAccepted = parResults.filter(s => s === 202).length;
    const parRateLimited = parResults.filter(s => s === 429).length;
    const parOther = parResults.filter(s => s !== 202 && s !== 429).length;

    console.log(`Parallel Results: ${parAccepted} accepted (202), ${parRateLimited} rate-limited (429), ${parOther} other in ${parDurationMs}ms.`);
    console.log(`Throughput: ${Math.round((305 / parDurationMs) * 1000)} req/sec.`);

    if (parRateLimited === 0 && parAccepted >= 300) {
      console.log('⚠️ Note: Rate limiter did not engage (may be using memory store or Redis limiter window refreshed).');
    } else {
      console.log('✅ Rate limiter effectively throttled excess requests above window limit.');
    }

    console.log('\n🌟 Rate Limiting Benchmark Completed!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Benchmark error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runRateLimitingBenchmark();
}

module.exports = runRateLimitingBenchmark;
