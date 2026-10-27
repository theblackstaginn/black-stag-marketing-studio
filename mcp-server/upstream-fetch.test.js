import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDeadlineFetch } from './upstream-fetch.js';

async function fixture(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('preserves a successful JSON response and caller headers', async t => {
  const url = await fixture(t, (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-only');
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  const response = await createDeadlineFetch() (url, { headers: { authorization: 'Bearer test-only' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('aborts when upstream never sends response headers', async t => {
  const url = await fixture(t, () => {});
  await assert.rejects(createDeadlineFetch({ timeoutMs: 100 })(url), /timeout|aborted/i);
});

test('keeps the deadline active while the response body stalls', async t => {
  const url = await fixture(t, (_req, res) => { res.writeHead(200); res.write('{'); });
  const response = await createDeadlineFetch({ timeoutMs: 150 })(url);
  await assert.rejects(response.text(), /timeout|aborted/i);
});

test('preserves cancellation from both Request and init signals', async t => {
  const url = await fixture(t, () => {});
  for (const source of ['request', 'init']) {
    const controller = new AbortController();
    controller.abort(new Error('caller cancelled'));
    const input = source === 'request' ? new Request(url, { signal: controller.signal }) : url;
    const init = source === 'init' ? { signal: controller.signal } : {};
    await assert.rejects(createDeadlineFetch()(input, init), /caller cancelled/);
  }
});

test('does not retry a write or swallow an HTTP failure', async t => {
  let writes = 0;
  const url = await fixture(t, (_req, res) => { writes++; res.writeHead(503); res.end('unavailable'); });
  const response = await createDeadlineFetch()(url, { method: 'POST', body: 'test' });
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'unavailable');
  assert.equal(writes, 1);
});

test('rejects invalid deadline configuration', () => {
  for (const timeoutMs of [0, -1, NaN, Infinity, 120001]) {
    assert.throws(() => createDeadlineFetch({ timeoutMs }), RangeError);
  }
});
