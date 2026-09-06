const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { getRedis, connectRedis, disconnectRedis } = require('./config/redis');

const suites = [
  { name: '1. Ingestion Reliability', file: 'tests/ingestion.test.js' },
  { name: '2. Lifecycle, Deletion & Hardening', file: 'tests/lifecycle-and-deletion.test.js' },
  { name: '3. Analytics, Delivery Trends & Health', file: 'tests/analytics-and-trends.test.js' },
  { name: '4. Events Filtering & Sorting', file: 'tests/events-filtering.test.js' },
  { name: '5. Security, SSRF & Redaction', file: 'tests/security.test.js' },
  { name: '6. End-to-End System Flow', file: 'tests/flow.test.js' }
];

async function flushRedisCache() {
  try {
    const redis = connectRedis();
    if (redis.status !== 'ready') {
      await new Promise((resolve) => {
        redis.once('ready', resolve);
        redis.once('error', resolve);
        setTimeout(resolve, 1500);
      });
    }
    if (redis.status === 'ready') {
      await redis.flushall();
    }
  } catch (e) {}
}

function runSuite(suite) {
  return new Promise((resolve, reject) => {
    console.log(`\n================================================================`);
    console.log(`  STARTING SUITE: ${suite.name}`);
    console.log(`================================================================`);

    const child = spawn('node', [suite.file], {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Suite "${suite.name}" failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║       HookSight Consolidated Backend Regression Suite        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  let passedCount = 0;

  for (const suite of suites) {
    await flushRedisCache();
    try {
      await runSuite(suite);
      passedCount++;
    } catch (err) {
      console.error(`\n❌ TEST SUITE FAILURE in ${suite.name}:`, err.message);
      await disconnectRedis();
      process.exit(1);
    }
  }

  await disconnectRedis();
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  ALL ${passedCount} CONSOLIDATED TEST SUITES PASSED! (${totalDuration}s)       ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  process.exit(0);
}

main();
