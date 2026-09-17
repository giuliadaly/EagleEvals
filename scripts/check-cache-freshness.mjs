// Runs the actual production Next server and POST route against isolated Postgres.
// No Neon credentials or production writes. Build output in .next is disposable.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { applyMigrations } from './lib/database.mjs';

const course = '000000000000000000000001';
const otherCourse = '000000000000000000000002';
const professor = '000000000000000000000003';
const otherProfessor = '000000000000000000000004';
const pg = await PGlite.create({ extensions: { pg_trgm } });
await applyMigrations({ query: (q, args) => pg.query(q, args) }, 'database/migrations');
await pg.query(`INSERT INTO migration_runs (snapshot_id, source_url, status, expected_counts, verification_manifest) VALUES ('test', 'fixture', 'importing', '{}', '{}')`);
await pg.query(`INSERT INTO courses (id, code, title, subject, description, legacy_document, source_snapshot) VALUES
  ($1, 'ENGL1010', 'First Year Writing Seminar', 'English', 'Fixture course', '{}', 'test'),
  ($2, 'ENGL2000', 'Literature', 'English', 'Fixture course', '{}', 'test')`, [course, otherCourse]);
await pg.query(`INSERT INTO professors (id, name, legacy_document, source_snapshot) VALUES
  ($1, 'Brian Zimmerman', '{}', 'test'), ($2, 'Jane O’Neill', '{}', 'test')`, [professor, otherProfessor]);
let reads = 0;
let failCourseRead = false;
let courseReadAttempts = 0;
let loseWriteResponse = false;
let writeAttempts = 0;
function raw(value, oid) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '+00');
  if (oid === 16) return value ? 't' : 'f';
  if (oid === 114 || oid === 3802) return JSON.stringify(value);
  if (Array.isArray(value)) return `{${value.map(x => x == null ? 'NULL' : JSON.stringify(String(x))).join(',')}}`;
  return String(value);
}
async function runQuery(db, query) {
  reads++;
  const result = await db.query(query.query, query.params, { rowMode: 'array' });
  return { fields: result.fields, rows: result.rows.map(row => row.map((value, i) => raw(value, result.fields[i].dataTypeID))), rowCount: result.affectedRows ?? result.rows.length };
}
const proxy = createServer(async (request, response) => {
  try {
    let body = '';
    for await (const chunk of request) body += chunk;
    const query = JSON.parse(body);
    if (query.query?.includes('SELECT * FROM course_summaries WHERE id')) {
      courseReadAttempts++;
      if (failCourseRead) {
        failCourseRead = false;
        request.socket.destroy();
        return;
      }
    }
    if (query.queries) writeAttempts++;
    const result = query.queries
      ? { results: await pg.transaction(async tx => { const rows = []; for (const q of query.queries) rows.push(await runQuery(tx, q)); return rows; }) }
      : await runQuery(pg, query);
    if (query.queries && loseWriteResponse) {
      loseWriteResponse = false;
      request.socket.destroy(); // The transaction committed, but acknowledgement was lost.
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ message: error.message, code: error.code }));
  }
});
proxy.listen(0, '127.0.0.1');
await once(proxy, 'listening');
const env = { ...process.env, DATABASE_URL: 'postgresql://fixture:fixture@ep-fixture.us-east-2.aws.neon.tech/fixture',
  FIXTURE_SQL_ORIGIN: `http://127.0.0.1:${proxy.address().port}`,
  NODE_OPTIONS: `--require=${path.resolve('scripts/lib/fixture-neon-preload.cjs')}` };
const next = path.resolve('node_modules/next/dist/bin/next');
let server;
let serverLog = '';
try {
  await rm('.next/cache/fetch-cache', { recursive: true, force: true });
  if (!process.argv.includes('--skip-build')) {
    const build = spawn(process.execPath, [next, 'build', '--webpack'], { env, stdio: 'inherit' });
    assert.equal((await once(build, 'exit'))[0], 0, 'Production build');
  }
  const port = process.env.CACHE_CHECK_PORT || '3134';
  server = spawn(process.execPath, [next, 'start', '-p', port], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverLog += chunk; });
  server.stderr.on('data', chunk => { serverLog += chunk; });
  const base = `http://localhost:${port}`;
  async function get(url) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200, `${url}: ${await response.clone().text().then(t => t.slice(0, 150))}`);
    return response;
  }
  for (let attempt = 0; ; attempt++) {
    try { await get('/api/search/evidence'); break; }
    catch (error) { if (attempt === 50 || server.exitCode != null) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  const urls = ['/', `/courses/${course}`, `/professors/${professor}`, '/courses', '/professors',
    '/comments', '/evaluations', `/courses/${course}/compare`, '/api/search?q=ENGL', '/api/search/evidence',
    `/api/courses/${course}/professors`, '/api/search/catalog/v2'];
  for (const url of urls) await get(url);
  // Allow Next's background cache writes to settle before measuring reuse.
  await new Promise(resolve => setTimeout(resolve, 100));
  reads = 0;
  for (const url of urls) await get(url);
  assert.equal(reads, 0, 'Unchanged repeat visits must not query Postgres');
  console.log(`PASS: ${urls.length} repeated page/API visits caused zero database queries.`);
  const payload = { courseId: course, professorId: professor, semester: 'Fall 2001', courseOverall: 4,
    instructorOverall: 5, message: 'Freshness fixture: clear lectures and helpful feedback every week.', firsthandConfirmed: true, guidelinesAccepted: true };
  const response = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(response.status, 201, await response.clone().text());
  for (const url of [`/courses/${course}`, `/professors/${professor}`, '/comments']) {
    assert.ok((await (await get(url)).text()).includes(payload.message), `First request must show the new review: ${url}`);
  }
  const evidence = await (await get('/api/search/evidence')).json();
  assert.deepEqual(evidence.courses.find(row => row[0] === course), [course, 1, 1]);
  assert.deepEqual(evidence.professors.find(row => row[0] === professor), [professor, 1, 1]);
  const search = await (await get('/api/search?q=ENGL')).json();
  assert.equal(search.courses.find(row => row.id === course).commentCount, 1);
  const pairs = await (await get(`/api/courses/${course}/professors`)).json();
  assert.equal(pairs.professors[0].id, professor);
  assert.ok((await (await get(`/courses/${course}`)).text()).includes('<strong>4.0<small>'), 'Current course average');
  assert.ok((await (await get(`/professors/${professor}`)).text()).includes('5.0'), 'Current professor average');
  assert.ok((await (await get('/evaluations')).text()).includes('Fall 2001'));
  const second = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({...payload, professorId: otherProfessor, instructorOverall: 3}) });
  assert.equal(second.status, 201);
  const comparison = await (await get(`/courses/${course}/compare?professor=${professor}&professor=${otherProfessor}`)).text();
  assert.ok(comparison.includes('5.00 / 5') && comparison.includes('3.00 / 5') && comparison.includes(payload.message), 'Comparison includes current pair-specific scores and reviews');
  assert.ok((await (await get(`/courses/${course}`)).text()).includes('<strong>4.0<small>'), 'Current course average');
  assert.equal((await (await get('/api/search/evidence')).json()).courses.find(row => row[0] === course)[1], 2);
  for (const url of urls) await get(url);
  await new Promise(resolve => setTimeout(resolve, 100));
  reads = 0;
  for (const url of urls) await get(url);
  assert.equal(reads, 0, 'Fresh data must be cached again after invalidation');
  console.log('PASS: new reviews, averages, search counts, archive and known professors refresh immediately, then reuse the new cache.');
  const duplicate = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(duplicate.status, 409);
  const thirdPayload = { ...payload, semester: 'Fall 2002', message: 'The latest review must appear even when a read connection drops.' };
  const third = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(thirdPayload) });
  assert.equal(third.status, 201);
  const beforeReads = courseReadAttempts;
  failCourseRead = true;
  assert.ok((await (await get(`/courses/${course}`)).text()).includes(thirdPayload.message));
  assert.equal(courseReadAttempts - beforeReads, 2, 'Only the failed course read gets a second attempt');
  assert.ok((await (await get(`/professors/${professor}`)).text()).includes(thirdPayload.message));
  assert.equal((await (await get('/api/search/evidence')).json()).courses.find(row => row[0] === course)[1], 3);
  const recovery = serverLog.split('\n').filter(line => line.startsWith('{"event":"database_read"')).map(line => JSON.parse(line));
  assert.ok(recovery.some(event => event.operation === 'course-detail' && event.outcome === 'recovered' && event.attempts === 2));
  console.log('PASS: actual dropped HTTP read recovers and the first post-submission page shows the new review.');

  const beforeWrites = writeAttempts;
  loseWriteResponse = true;
  const uncertain = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, semester: 'Fall 2003' }) });
  assert.equal(uncertain.status, 500);
  assert.equal(writeAttempts - beforeWrites, 1, 'A lost write acknowledgement must not cause an automatic retry');
  assert.equal((await pg.query("SELECT count(*)::integer AS total FROM reviews WHERE semester = 'Fall 2003'")).rows[0].total, 1);
  console.log('PASS: an uncertain committed submission is not automatically replayed.');
  if (process.argv.includes('--keep-server')) {
    console.log(`Fixture server ready for browser checks: ${base}. Press Ctrl-C to stop.`);
    await new Promise(resolve => process.once('SIGINT', resolve));
  }
} catch (error) {
  console.error(serverLog.slice(-8000));
  throw error;
} finally {
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  proxy.close();
  await pg.close();
}
