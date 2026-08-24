const express = require('express');
const rateLimit = require('express-rate-limit');
const http = require('http');

const app = express();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Add pre/post logs
app.use('/api/webhooks/:endpointId', (req, res, next) => {
  // console.log(`[Isol] Pre - IP: ${req.ip}`);
  next();
}, limiter, (req, res, next) => {
  // console.log(`[Isol] Post - IP: ${req.ip}`);
  res.status(202).json({ success: true, message: 'Isolated OK' });
});

app.listen(4001, async () => {
  console.log('Isolated server running on 4001');
  
  // Now run the 301 requests against it
  let successCount = 0;
  let failCount = 0;
  let otherCount = 0;
  
  const promises = [];
  for (let i = 0; i < 301; i++) {
    promises.push(new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 4001,
        path: '/api/webhooks/2327509279fac595bcacb6e3',
        method: 'POST',
      }, (res) => {
        if (res.statusCode === 202) successCount++;
        else if (res.statusCode === 429) failCount++;
        else otherCount++;
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', resolve);
      req.end();
    }));
  }
  
  await Promise.all(promises);
  console.log(`Isolated test (4001): Success: ${successCount}, Failed (429): ${failCount}, Other: ${otherCount}`);
  
  console.log(`\nNow running against ACTUAL server on 3001...`);
  
  let mainSuccess = 0;
  let mainFail = 0;
  let mainOther = 0;
  
  const mainPromises = [];
  for (let i = 0; i < 301; i++) {
    mainPromises.push(new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/webhooks/2327509279fac595bcacb6e3',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        if (res.statusCode === 202 || res.statusCode === 404) mainSuccess++;
        else if (res.statusCode === 429) mainFail++;
        else {
          console.log(`Other status: ${res.statusCode}`);
          mainOther++;
        }
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', (e) => {
        console.error('Error on 3001:', e.message);
        resolve();
      });
      req.write(JSON.stringify({ test: true }));
      req.end();
    }));
  }
  
  await Promise.all(mainPromises);
  console.log(`Actual server (3001) test: Success/Passed Limiter (202/404): ${mainSuccess}, Failed (429): ${mainFail}, Other: ${mainOther}`);
  
  process.exit(0);
});
