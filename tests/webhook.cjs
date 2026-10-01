const assert = require('node:assert/strict');
const http = require('node:http');
const { sendWebhook } = require('../dist-electron/webhook');
(async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', chunk => body += chunk);
    req.on('end', () => { requests.push({ method: req.method, body }); res.statusCode = req.url === '/fail' ? 500 : 204; res.end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await sendWebhook({ url, method: 'GET' })).ok, true);
    assert.equal((await sendWebhook({ url, method: 'POST', body: '{"spin":1}' })).ok, true);
    assert.deepEqual(requests, [{ method: 'GET', body: '' }, { method: 'POST', body: '{"spin":1}' }]);
    assert.equal((await sendWebhook({ url: url + '/fail', method: 'GET' })).ok, false);
    assert.equal(requests.length, 3, 'Failed actions are not retried');
    for (const invalid of [{url:'file:///C:/test',method:'GET'}, {url,method:'DELETE'}, {url:'invalid',method:'GET'}, null]) assert.equal((await sendWebhook(invalid)).ok, false);
    assert.equal(requests.length, 3, 'Invalid requests never reach the server');
    console.log('Webhook delivery passed: GET, POST payload, HTTP errors, no retries, and input validation.');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
