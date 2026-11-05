const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

(async () => {
  let mode = 'ready';
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/api/pdfs');
    if (mode === 'error') { res.writeHead(503).end('Unavailable'); return; }
    if (mode === 'redirect') { res.writeHead(302, { Location: '/elsewhere' }).end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(mode === 'invalid' ? '{}' : JSON.stringify([{ id: 7, title: 'HTTP catalogue book', has_pdf: true }]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const api = 'http://127.0.0.1:' + server.address().port;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.env.PHP_BINARY || 'php', [path.resolve(__dirname, '../PDF-Library/php/export-catalogue.php'), '--api', api]);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', code => resolve({ code, stdout, stderr }));
  });
  try {
    const success = await run();
    assert.equal(success.code, 0, success.stderr);
    assert.match(success.stdout, /HTTP catalogue book/);
    for (mode of ['error', 'redirect', 'invalid']) {
      const result = await run();
      assert.equal(result.code, 1, mode + ' must fail');
      assert.equal(result.stdout, '', 'Failures must not produce partial CSV data');
    }
    console.log('PASS: PHP HTTP catalogue export, upstream failure, redirect rejection and invalid API payload.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
