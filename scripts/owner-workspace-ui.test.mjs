import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { readAnonymousJson } from '../src/data/anonymous-request.ts';
import { reviewCampaignCourses, reviewCampaignCopy } from '../src/data/review-campaign.ts';

const actor = { githubId: '12345', name: 'Fixture owner' };
const id = '000000000000000000000001';
const professorId = '000000000000000000000002';
const actionId = '11111111-1111-4111-8111-111111111111';
const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const styles = new Proxy({}, { get: (_, key) => String(key) });
class OwnerManagementError extends Error { constructor(status, message) { super(message); this.status = status; } }

function load(file, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, Request, Response, Headers, URL, URLSearchParams, console, ...globals,
    require(name) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; } }, { filename: file });
  return compiled.exports;
}
function routeFixture({ configured = true, session = actor, error = null } = {}) {
  const calls = [];
  const reads = {};
  for (const name of ['getOwnerOverview', 'getOwnerReports', 'getOwnerReviewLookup', 'getOwnerCatalogCandidates']) reads[name] = async input => { calls.push([name, input]); if (error) throw error; return name === 'getOwnerCatalogCandidates' ? [] : { total: 0 }; };
  const mutation = name => async (input, owner) => { calls.push([name, input, owner]); if (error) throw error; return { actionId: input.actionId, replayed: false }; };
  const route = load('src/app/api/owner/manage/route.ts', {
    'next/server': { NextResponse: Response },
    'next/cache': { revalidatePath: (...args) => calls.push(['path', ...args]), revalidateTag: (...args) => calls.push(['tag', ...args]) },
    '@/data/owner-auth': { ownerAuth: () => configured ? {} : null, ownerSession: async () => { calls.push(['session']); return session; }, ownerResponseHeaders: privateHeaders },
    '@/data/anonymous-request': { readAnonymousJson }, '@/data/public-cache': { expireReviewData: () => calls.push(['reviews-expired']) },
    '@/data/owner-management': { OwnerManagementError, ...reads, changeOwnerReportStatus: mutation('report'), correctOwnerReviewAssociation: mutation('correction') },
  });
  const request = (payload, headers = {}) => new Request('http://localhost/api/owner/manage', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
  return { route, calls, request };
}
function expectPrivate(response) {
  assert.equal(response.headers.get('cache-control'), privateHeaders['Cache-Control']);
  assert.equal(response.headers.get('x-robots-tag'), privateHeaders['X-Robots-Tag']);
  assert.equal(response.headers.get('vary'), 'Cookie');
}

test('all owner API reads and writes authenticate before accessing private data', async () => {
  for (const view of ['overview', 'reports', 'reviews', 'catalog']) {
    const fixture = routeFixture({ session: null });
    const response = await fixture.route.GET(new Request(`http://localhost/api/owner/manage?view=${view}&q=private`));
    assert.equal(response.status, 401); expectPrivate(response);
    assert.deepEqual(fixture.calls, [['session']]);
  }
  const missing = routeFixture({ configured: false });
  const response = await missing.route.POST(missing.request({ action: 'correct-review' }));
  assert.equal(response.status, 503); expectPrivate(response); assert.deepEqual(missing.calls, []);
  const unsigned = routeFixture({ session: null });
  assert.equal((await unsigned.route.POST(unsigned.request({ action: 'report-status' }))).status, 401);
  assert.deepEqual(unsigned.calls, [['session']]);
});

test('owner mutation rejects cross-site, missing-origin, non-JSON and oversized requests before writes', async () => {
  const payload = { action: 'report-status', status: 'resolved', expectedVersion: 1 };
  for (const headers of [{ Origin: 'https://other.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Content-Type': 'text/plain' }, { 'Content-Length': '16001' }]) {
    const fixture = routeFixture();
    const response = await fixture.route.POST(fixture.request(payload, headers));
    assert.ok([403, 415, 413].includes(response.status)); expectPrivate(response);
    assert.deepEqual(fixture.calls, [['session']]);
  }
  const fixture = routeFixture(); const request = fixture.request(payload); request.headers.delete('origin');
  assert.equal((await fixture.route.POST(request)).status, 403); assert.deepEqual(fixture.calls, [['session']]);
});

test('course unlinking requires an explicit confirmation and success invalidates affected public data', async () => {
  const payload = { action: 'correct-review', actionId, reviewId: id, expectedFingerprint: 'a'.repeat(32), professorId, courseId: null, reason: 'Checked the original source.', evidenceUrl: 'https://example.com/evidence', actor: { githubId: 'attacker' } };
  for (const leaveCourseUnmatched of [undefined, false, 'true']) {
    const fixture = routeFixture(); const response = await fixture.route.POST(fixture.request({ ...payload, leaveCourseUnmatched }));
    assert.equal(response.status, 400); assert.deepEqual(fixture.calls, [['session']]);
  }
  const fixture = routeFixture(); const response = await fixture.route.POST(fixture.request({ ...payload, leaveCourseUnmatched: true }));
  assert.equal(response.status, 200); expectPrivate(response);
  const correction = fixture.calls.find(call => call[0] === 'correction');
  assert.equal(correction[1].courseId, null); assert.equal(correction[2], actor, 'actor comes only from the verified session');
  assert.ok(fixture.calls.some(call => call[0] === 'reviews-expired'));
  assert.ok(fixture.calls.some(call => call[0] === 'tag' && call[1] === 'eagleevals-catalog'));
  assert.ok(fixture.calls.some(call => call[0] === 'path' && call[1] === '/' && call[2] === 'layout'));
});

test('report decisions preserve publication and owner conflicts/errors stay safe and private', async () => {
  const payload = { action: 'report-status', actionId, reportId: id, status: 'resolved', expectedVersion: 2, reason: 'Reviewed the report evidence.' };
  const success = routeFixture(); const response = await success.route.POST(success.request(payload));
  assert.equal(response.status, 200); assert.match((await response.json()).message, /publication status has not changed/);
  assert.deepEqual(success.calls.map(call => call[0]), ['session', 'report']);
  for (const error of [new OwnerManagementError(409, 'Reload before saving again.'), new Error('SQL password private report text')]) {
    const fixture = routeFixture({ error }); const failed = await fixture.route.POST(fixture.request(payload)); expectPrivate(failed);
    assert.equal(failed.status, error instanceof OwnerManagementError ? 409 : 503);
    assert.ok(!(await failed.text()).includes('SQL password'));
    assert.deepEqual(fixture.calls.map(call => call[0]), ['session', 'report']);
  }
});

function allNodes(tree, result = []) {
  if (Array.isArray(tree)) for (const child of tree) allNodes(child, result);
  else if (tree && typeof tree === 'object' && tree.props) { result.push(tree); allNodes(tree.props.children, result); }
  return result;
}
test('owner page fails closed before DAL access and shows current review health separately from saved traffic', async () => {
  for (const configured of [false, true]) {
    const calls = [];
    const page = load('src/app/owner/page.tsx', {
      'react/jsx-runtime': jsx, 'next/link': { default: 'link' }, 'next/headers': { headers: async () => new Headers() },
      '@/data/owner-auth': { ownerAuth: () => configured ? {} : null, ownerSession: async () => null },
      '@/data/owner-management': Object.fromEntries(['getOwnerOverview', 'getOwnerReports', 'getOwnerReviewLookup'].map(name => [name, async () => calls.push(name)])),
      '@/components/owner-sign-in': {}, '@/components/site-header': {}, '@/components/site-footer': {},
      '@/data/format': {}, './owner-controls': {}, './owner.module.css': { default: styles },
    });
    const rendered = await page.default({ searchParams: Promise.resolve({}) });
    assert.deepEqual(calls, []); assert.ok(JSON.stringify(rendered).includes(configured ? 'Giulia' : 'not available yet'));
  }
  const calls = [];
  const overview = { reportCounts: { open: 0, resolved: 0, dismissed: 0 }, unmatchedReviews: 8, recentActions: [], growthBaselines: [], reviewHealth: { asOf: '2026-10-14', nativeLast7Days: 3, nativeLast28Days: 5, lastNativeSubmissionAt: null, writtenReviews: 100, courseLinkedWrittenReviews: 92, professorLinkedWrittenReviews: 100, oldestOpenReportAt: null } };
  const page = load('src/app/owner/page.tsx', {
    'react/jsx-runtime': jsx, 'next/link': { default: 'link' }, 'next/headers': { headers: async () => new Headers() },
    '@/data/owner-auth': { ownerAuth: () => ({}), ownerSession: async () => actor },
    '@/data/owner-management': { getOwnerOverview: async () => { calls.push('overview'); return overview; }, getOwnerReports: async () => { calls.push('reports'); return { reports: [], total: 0 }; }, getOwnerReviewLookup: async () => { calls.push('reviews'); return { reviews: [], total: 0 }; } },
    '@/components/owner-sign-in': {}, '@/components/site-header': {}, '@/components/site-footer': {},
    '@/data/format': { formatCount: String, formatDate: String }, './owner-controls': {}, './owner.module.css': { default: styles },
  });
  const tree = await page.default({ searchParams: Promise.resolve({}) });
  assert.deepEqual(calls, ['overview', 'reports', 'reviews']);
  const rendered = JSON.stringify(tree); assert.match(rendered, /New submissions in 7 days/); assert.match(rendered, /recovered historical comments are excluded/); assert.match(rendered, /Saved traffic snapshots/);
});

test('correction form cannot silently unlink while searching and retains idempotency on failed retries', async () => {
  let cells = [], cursor = 0, posts = [], release;
  const state = initial => { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], value => { cells[index] = value; }]; };
  const react = { useState: state, useRef: value => state({ current: value })[0], useId: () => ':id:' };
  const component = load('src/app/owner/owner-controls.tsx', {
    react, 'react/jsx-runtime': jsx, 'next/navigation': { useRouter: () => ({ refresh() {} }) }, './owner.module.css': { default: styles },
  }, { crypto: { randomUUID: () => actionId }, FormData: class { get(key) { return ({ reason: 'Checked the original record.', evidenceUrl: 'https://example.com/evidence' })[key] ?? null; } },
    fetch: async (_, options) => { posts.push(JSON.parse(options.body)); await new Promise(resolve => { release = resolve; }); return { ok: false, status: 409, json: async () => ({ message: 'Reload before saving again.' }) }; } });
  const review = { id, professorId, professorName: 'Fixture professor', courseId: id, courseCode: 'TEST1000', courseTitle: 'Fixture', fingerprint: 'a'.repeat(32), contextNote: null, sourceUrl: null, pairedRatingId: 'rating-id' };
  const render = () => { cursor = 0; return component.OwnerAssociationControls({ review }); };
  let tree = render(); let nodes = allNodes(tree);
  assert.ok(JSON.stringify(tree).includes('linked numerical evaluation'));
  nodes.find(node => node.props.kind === 'course').props.onSelect(null);
  tree = render(); nodes = allNodes(tree);
  assert.equal(nodes.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} }); assert.equal(posts.length, 0);
  nodes.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = render(); nodes = allNodes(tree); assert.equal(nodes.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
  const form = nodes.find(node => node.type === 'form'); form.props.onSubmit({ preventDefault() {}, currentTarget: {} }); form.props.onSubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(posts.length, 1); assert.equal(posts[0].courseId, null); assert.equal(posts[0].leaveCourseUnmatched, true);
  release(); await new Promise(resolve => setImmediate(resolve));
  tree = render(); assert.match(JSON.stringify(tree), /Reload before saving again/);
  allNodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(posts.length, 2); assert.equal(posts[1].actionId, posts[0].actionId, 'an exact retry reuses its action ID');
  release(); await new Promise(resolve => setImmediate(resolve));
});

test('public campaign uses only course-prefilled anonymous links and no stale counts or time promise', () => {
  assert.equal(reviewCampaignCourses.length, 12);
  for (const course of reviewCampaignCourses) {
    const url = new URL(course.reviewHref, 'https://eagleevals.com');
    assert.equal(url.pathname, '/review'); assert.deepEqual([...url.searchParams], [['course', course.id]]);
    assert.deepEqual(Object.keys(course).sort(), ['code', 'id', 'reviewHref', 'subject', 'title']);
  }
  assert.match(reviewCampaignCopy.privacy, /No account/);
  assert.match(reviewCampaignCopy.semesterNote, /semester/);
  assert.ok(!/under.?a?.?minute|less than|review count|giveaway/i.test(JSON.stringify(reviewCampaignCopy)));
});
