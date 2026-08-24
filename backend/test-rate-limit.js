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

const runAll = async () => {
  let successCount = 0;
  let tooManyCount = 0;
  let otherCount = 0;

  const promises = [];
  // Send 305 requests rapidly
  for (let i = 0; i < 305; i++) {
    const p = new Promise((resolve) => {
      const req = http.request(optionsBase, (res) => {
        // Must consume data
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode === 202 || res.statusCode === 404) successCount++; // 404 means it passed rate limiter and hit controller
          else if (res.statusCode === 429) tooManyCount++;
          else otherCount++;
          resolve();
        });
      });
      req.on('error', () => {
        otherCount++;
        resolve();
      });
      req.write(JSON.stringify({ event: 'test', reqNum: i }));
      req.end();
    });
    promises.push(p);
  }

  await Promise.all(promises);
  console.log(`Success/Passed limit: ${successCount}`);
  console.log(`Rate Limited (429): ${tooManyCount}`);
  console.log(`Other: ${otherCount}`);
};

runAll();
