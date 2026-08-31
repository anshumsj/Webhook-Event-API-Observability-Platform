const tls = require('tls');

const HOST = 'live-toucan-162717.upstash.io';
const PORT = 6379;
const TIMEOUT_MS = 10000;

console.log(`Starting raw TLS diagnostic connection to ${HOST}:${PORT}...`);
console.log(`Using SNI servername: ${HOST}\n`);

const options = {
  host: HOST,
  port: PORT,
  servername: HOST, // Required for Upstash SNI routing
  timeout: TIMEOUT_MS
};

let hasSucceeded = false;

const socket = tls.connect(options, () => {
  // Wait for secureConnect to fire to guarantee TLS handshake success
});

socket.on('secureConnect', () => {
  hasSucceeded = true;
  console.log('[TLS Event] secureConnect - Handshake completed successfully!');
  
  if (socket.authorized) {
    console.log('Authorization: Valid server certificate.');
  } else {
    console.warn(`Authorization: Server certificate invalid (${socket.authorizationError})`);
  }

  const cipher = socket.getCipher();
  console.log(`Protocol: ${socket.getProtocol()}`);
  console.log(`Cipher:   ${cipher.name} (v${cipher.version})`);
  
  console.log('\n[PASS] TLS connection established successfully.');
  
  // Cleanly close the socket now that we've verified TLS works
  socket.end();
});

socket.on('timeout', () => {
  console.error(`\n[FAIL] Connection timed out after ${TIMEOUT_MS}ms.`);
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.error(`\n[FAIL] TLS Connection Error:`);
  console.error(`Message: ${err.message}`);
  if (err.code) {
    console.error(`Code:    ${err.code}`);
  }
  process.exit(1);
});

socket.on('close', (hadError) => {
  if (!hasSucceeded && !hadError) {
    console.error('\n[FAIL] Socket closed before secure connection could be established (No error emitted).');
    process.exit(1);
  } else if (hasSucceeded) {
    console.log('[TLS Event] close - Socket cleanly closed.');
    process.exit(0);
  }
});
