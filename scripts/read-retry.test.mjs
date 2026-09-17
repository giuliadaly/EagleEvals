import assert from 'node:assert/strict';
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { NeonDbError } from '@neondatabase/serverless';
import { withReadRetry } from '../src/data/read-retry.ts';

function socketError(code = 'UND_ERR_SOCKET') {
  const error = new NeonDbError('private connection string and review text');
  error.sourceError = new TypeError('private fetch details', { cause: Object.assign(new Error('private socket'), { code }) });
  return error;
}

function capture(t) {
  const logs = [];
  for (const level of ['warn', 'error']) t.mock.method(console, level, line => logs.push({ level, ...JSON.parse(line) }));
  return logs;
}

test('healthy reads are attempted once and stay silent', async t => {
  const logs = capture(t);
  let calls = 0;
  assert.equal(await withReadRetry('stats', 1, async () => { calls++; return 42; }), 42);
  assert.equal(calls, 1);
  assert.deepEqual(logs, []);
});

test('socket failures recover once with bounded diagnostics and no private data', async t => {
  const logs = capture(t);
  for (const code of ['UND_ERR_SOCKET', 'ECONNRESET']) {
    let calls = 0;
    assert.equal(await withReadRetry('course-detail', 2, async () => {
      if (++calls === 1) throw socketError(code);
      return 42;
    }), 42);
    assert.equal(calls, 2);
    const entry = logs.at(-1);
    assert.equal(entry.level, 'warn');
    assert.equal(entry.event, 'database_read');
    assert.equal(entry.outcome, 'recovered');
    assert.equal(entry.attempts, 2);
    assert.equal(entry.code, code);
    assert.equal(entry.query, 2);
    assert.ok(Number.isInteger(entry.elapsedMs) && entry.elapsedMs >= 0);
  }
  assert.equal(logs.length, 2);
  assert.ok(!JSON.stringify(logs).includes('private'));
});

test('persistent failure stops after the second attempt and preserves the error', async t => {
  const logs = capture(t);
  const error = socketError();
  let calls = 0;
  await assert.rejects(withReadRetry('courses', 1, async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 2);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].level, 'error');
  assert.equal(logs[0].outcome, 'failed');
  assert.equal(logs[0].attempts, 2);
});

test('SQL/auth/quota/abort/unknown errors are not retried or logged verbatim', async t => {
  const logs = capture(t);
  const errors = [
    Object.assign(socketError(), { code: '28P01' }),
    Object.assign(new NeonDbError('private permissions'), { code: '42501' }),
    Object.assign(new NeonDbError('private syntax'), { code: '42601' }),
    new NeonDbError('private compute quota exceeded'),
    new NeonDbError('Server error (HTTP status 503): private response'),
    Object.assign(socketError(), { name: 'AbortError' }),
    socketError('UND_ERR_CONNECT_TIMEOUT'),
    new TypeError('private unknown problem'),
  ];
  for (const error of errors) {
    let calls = 0;
    await assert.rejects(withReadRetry('search', 1, async () => { calls++; throw error; }), e => e === error);
    assert.equal(calls, 1);
  }
  assert.equal(logs.length, errors.length);
  assert.ok(logs.every(entry => entry.outcome === 'failed' && entry.attempts === 1));
  assert.ok(!JSON.stringify(logs).includes('private'));
});

test('an actual Next stale-cache refresh retries only the failed member and stores fresh data', async t => {
  const logs = capture(t);
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
  const require = createRequire(import.meta.url);
  const { unstable_cache } = require('next/dist/server/web/spec-extension/unstable-cache.js');
  const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external.js');
  let entry;
  let value = 1;
  let shouldFail = false;
  const calls = [0, 0, 0, 0, 0];
  const incrementalCache = {
    generateSimpleCacheKey: async key => key,
    get: async () => entry,
    set: async (_key, result) => { entry = { value: result, isStale: false }; },
  };
  const get = unstable_cache(() => Promise.all(calls.map((_, i) => withReadRetry('course-detail', i + 1, async () => {
    calls[i]++;
    if (i === 2 && shouldFail) { shouldFail = false; throw socketError(); }
    return value;
  }))), ['retry-test'], { revalidate: 3600 });
  async function request() {
    const store = { incrementalCache, nextFetchId: 1 };
    const result = await workAsyncStorage.run(store, get);
    await Promise.all(Object.values(store.pendingRevalidates ?? {}));
    return result;
  }
  assert.deepEqual(await request(), [1, 1, 1, 1, 1]);
  entry.isStale = true;
  value = 2;
  shouldFail = true;
  assert.deepEqual(await request(), [1, 1, 1, 1, 1], 'Stale hit returns previous data during refresh');
  assert.deepEqual(calls, [2, 2, 3, 2, 2], 'Only the failed query was repeated');
  assert.deepEqual(await request(), [2, 2, 2, 2, 2], 'Recovered refresh populated the cache');
  assert.deepEqual(calls, [2, 2, 3, 2, 2], 'A fresh cache causes no additional reads');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].outcome, 'recovered');
});
