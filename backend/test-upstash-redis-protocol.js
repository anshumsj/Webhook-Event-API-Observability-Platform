const tls = require('tls');
const { URL } = require('url');

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('[FAIL] REDIS_URL environment variable is required.');
  process.exit(1);
}

const parsed = new URL(redisUrl);
const HOST = parsed.hostname;
const PORT = parsed.port || 6379;
const TIMEOUT_MS = 10000;

console.log(`Starting raw TLS Redis connection to ${HOST}:${PORT}...`);
console.log(`Using SNI servername: ${HOST}\n`);

const options = {
  host: HOST,
  port: PORT,
  servername: HOST,
  rejectUnauthorized: true,
  timeout: TIMEOUT_MS
};

const username = decodeURIComponent(parsed.username || '');
const password = decodeURIComponent(parsed.password || '');

if (!password) {
  console.error('[FAIL] No password found in REDIS_URL.');
  process.exit(1);
}

let stage = 'CONNECTING'; // CONNECTING, AUTH, PING
let hasSucceeded = false;

// RESP protocol helper to safely format commands
const toRESP = (args) => {
  let str = `*${args.length}\r\n`;
  for (const arg of args) {
    const buf = Buffer.from(String(arg), 'utf8');
    str += `$${buf.length}\r\n${arg}\r\n`;
  }
  return str;
};

const socket = tls.connect(options, () => {
  // Handshake successful
});

socket.on('secureConnect', () => {
  console.log('[TLS Event] secureConnect - Handshake completed successfully!');
  
  // Send AUTH
  stage = 'AUTH';
  
  let authArgs = [];
  if (username) {
    authArgs = ['AUTH', username, password];
  } else {
    authArgs = ['AUTH', password];
  }
  
  console.log(`Sending AUTH command (username: ${username ? 'provided' : 'none'})...`);
  socket.write(toRESP(authArgs));
});

socket.on('data', (data) => {
  const response = data.toString('utf8').trim();
  
  if (stage === 'AUTH') {
    console.log(`AUTH response: ${response}`);
    if (response === '+OK') {
      stage = 'PING';
      console.log('\nSending PING command...');
      socket.write(toRESP(['PING']));
    } else {
      console.error('\n[FAIL] AUTH failed!');
      socket.destroy();
      process.exit(1);
    }
  } else if (stage === 'PING') {
    console.log(`PING response: ${response}`);
    if (response === '+PONG') {
      console.log('\n[PASS] AUTH and PING succeeded!');
      hasSucceeded = true;
      socket.end(); // Cleanly close
    } else {
      console.error('\n[FAIL] Unexpected PING response');
      socket.destroy();
      process.exit(1);
    }
  }
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
    console.error('\n[FAIL] Socket closed unexpectedly before protocol flow finished.');
    process.exit(1);
  } else if (hasSucceeded) {
    console.log('[TLS Event] close - Socket cleanly closed.');
    process.exit(0);
  } else if (hadError) {
    process.exit(1);
  }
});

socket.on('end', () => {
  console.log('[TLS Event] end - Connection EOF received.');
});
