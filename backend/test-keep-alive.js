const http = require('http');
const agent = new http.Agent({ keepAlive: true });
const run = async () => {
  let success = 0, fail = 0;
  const promises = [];
  for (let i = 0; i < 301; i++) {
    promises.push(new Promise(resolve => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/webhooks/2327509279fac595bcacb6e3',
        method: 'POST',
        agent: agent,
        headers: { 'Content-Type': 'application/json' }
      }, res => {
        if (res.statusCode === 202 || res.statusCode === 404) success++;
        else if (res.statusCode === 429) fail++;
        res.resume();
        res.on('end', resolve);
      });
      req.end('{}');
    }));
  }
  await Promise.all(promises);
  console.log(`Keep-alive Test - Success: ${success}, Fail: ${fail}`);
};
run();
