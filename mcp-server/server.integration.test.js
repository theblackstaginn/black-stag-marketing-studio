import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Real Express, MCP and Supabase clients; all upstream data stays on localhost.
test('SDK transport survives a timed-out read and preserves authorization', { timeout: 40000 }, async t => {
  const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
  const studio = pkg.name === 'black-stag-marketing-studio-mcp';
  const calls = [];
  let stage = 'starting';
  t.after(() => { if (stage !== 'complete') t.diagnostic('Fixture ended at: ' + stage); });
  let stall = false;
  const upstream = http.createServer((req, res) => {
    calls.push({ path: req.url, method: req.method, headers: req.headers });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/auth/v1/user') {
      res.end(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated' }));
    } else if (req.url.startsWith(studio ? '/rest/v1/brands?' : '/rest/v1/rpc/guild_get_request')) {
      if (stall) return;
      res.end(JSON.stringify(studio ? [{ id: 'test-brand', active: true }] : { request_id: '11111111-1111-4111-8111-111111111111', status: 'pending' }));
    } else {
      res.writeHead(404); res.end('{"message":"unexpected fixture path"}');
    }
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { upstream.close(resolve); upstream.closeAllConnections(); }));
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('.', import.meta.url),
    env: { PATH: process.env.PATH, NODE_ENV: 'test', PORT: String(port), SUPABASE_URL: `http://127.0.0.1:${upstream.address().port}`, SUPABASE_ANON_KEY: 'fixture-anon-key' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { child.kill(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local MCP server did not start')), 5000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Local MCP server exited: ${code}`)); });
    child.stdout.on('data', chunk => { if (String(chunk).includes('listening on port')) { clearTimeout(timer); resolve(); } });
  });
  const root = `http://127.0.0.1:${port}`;
  stage = 'health';
  assert.equal((await fetch(root + '/health')).status, 200);
  if (studio) {
    const before = calls.length;
    const denied = await fetch(root + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' });
    assert.equal(denied.status, 401);
    assert.equal(calls.length, before, 'anonymous request must not contact Supabase');
  }
  const client = new Client({ name: 'local-reliability-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(root + '/mcp'), { requestInit: studio ? { headers: { Authorization: 'Bearer fixture-user-token' } } : {} });
  t.after(() => client.close());
  stage = 'connect';
  await client.connect(transport, { timeout: 5000 });
  stage = 'list tools';
  const listed = await client.listTools();
  const name = studio ? 'list_brands' : 'get_guild_request';
  assert.ok(listed.tools.some(tool => tool.name === name));
  if (!studio) assert.ok(listed.tools.some(tool => tool.name === 'send_guild_raven'));
  const args = studio ? {} : { request_id: '11111111-1111-4111-8111-111111111111', return_capability: '0'.repeat(64) };
  stage = 'healthy read';
  const healthy = await client.callTool({ name, arguments: args });
  assert.ok(!healthy.isError);
  assert.deepEqual(JSON.parse(healthy.content[0].text), studio ? [{ id: 'test-brand', active: true }] : { request_id: args.request_id, status: 'pending' });
  const dbCalls = () => calls.filter(call => call.path.startsWith('/rest/v1/'));
  assert.equal(dbCalls().at(-1).headers.apikey, 'fixture-anon-key');
  assert.equal(dbCalls().at(-1).headers.authorization, studio ? 'Bearer fixture-user-token' : 'Bearer fixture-anon-key');
  stall = true;
  const before = dbCalls().length;
  const start = performance.now();
  stage = 'stalled read';
  const timedOut = await client.callTool({ name, arguments: args }, undefined, { timeout: 25000 });
  assert.equal(timedOut.isError, true);
  assert.ok(performance.now() - start < 22000, 'timeout must return within the bounded upstream deadline');
  assert.equal(dbCalls().length, before + 1, 'timed-out upstream call must not be retried');
  stall = false;
  stage = 'recovered read';
  const recovered = await client.callTool({ name, arguments: args });
  assert.ok(!recovered.isError, 'the next independent read must still work');
  stage = 'complete';
});
