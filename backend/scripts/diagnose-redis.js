const Redis = require('ioredis');
const path = require('path');
const { URL } = require('url');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TIMEOUT_MS = 10000;

async function diagnoseRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const safeUrl = redisUrl.replace(/:\/\/[^@]+@/, '://***:***@');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║               HookSight Redis Diagnostic Tool                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Connecting to: ${safeUrl}`);

  const timeoutId = setTimeout(() => {
    console.error(`\n❌ [FAIL] Connection timed out after ${TIMEOUT_MS}ms.`);
    process.exit(1);
  }, TIMEOUT_MS);

  let client;
  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      enableReadyCheck: true,
      lazyConnect: false
    });

    client.on('connect', () => {
      console.log('[Redis Event] connect - TCP / TLS connection established.');
    });

    client.on('ready', async () => {
      console.log('[Redis Event] ready - Client is ready to receive commands.');
      try {
        const pingRes = await client.ping();
        console.log(`[PASS] PING response: ${pingRes}`);

        const info = await client.info('server');
        const versionLine = info.split('\n').find(l => l.startsWith('redis_version:'));
        if (versionLine) {
          console.log(`[PASS] Server info: ${versionLine.trim()}`);
        }

        clearTimeout(timeoutId);
        await client.quit();
        console.log('\n🌟 Redis connectivity diagnostics PASSED!\n');
        process.exit(0);
      } catch (cmdErr) {
        console.error('\n❌ [FAIL] Redis command failed:', cmdErr.message);
        clearTimeout(timeoutId);
        await client.quit();
        process.exit(1);
      }
    });

    client.on('error', (err) => {
      console.error('[Redis Event] error:', err.message);
    });

  } catch (initErr) {
    clearTimeout(timeoutId);
    console.error('\n❌ [FAIL] Failed to initialize Redis client:', initErr.message);
    process.exit(1);
  }
}

if (require.main === module) {
  diagnoseRedis();
}

module.exports = diagnoseRedis;
