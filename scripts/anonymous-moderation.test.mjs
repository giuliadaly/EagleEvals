import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { applyMigrations } from './lib/database.mjs';
import { readAnonymousJson } from '../src/data/anonymous-request.ts';
import { reportHref, validateAnonymousReport } from '../src/data/report-validation.ts';
import { validateReviewSubmission } from '../src/data/review-validation.ts';

function loadTs(file, dependencies, consoleSink = console) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, console: consoleSink, Request, Response,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; } }, { filename: file });
  return compiled.exports;
}
const course = '000000000000000000000001';
const professor = '000000000000000000000002';
const otherProfessor = '000000000000000000000003';
const makeRequest = (url, body, headers = {}) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const report = { targetKind: 'review', targetId: 'legacy', reason: 'wrong-association', message: 'This comment belongs to a different course and professor.', privacyConfirmed: true };
const review = { courseId: course, professorId: professor, semester: 'Fall 2026', courseOverall: 4, instructorOverall: 5,
  message: 'Weekly quizzes covered the lecture examples closely, and the professor gave detailed feedback on each paper before the next assignment was due.', firsthandConfirmed: true, guidelinesAccepted: true };

test('anonymous JSON reader bounds real bytes, rejects cross-site requests and malformed bodies', async () => {
  assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reports', report))).ok, true);
  assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reports', report, { Origin: 'https://another.example' }))).status, 403);
  assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reports', report, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reports', report, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reports', { message: 'x'.repeat(20_000) }, { 'Content-Length': '1' }))).status, 413);
  const invalid = new Request('https://eagleevals.com/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal((await readAnonymousJson(invalid)).status, 400);
  assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reports', { message: '🦅'.repeat(40) }), 100)).status, 413);
});

test('anonymous forms accept the public host behind Next and Vercel without accepting unrelated origins', async () => {
  for (const { url, origin, headers } of [
    { url: 'http://localhost:3135/api/reviews', origin: 'http://127.0.0.1:3135', headers: { Host: '127.0.0.1:3135' } },
    { url: 'http://127.0.0.1:3135/api/reviews', origin: 'http://localhost:3135', headers: { Host: 'localhost:3135' } },
    { url: 'http://internal-server/api/reviews', origin: 'https://eagleevals.com', headers: { Host: 'internal-server', 'X-Forwarded-Host': 'eagleevals.com', 'X-Forwarded-Proto': 'https' } },
    { url: 'https://deployment.vercel.app/api/reports', origin: 'https://www.eagleevals.com', headers: { Host: 'deployment.vercel.app', 'X-Forwarded-Host': 'www.eagleevals.com, internal-server' } },
  ]) {
    const result = await readAnonymousJson(makeRequest(url, report, { ...headers, Origin: origin, 'Sec-Fetch-Site': 'same-origin' }));
    assert.equal(result.ok, true, origin);
    assert.deepEqual(result.body, report);
  }
  for (const headers of [
    { Origin: 'https://unrelated.example', Host: 'eagleevals.com', 'X-Forwarded-Host': 'eagleevals.com' },
    { Origin: 'https://eagleevals.com', Host: 'eagleevals.com', 'X-Forwarded-Host': 'unrelated.example' },
    { Origin: 'https://unrelated.example', Host: 'unrelated.example', 'Sec-Fetch-Site': 'cross-site' },
    { Origin: 'null', Host: 'eagleevals.com' },
    { Origin: 'file://eagleevals.com', Host: 'eagleevals.com' },
    { Origin: 'https://eagleevals.com/path', Host: 'eagleevals.com' },
    { Origin: 'https://user:password@eagleevals.com', Host: 'eagleevals.com' },
  ]) assert.equal((await readAnonymousJson(makeRequest('https://eagleevals.com/api/reviews', report, headers))).status, 403);
});

test('report validation copies content fields only and preserves source IDs', () => {
  const result = validateAnonymousReport({ ...report, targetId: 'rmp:UmF0aW5nLTI=', email: 'must-not-save', ip: 'must-not-save', studentId: 'must-not-save', userAgent: 'must-not-save' });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.data).sort(), ['message', 'reason', 'targetId', 'targetKind']);
  assert.equal(result.data.targetId, 'rmp:UmF0aW5nLTI=');
  assert.equal(new URL(reportHref('review', 'rmp:UmF0aW5nLTI='), 'https://eagleevals.com').searchParams.get('review'), 'rmp:UmF0aW5nLTI=');
  for (const input of [
    { ...report, website: 'spam' }, { ...report, targetId: "x' OR 1=1" }, { ...report, targetKind: 'account' },
    { ...report, message: 'Reply to me at person@example.com with an update.' }, { ...report, privacyConfirmed: false },
    { ...report, message: 'short' }, { ...report, message: 'x'.repeat(2001) }, { ...report, reason: 'unknown' },
  ]) assert.equal(validateAnonymousReport(input).ok, false);
});

async function fixture(t) {
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  t.after(() => pg.close());
  const lazy = (text, values = []) => ({ text, values, then(resolve, reject) { return pg.query(text, values).then(result => result.rows).then(resolve, reject); } });
  const sql = (strings, ...values) => lazy(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values);
  sql.query = lazy;
  sql.transaction = queries => pg.transaction(async tx => {
    const rows = [];
    for (const query of queries) rows.push((await tx.query(query.text, query.values)).rows);
    return rows;
  });
  await applyMigrations(sql, path.join(process.cwd(), 'database/migrations'));
  await pg.query("INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest) VALUES ('test','fixture','verified','{}','{}')");
  await pg.query("INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot) VALUES($1,'MATH1004','Finite Probability','Mathematics','Fixture course','{}','test')", [course]);
  await pg.query("INSERT INTO professors(id,name,legacy_document,source_snapshot) VALUES($1,'Fixture Professor','{}','test'),($2,'Other Professor','{}','test')", [professor, otherProfessor]);
  await pg.query("INSERT INTO student_comments(id,professor_id,course_id,message,source) VALUES('legacy',$1,$2,'A native comment from the preserved archive.','legacy_eagleeval')", [professor, course]);
  await pg.query("INSERT INTO external_review_profiles(source_teacher_id,legacy_teacher_id,school_id,display_name,match_method,reported_rating_count,source_document,source_snapshot,fetched_at) VALUES('teacher',1,'U2Nob29sLTEyMg==','Source Professor','unmatched',1,'{}','test',now())");
  await pg.query("INSERT INTO external_reviews(source_review_id,source_teacher_id,message,created_at,source_document,source_snapshot,fetched_at) VALUES('UmF0aW5nLTI=','teacher','An external comment without a linked professor.',now(),'{}','test',now())");
  const reports = loadTs('src/app/api/reports/route.ts', { 'node:crypto': { randomBytes }, 'next/server': { NextResponse: Response },
    '@/data/anonymous-request': { readAnonymousJson }, '@/data/report-validation': { validateAnonymousReport }, '@/data/database': { database: () => sql } });
  const reviews = loadTs('src/app/api/reviews/route.ts', { 'node:crypto': { createHash, randomBytes }, 'next/server': { NextResponse: Response },
    'next/cache': { revalidatePath() {} }, '@/data/public-cache': { expireReviewData() {} }, '@/data/anonymous-request': { readAnonymousJson },
    '@/data/review-validation': { validateReviewSubmission }, '@/data/database': { database: () => sql } });
  return { pg, sql, submitReport: body => reports.POST(makeRequest('http://localhost/api/reports', body)),
    submitReview: body => reviews.POST(makeRequest('http://localhost/api/reviews', body)) };
}

test('private reports accept native and unlinked external reviews, reject unknown targets, and preserve published content', async t => {
  const { pg, sql, submitReport } = await fixture(t);
  const before = (await pg.query('SELECT * FROM public_written_reviews ORDER BY id')).rows;
  const saved = await submitReport(report);
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).saved, true);
  assert.equal((await submitReport({ ...report, message: report.message.toUpperCase() + '!!!' })).status, 200);
  assert.equal((await submitReport({ ...report, targetId: 'rmp:UmF0aW5nLTI=' })).status, 201);
  assert.equal((await submitReport({ ...report, targetId: 'rmp:not-real' })).status, 404);
  assert.equal((await submitReport({ ...report, targetKind: 'course', targetId: '000000000000000000000099' })).status, 404);
  assert.equal((await submitReport({ ...report, targetKind: 'professor', targetId: professor })).status, 201);
  assert.equal((await submitReport({ ...report, targetKind: 'site', targetId: null })).status, 201);
  assert.equal((await submitReport({ ...report, reason: 'unknown' })).status, 400);
  const rows = (await pg.query('SELECT * FROM anonymous_reports')).rows;
  assert.equal(rows.length, 4);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['created_at', 'id', 'message', 'reason', 'resolved_at', 'status', 'target_id', 'target_kind', 'updated_at', 'version']);
  assert.equal(rows[0].version, 1);
  assert.deepEqual((await pg.query('SELECT * FROM public_written_reviews ORDER BY id')).rows, before);
  await applyMigrations(sql, path.join(process.cwd(), 'database/migrations'));
  assert.equal((await pg.query('SELECT count(*) FROM anonymous_reports')).rows[0].count, 4);
});

test('near-duplicate guard is narrow, keeps different terms and experiences, and rolls back failed writes', async t => {
  const { pg, submitReview } = await fixture(t);
  assert.equal((await submitReview(review)).status, 201);
  assert.equal((await submitReview({ ...review, courseOverall: 2, message: review.message + '!' })).status, 409);
  assert.equal((await submitReview({ ...review, message: review.message.replace('closely', 'closeley') })).status, 409);
  assert.equal((await submitReview({ ...review, semester: 'Spring 2026' })).status, 201);
  assert.equal((await submitReview({ ...review, professorId: otherProfessor })).status, 201);
  assert.equal((await submitReview({ ...review, message: 'Weekly quizzes covered the lecture examples closely, but the exams tested entirely different material. Office hours helped me prepare for the final.' })).status, 201);
  assert.equal((await pg.query('SELECT count(*) FROM reviews')).rows[0].count, 4);
  assert.equal((await pg.query('SELECT count(*) FROM review_metrics')).rows[0].count, 4);
  assert.equal((await pg.query("SELECT count(*) FROM student_comments WHERE source='eagleevals_anonymous'")).rows[0].count, 4);
  await pg.query("UPDATE reviews SET submitted_at = now() - interval '2 days'");
  assert.equal((await submitReview({ ...review, message: review.message + ' Really helpful.' })).status, 201);
});

test('pair submission bursts and report queue bursts have short retry responses without user identifiers', async t => {
  const { pg, submitReview, submitReport } = await fixture(t);
  await pg.query(`INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,section,source,published,submitted_at,legacy_document)
    SELECT lpad(to_hex(1000+n),24,'0'),$1,$2,'MATH1004','Fixture Professor','Fall 2026',1,'eagleevals_anonymous',true,now(),'{}'
    FROM generate_series(1,50) n`, [course, professor]);
  const blocked = await submitReview(review);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal((await submitReview({ ...review, professorId: otherProfessor })).status, 201);
  await pg.query("UPDATE reviews SET submitted_at=now()-interval '2 minutes'");
  assert.equal((await submitReview(review)).status, 201);
  await pg.query(`INSERT INTO anonymous_reports(id,target_kind,reason,message)
    SELECT lpad(to_hex(2000+n),24,'0'),'site','other','Fixture report for a burst test ' || n FROM generate_series(1,120) n`);
  const reportBlocked = await submitReport(report);
  assert.equal(reportBlocked.status, 429);
  assert.equal(reportBlocked.headers.get('retry-after'), '60');
  await pg.query("UPDATE anonymous_reports SET created_at=now()-interval '2 minutes'");
  assert.equal((await submitReport(report)).status, 201);
});

test('review database initialization and lookup failures return safe errors instead of escaping the route', async () => {
  for (const initialization of [true, false]) {
    const logs = [];
    const broken = () => { throw Object.assign(new Error('PRIVATE DATABASE AND SUBMITTED VALUES'), { code: '08006' }); };
    const route = loadTs('src/app/api/reviews/route.ts', { 'node:crypto': { createHash, randomBytes }, 'next/server': { NextResponse: Response },
      'next/cache': { revalidatePath() {} }, '@/data/public-cache': { expireReviewData() {} }, '@/data/anonymous-request': { readAnonymousJson },
      '@/data/review-validation': { validateReviewSubmission }, '@/data/database': { database: initialization ? broken : () => broken } }, { error: (...parts) => logs.push(parts) });
    const response = await route.POST(makeRequest('http://localhost/api/reviews', review));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).message, 'The review could not be saved. Please try again.');
    assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
  }
});

test('report form retains the draft through outages, avoids double submits, and requires a saved acknowledgement', async () => {
  const slots = [];
  let cursor = 0;
  let requests = 0;
  let response;
  let release;
  let fetchResult = new Promise(resolve => { release = resolve; });
  const react = {
    useRef(value) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
  };
  const jsx = (type, props) => ({ type, props });
  const source = ts.transpileModule(readFileSync('src/components/anonymous-report-form.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  const dependencies = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': () => null };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name];
  }, FormData: class { get() { return ''; } }, requestAnimationFrame: callback => callback(),
    fetch: async (_url, options) => { requests++; assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['message', 'privacyConfirmed', 'reason', 'targetId', 'targetKind', 'website']); return fetchResult; } });
  const flatten = element => !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(flatten)];
  let tree;
  const render = () => { cursor = 0; tree = compiled.exports.AnonymousReportForm({ reference: { kind: 'review', id: 'legacy', label: 'Fixture review', href: '/comments' } }); return tree; };
  const find = type => flatten(tree).find(element => element.type === type);
  render();
  find('textarea').props.onChange({ target: { value: report.message } });
  find('select').props.onChange({ target: { value: 'wrong-association' } });
  flatten(tree).find(element => element.type === 'input' && element.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  render();
  const event = { preventDefault() {}, currentTarget: {} };
  const first = tree.props.onSubmit(event);
  await tree.props.onSubmit(event);
  assert.equal(requests, 1);
  release(Response.json({ message: 'PRIVATE DATABASE ERROR' }, { status: 503 }));
  await first;
  render();
  assert.equal(find('textarea').props.value, report.message);
  assert.equal(find('select').props.value, 'wrong-association');
  assert.equal(flatten(tree).find(element => element.props?.role === 'alert').props.children.includes('PRIVATE'), false);
  assert.equal(find('button').props.disabled, false);
  for (response of [new Response('<html>unexpected proxy response</html>'), Response.json({ saved: false })]) {
    fetchResult = response;
    await tree.props.onSubmit(event);
    render();
    assert.equal(find('textarea').props.value, report.message);
    assert.ok(flatten(tree).find(element => element.props?.role === 'alert'));
  }
  fetchResult = Response.json({ saved: true }, { status: 201 });
  await tree.props.onSubmit(event);
  render();
  assert.equal(tree.props.role, 'status');
});
