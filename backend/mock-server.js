const http = require('http');

const PORT = 4000;
const TIMEOUT_MS = 15000; // 15 seconds

// Mode configuration to switch between response behaviors
// Available modes: 'success', 'fail', 'timeout', 'retry-test'
const MODE = process.argv[2] || 'success'; 

let requestCount = 0;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('──────────────────────────────────────────────────');
      console.log(`[${new Date().toISOString()}] Webhook Received`);
      console.log(`Mode: ${MODE}`);
      console.log('\nHeaders:');
      console.table(req.headers);
      console.log('\nRaw Body:');
      console.log(body);
      console.log('──────────────────────────────────────────────────');

      switch (MODE) {
        case 'success':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', message: 'Webhook received successfully' }));
          break;

        case 'fail':
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error', message: 'Simulated failure' }));
          break;

        case 'timeout':
          // Delay response for 15 seconds to test timeout handling
          console.log(`[Timeout Mode] Delaying response for ${TIMEOUT_MS}ms...`);
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'Delayed response' }));
          }, TIMEOUT_MS);
          break;

        case 'retry-test':
          requestCount++;
          if (requestCount <= 2) {
            console.log(`[Retry-Test] Request ${requestCount}: Returning 500`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error', message: 'Simulated failure for retry' }));
          } else {
            console.log(`[Retry-Test] Request ${requestCount}: Returning 200`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'Success after retries' }));
          }
          break;

        default:
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found. Send POST to /webhook');
  }
});

server.listen(PORT, () => {
  console.log(`
🚀 Mock Customer Server running!
URL:   http://localhost:${PORT}/webhook
Mode:  ${MODE}

How to change modes:
Restart the server with a mode argument:
- 200 OK:      node mock-server.js success
- 500 Error:   node mock-server.js fail
- Timeout:     node mock-server.js timeout
- Retry Test:  node mock-server.js retry-test
  `);
});
