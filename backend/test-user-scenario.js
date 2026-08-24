const http = require('http');

async function testUserScenario() {
  const url = 'http://127.0.0.1:3001/api/webhooks/2327509279fac595bcacb6e3';
  const requests = [];
  
  let successes = 0;
  let limited = 0;
  let other = 0;
  
  for (let i = 0; i < 301; i++) {
    requests.push(new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        if (res.statusCode === 202) successes++;
        else if (res.statusCode === 429) limited++;
        else other++;
        
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(JSON.stringify({ event: 'test' }));
      req.end();
    }));
  }
  
  await Promise.all(requests);
  console.log(`User Scenario Test: 202: ${successes}, 429: ${limited}, Other: ${other}`);
}

testUserScenario().catch(console.error);
