const http = require('http');

const optionsBase = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/webhooks/6a898613d5c8b8010293b6ba',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const runTest = (name, payload, expectedStatus) => {
  return new Promise((resolve) => {
    console.log(`\n--- Test: ${name} ---`);
    const req = http.request(optionsBase, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode} (Expected: ${expectedStatus})`);
        console.log(`Headers:`, res.headers['content-type']);
        console.log(`Body:`, data);
        resolve();
      });
    });

    req.on('error', e => {
      console.error(`Problem with request: ${e.message}`);
      resolve();
    });

    req.write(payload);
    req.end();
  });
};

const runAll = async () => {
  // 1. Normal payload
  await runTest('Normal Webhook', JSON.stringify({ event: "test", data: "ok" }), 202);

  // 2. Malformed JSON
  await runTest('Malformed JSON', '{ "event": "test", data: ok }', 400);

  // 3. >500kb JSON
  const oversizedObj = { event: "large_test", data: "A".repeat(600 * 1024) };
  await runTest('>500kb JSON', JSON.stringify(oversizedObj), 413);
};

runAll();
