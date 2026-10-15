// Runs the actual production Next server and POST route against isolated Postgres.
// No Neon credentials or production writes. Build output in .next is disposable.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { applyMigrations } from './lib/database.mjs';
import { createFixtureOwnerSession } from './lib/fixture-owner-session.mjs';

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
const port = process.env.CACHE_CHECK_PORT || '3134';
const ownerConfig = { baseURL: `http://localhost:${port}`, secret: randomBytes(48).toString('base64url'),
  clientId: 'fixture-owner-client', clientSecret: 'fixture-owner-secret', githubId: '5249812' };
const ownerFixture = await createFixtureOwnerSession(ownerConfig);
const env = { ...process.env, DATABASE_URL: 'postgresql://fixture:fixture@ep-fixture.us-east-2.aws.neon.tech/fixture',
  OWNER_AUTH_URL: ownerConfig.baseURL, OWNER_AUTH_SECRET: ownerConfig.secret,
  OWNER_GITHUB_CLIENT_ID: ownerConfig.clientId, OWNER_GITHUB_CLIENT_SECRET: ownerConfig.clientSecret,
  OWNER_GITHUB_ID: ownerConfig.githubId,
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

  // Owner-only production routes use the same Next request context, signed
  // session verifier, private SQL functions and public revalidation as deploys.
  function privateResponse(response) {
    assert.match(response.headers.get('cache-control') ?? '', /private/i);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/i);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/i);
    // Next manages the HTML/RSC Vary header itself. Private no-store protects
    // those pages; JSON APIs retain the explicit cookie variation.
    if (/json/i.test(response.headers.get('content-type') ?? '')) assert.match(response.headers.get('vary') ?? '', /cookie/i);
  }
  async function ownerRequest(query = '', body, { cookie = ownerFixture.cookie, origin = base } = {}) {
    const response = await fetch(`${base}/api/owner/manage${query}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    privateResponse(response);
    return response;
  }
  const beforeBlocked = reads;
  for (const body of [undefined, { action: 'report-status', reportId: course, status: 'resolved', expectedVersion: 1 }]) {
    const blocked = await ownerRequest('', body, { cookie: '' });
    assert.equal(blocked.status, 401);
    assert.doesNotMatch(await blocked.text(), /recentActions|reportCounts|growthBaselines|fingerprint/);
  }
  const forged = await ownerRequest('', undefined, { cookie: 'eagleevals-owner.session_token=forged; eagleevals-owner.session_data=forged' });
  assert.equal(forged.status, 401);
  assert.equal(reads, beforeBlocked, 'Unauthenticated or forged owner API requests must not read Postgres');
  const malformed = await ownerRequest('', { action: 'report-status', status: 'hidden', expectedVersion: '1' });
  assert.equal(malformed.status, 400);
  const crossOrigin = await ownerRequest('', { action: 'report-status' }, { origin: 'https://attacker.example.test' });
  assert.equal(crossOrigin.status, 403);
  assert.equal(reads, beforeBlocked, 'Invalid owner mutations must fail before database access');
  const overviewResponse = await ownerRequest();
  assert.equal(overviewResponse.status, 200);
  const initialOverview = await overviewResponse.json();
  assert.deepEqual(initialOverview.reportCounts, { open: 0, resolved: 0, dismissed: 0 });
  assert.deepEqual(initialOverview.recentActions, []);
  assert.deepEqual(initialOverview.growthBaselines, []);
  console.log('PASS: owner API rejects unauthenticated/forged sessions before SQL and protects private responses.');

  const native = (await pg.query(`SELECT sc.id, sc.message FROM student_comments sc JOIN reviews r ON r.id=sc.review_id
    WHERE r.semester='Fall 2001' AND sc.professor_id=$1 ORDER BY sc.id LIMIT 1`, [professor])).rows[0];
  assert.ok(native);
  const privateMessage = 'Fixture private correction report: the course and professor association needs checking.';
  const reportResponse = await fetch(`${base}/api/reports`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetKind: 'review', targetId: native.id, reason: 'wrong-association', message: privateMessage, privacyConfirmed: true }) });
  assert.equal(reportResponse.status, 201, await reportResponse.clone().text());
  const queueResponse = await ownerRequest('?view=reports&status=open');
  assert.equal(queueResponse.status, 200);
  const queue = await queueResponse.json();
  assert.equal(queue.total, 1);
  const report = queue.reports[0];
  assert.equal(report.message, privateMessage);
  assert.equal(report.targetId, native.id);
  assert.equal(report.version, 1);
  const unauthorizedPageReads = reads;
  const ownerAnon = await get('/owner');
  privateResponse(ownerAnon);
  const anonymousHtml = await ownerAnon.text();
  assert.match(anonymousHtml, /Sign in with Giulia/);
  assert.doesNotMatch(anonymousHtml, /Fixture Owner|Fixture private correction report|growthBaselines|expectedFingerprint/);
  assert.equal(reads, unauthorizedPageReads, 'The unauthenticated owner page must not query the private dataset');
  const ownerPage = await fetch(`${base}/owner?unmatched=all`, { headers: { Cookie: ownerFixture.cookie } });
  assert.equal(ownerPage.status, 200);
  privateResponse(ownerPage);
  const ownerHtml = await ownerPage.text();
  assert.match(ownerHtml, /Fixture Owner/);
  assert.ok(ownerHtml.includes(privateMessage));
  assert.ok(ownerHtml.includes(native.message));
  assert.match(ownerHtml, /name="robots"[^>]*content="[^"]*noindex/);
  const rawSources = async () => {
    const snapshot = {};
    for (const table of ['courses', 'professors', 'reviews', 'review_metrics', 'student_comments', 'external_review_profiles', 'external_reviews']) {
      snapshot[table] = (await pg.query(`SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    }
    return snapshot;
  };
  const beforeOwnerChanges = await rawSources();
  const resolvePayload = { action: 'report-status', actionId: randomUUID(), reportId: report.id, status: 'resolved', expectedVersion: 1,
    reason: 'Verified fixture correction and reviewed the original source.' };
  const resolvedResponse = await ownerRequest('', resolvePayload);
  assert.equal(resolvedResponse.status, 200, await resolvedResponse.clone().text());
  const resolved = await resolvedResponse.json();
  assert.equal(resolved.report.status, 'resolved');
  assert.equal(resolved.report.version, 2);
  assert.ok(resolved.report.resolvedAt);
  const replayResponse = await ownerRequest('', resolvePayload);
  assert.equal(replayResponse.status, 200);
  assert.equal((await replayResponse.json()).replayed, true);
  const staleResponse = await ownerRequest('', { ...resolvePayload, actionId: randomUUID(), status: 'open' });
  assert.equal(staleResponse.status, 409);
  const reopenedResponse = await ownerRequest('', { ...resolvePayload, actionId: randomUUID(), status: 'open', expectedVersion: 2 });
  assert.equal(reopenedResponse.status, 200);
  const reopened = await reopenedResponse.json();
  assert.equal(reopened.report.status, 'open');
  assert.equal(reopened.report.version, 3);
  assert.equal(reopened.report.resolvedAt, null);
  assert.deepEqual(await rawSources(), beforeOwnerChanges, 'Report decisions never remove or rewrite review/source records');
  const lookupResponse = await ownerRequest(`?view=reviews&unmatched=false&review=${encodeURIComponent(native.id)}`);
  assert.equal(lookupResponse.status, 200);
  const current = (await lookupResponse.json()).reviews[0];
  assert.equal(current.id, native.id);
  assert.equal(current.professorId, professor);
  assert.equal(current.courseId, course);
  assert.match(current.fingerprint, /^[0-9a-f]{32}$/);
  assert.equal(current.message, native.message);
  const countsBefore = (await pg.query('SELECT id,comment_count,review_count FROM course_summaries ORDER BY id')).rows;
  // Warm both sides of the correction so the next requests must invalidate
  // cached results rather than simply encounter an uncached destination.
  for (const url of [`/courses/${course}`, `/courses/${otherCourse}`, `/professors/${professor}`, `/professors/${otherProfessor}`, '/api/search/evidence']) await get(url);
  const correctPayload = { action: 'correct-review', actionId: randomUUID(), reviewId: native.id, expectedFingerprint: current.fingerprint,
    professorId: otherProfessor, courseId: otherCourse, reason: 'Verified this fixture association against the original course catalog.',
    evidenceUrl: 'https://example.org/fixture/catalog', contextNoteMode: 'preserve' };
  const correctionResponse = await ownerRequest('', correctPayload);
  assert.equal(correctionResponse.status, 200, await correctionResponse.clone().text());
  const corrected = await correctionResponse.json();
  assert.equal(corrected.review.professorId, otherProfessor);
  assert.equal(corrected.review.courseId, otherCourse);
  assert.equal(corrected.review.message, native.message);
  assert.notEqual(corrected.review.fingerprint, current.fingerprint);
  assert.equal(corrected.review.overrideVersion, 1);
  assert.deepEqual(await rawSources(), beforeOwnerChanges, 'Corrections preserve every original rating, comment, text and catalog/source field');
  const countsAfter = (await pg.query('SELECT id,comment_count,review_count FROM course_summaries ORDER BY id')).rows;
  assert.equal(countsAfter.find(row => row.id === course).comment_count, countsBefore.find(row => row.id === course).comment_count - 1);
  assert.equal(countsAfter.find(row => row.id === otherCourse).comment_count, countsBefore.find(row => row.id === otherCourse).comment_count + 1);
  assert.equal(countsAfter.find(row => row.id === course).review_count, countsBefore.find(row => row.id === course).review_count - 1, 'The attached native numerical evaluation follows its corrected comment');
  assert.equal(countsAfter.find(row => row.id === otherCourse).review_count, countsBefore.find(row => row.id === otherCourse).review_count + 1);
  const immediateEvidence = await (await get('/api/search/evidence')).json();
  for (const row of countsAfter) assert.deepEqual(immediateEvidence.courses.find(item => item[0] === row.id), [row.id, row.review_count, row.comment_count]);
  const professorCounts = (await pg.query('SELECT id,review_count,comment_count FROM professor_summaries ORDER BY id')).rows;
  for (const row of professorCounts) assert.deepEqual(immediateEvidence.professors.find(item => item[0] === row.id), [row.id, row.review_count, row.comment_count]);
  const correctedCourseHtml = await (await get(`/courses/${otherCourse}`)).text();
  assert.ok(correctedCourseHtml.includes(native.message), 'The first destination course request shows the preserved comment');
  const oldProfessorHtml = await (await get(`/professors/${professor}`)).text();
  assert.ok(oldProfessorHtml.includes(native.message), 'Another independent original comment with the same text remains visible');
  const correctedPairs = await (await get(`/api/courses/${otherCourse}/professors`)).json();
  assert.ok(correctedPairs.professors.some(row => row.id === otherProfessor), 'The corrected destination pair is discoverable immediately');
  const correctedSearch = await (await get('/api/search?q=ENGL')).json();
  for (const row of countsAfter) assert.equal(correctedSearch.courses.find(item => item.id === row.id).commentCount, row.comment_count);
  const finalOverviewResponse = await ownerRequest();
  assert.equal(finalOverviewResponse.status, 200);
  const finalOverview = await finalOverviewResponse.json();
  assert.deepEqual(finalOverview.reportCounts, { open: 1, resolved: 0, dismissed: 0 });
  assert.equal(finalOverview.recentActions.length, 3);
  assert.equal((await (await get('/comments')).text()).includes(privateMessage), false, 'Private report text never enters the public feed');
  console.log('PASS: owner SSR, private reports, versioned decisions and review corrections preserve source data and refresh public counts immediately.');
  if (process.argv.includes('--keep-server')) {
    const ownerPreviewPath = '/private/tmp/eagleevals-owner-fixture-preview.json';
    await writeFile(ownerPreviewPath, JSON.stringify({ baseURL: base, cookie: ownerFixture.cookie,
      expiresAt: ownerFixture.expiresAt, githubId: ownerConfig.githubId, name: ownerFixture.name }, null, 2), { mode: 0o600 });
    console.log(`Local fixture owner session for browser checks: ${ownerPreviewPath}`);
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
