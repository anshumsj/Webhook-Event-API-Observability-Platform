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

const sendRequest = (i) => {
  return new Promise((resolve) => {
    const req = http.request(optionsBase, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(0));
    req.write(JSON.stringify({ event: 'test', reqNum: i }));
    req.end();
  });
};

const runSequential = async () => {
  let successCount = 0;
  let tooManyCount = 0;
  for (let i = 0; i < 305; i++) {
    const status = await sendRequest(i);
    if (status === 202 || status === 404) successCount++;
    else if (status === 429) tooManyCount++;
  }
  console.log(`Sequential - Success: ${successCount}, 429: ${tooManyCount}`);
};

runSequential();
