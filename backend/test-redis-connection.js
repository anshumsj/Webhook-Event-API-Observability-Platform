const Redis = require('ioredis');

// Ensure we don't hang forever
const TIMEOUT_MS = 15000;
const timeoutId = setTimeout(() => {
  console.error(`\n[FAIL] Connection timed out after ${TIMEOUT_MS}ms.`);
  process.exit(1);
}, TIMEOUT_MS);

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('[FAIL] REDIS_URL environment variable is required.');
  process.exit(1);
}

// Redact credentials for logging
const safeUrl = redisUrl.replace(/:\/\/[^@]+@/, '://***:***@');

console.log(`Starting diagnostic connection to: ${safeUrl}`);
console.log('Using new Redis(process.env.REDIS_URL) with NO secondary options object.\n');

// 2. Create exactly one ioredis client using new Redis() with NO second options object.
const client = new Redis(redisUrl);

// Helper to safely serialize error objects
const logError = (prefix, err) => {
  if (!err) {
    console.error(`${prefix} Unknown error.`);
    return;
  }
  const code = err.code ? ` (Code: ${err.code})` : '';
  const name = err.name ? `[${err.name}] ` : '';
  // Ensure we don't accidentally log the raw URL if it's embedded in the error message
  const msg = err.message ? err.message.replace(/:\/\/[^@]+@/, '://***:***@') : String(err);
  console.error(`${prefix} ${name}${msg}${code}`);
};

// 3. Register listeners
client.on('connect', () => {
  console.log('[Redis Event] connect - Socket connection established (handshake starting)');
});

client.on('ready', async () => {
  console.log('[Redis Event] ready - Client is ready to receive commands');
  
  try {
    // 5. On ready, execute PING and print the response.
    console.log('\nExecuting PING...');
    const result = await client.ping();
    console.log(`PING response: ${result}`);
    
    // 6. On successful PING, print [PASS] Redis PING successful and exit 0.
    if (result === 'PONG') {
      console.log('\n[PASS] Redis PING successful');
      clearTimeout(timeoutId);
      process.exit(0);
    } else {
      console.error('\n[FAIL] Unexpected PING response');
      process.exit(1);
    }
  } catch (err) {
    logError('[FAIL] PING execution failed:', err);
    process.exit(1);
  }
});

client.on('error', (err) => {
  // 7. On failure, print the error name, message, and code if available
  logError('[Redis Event] error -', err);
});

client.on('close', () => {
  console.log('[Redis Event] close - Socket connection closed');
});

client.on('end', () => {
  console.log('[Redis Event] end - Connection has been cleanly closed (no more reconnects)');
});

client.on('reconnecting', (time) => {
  console.log(`[Redis Event] reconnecting - Attempting to reconnect in ${time}ms`);
});
