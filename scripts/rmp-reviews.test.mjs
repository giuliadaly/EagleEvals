import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const school = 'U2Nob29sLTEyMg==';
const localId = '000000000000000000000001';
const encode = value => Buffer.from(value).toString('base64');
const cursor = encode('arrayconnection:9');
const teacher = (name = 'Example Teacher', id = 123, schoolId = school) => {
  const [firstName, ...last] = name.split(' ');
  return { id: encode(`Teacher-${id}`), legacyId: id, firstName, lastName: last.join(' '), school: { id: schoolId } };
};
const review = (id = 1, overrides = {}) => ({ id: encode(`Rating-${id}`), class: 'MKTG1021',
  comment: 'Fixture feedback about a sample class.', date: '2025-01-13 04:14:50 +0000 UTC', wouldTakeAgain: 'No', ...overrides });
const page = (reviews, next = false, after = null, person = teacher()) => ({ node: { ...person, numRatings: 12,
  ratings: { edges: reviews.map(node => ({ node })), pageInfo: { hasNextPage: next, endCursor: after } } } });

function load(file, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, Buffer, AbortSignal, Request, Response, URL, console: { warn() {} }, ...globals,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; } }, { filename: file });
  return compiled.exports;
}

function provider(responses) {
  const requests = [];
  const api = load('src/data/rmp.ts', { 'server-only': {}, 'next/cache': { unstable_cache: fn => fn } }, {
    async fetch(url, options) {
      requests.push({ url, ...JSON.parse(options.body) });
      const data = responses.shift();
      assert.notEqual(data, undefined, 'Unexpected upstream request');
      if (data instanceof Error) throw data;
      if (data instanceof Response) return data;
      return Response.json({ data });
    },
  });
  return { ...api, requests };
}

const search = people => ({ newSearch: { teachers: { edges: people.map(node => ({ node })) } } });

test('RMP identity matching requires BC, an exact unique name and a consistent stable ID', () => {
  const api = provider([]);
  const person = teacher('Jane O’Neill');
  assert.equal(api.matchRmpTeacher("Jane O'Neill", [person]).status, 'matched');
  assert.equal(api.matchRmpTeacher('Jane O’Neill', [teacher('Jane O’Neill', 123, 'other-school')]).status, 'not_found');
  assert.equal(api.matchRmpTeacher('Example Teacher', [teacher('Example Teacher Junior')]).status, 'not_found');
  assert.equal(api.matchRmpTeacher('Example Teacher', [teacher(), teacher('Example Teacher', 124)]).status, 'ambiguous');
  assert.equal(api.matchRmpTeacher('Example Teacher', [{ ...teacher(), id: encode('Teacher-999') }]).status, 'not_found');
});

test('RMP pages retain provenance, original course codes, posted dates and false take-again responses', async () => {
  const api = provider([search([teacher()]), page([review(1), review(2, { class: 'MGTG3177', wouldTakeAgain: null })], true, cursor), search([teacher()]), page([review(3, { wouldTakeAgain: 'Yes' })])]);
  const first = await api.getRmpReviews(localId, 'Example Teacher', null, null);
  assert.equal(first.comments[0].id, `rmp:${encode('Rating-1')}`);
  assert.equal(first.comments[0].source, 'ratemyprofessors');
  assert.equal(first.comments[0].sourceUrl, 'https://www.ratemyprofessors.com/professor/123');
  assert.equal(first.comments[0].professorId, localId);
  assert.equal(first.comments[0].wouldTakeAgain, false);
  assert.equal(first.comments[0].semester, null);
  assert.equal(first.comments[0].createdAt, '2025-01-13T04:14:50.000Z');
  assert.equal(first.comments[1].courseCode, 'MGTG3177');
  assert.equal(first.comments[1].courseId, null);
  assert.equal(first.comments[1].wouldTakeAgain, null);
  assert.equal(first.hasNextPage, true);
  const next = await api.getRmpReviews(localId, 'Example Teacher', null, first.endCursor);
  assert.equal(api.requests[3].variables.after, cursor);
  assert.equal(next.comments[0].wouldTakeAgain, true);
  assert.equal(next.hasNextPage, false);
  assert.equal(new Set([...first.comments, ...next.comments].map(c => c.id)).size, 3);
});

test('course filtering is performed upstream and does not guess course relationships', async () => {
  const course = { id: '000000000000000000000002', code: 'MKTG1021' };
  const api = provider([search([teacher()]), page([review()])]);
  const result = await api.getRmpReviews(localId, 'Example Teacher', course, null);
  assert.equal(api.requests[1].variables.course, 'MKTG1021');
  assert.equal(result.comments[0].courseId, course.id);
  const wrong = provider([search([teacher()]), page([review(1, { class: 'MKTG10210' })])]);
  await assert.rejects(wrong.getRmpReviews(localId, 'Example Teacher', course, null), error => error.code === 'wrong_course');
});

test('a verified nickname maps only to its local record and is checked against the live school and name', async () => {
  const api = provider([page([review()], false, null, teacher('Jeff Lucas', 2712447))]);
  const result = await api.getRmpReviews('65c42b4a49939741c67c7693', 'Jeffrey Lucas', null, null);
  assert.equal(result.profile.name, 'Jeff Lucas');
  assert.equal(api.requests.length, 1);
  const changed = provider([page([review()], false, null, teacher('Jeff Lucas', 2712447, 'other-school'))]);
  await assert.rejects(changed.getRmpReviews('65c42b4a49939741c67c7693', 'Jeffrey Lucas', null, null), e => e.code === 'identity_changed');
});

test('ambiguous and unmatched profiles never trigger a review request', async () => {
  for (const people of [[], [teacher(), teacher('Example Teacher', 124)]]) {
    const api = provider([search(people)]);
    const result = await api.getRmpReviews(localId, 'Example Teacher', null, null);
    assert.notEqual(result.status, 'matched');
    assert.equal(result.profile, null);
    assert.equal(api.requests.length, 1);
  }
});

test('upstream failure is distinct from zero reviews and invalid pagination never advances', async () => {
  const failed = provider([new Response('Unavailable', { status: 403 })]);
  await assert.rejects(failed.getRmpReviews(localId, 'Example Teacher', null, null), e => e.code === 'http_403');
  const graphql = provider([Response.json({ errors: [{ message: 'Fixture error' }] })]);
  await assert.rejects(graphql.getRmpReviews(localId, 'Example Teacher', null, null), e => e.code === 'graphql');
  const malformedSearch = provider([{}]);
  await assert.rejects(malformedSearch.getRmpReviews(localId, 'Example Teacher', null, null), e => e.code === 'invalid_search');
  const empty = provider([search([teacher()]), page([])]);
  assert.equal((await empty.getRmpReviews(localId, 'Example Teacher', null, null)).status, 'matched');
  for (const bad of [page([review()], true, null), page([], true, cursor), page([review(), review()]), page([review(1, { date: 'bad date' })])]) {
    const api = provider([search([teacher()]), bad]);
    await assert.rejects(api.getRmpReviews(localId, 'Example Teacher', null, null), e => e instanceof api.RmpUnavailableError);
  }
  const blank = provider([search([teacher()]), page([review(1, { comment: '' })], true, cursor)]);
  const result = await blank.getRmpReviews(localId, 'Example Teacher', null, null);
  assert.equal(result.comments.length, 0);
  assert.equal(result.hasNextPage, true);
});

test('RMP API validates input before reading the DB and contains provider failures', async () => {
  let reads = 0;
  let fail = false;
  const api = provider([]);
  const route = load('src/app/api/professors/[id]/rmp-reviews/route.ts', {
    'next/server': { NextResponse: Response },
    '@/data/queries': { async getReviewSelections() { reads++; return { course: null, professor: { id: localId, primary: 'Example Teacher' } }; } },
    '@/data/rmp': { ...api, async getRmpReviews() { if (fail) throw new api.RmpUnavailableError('http_403'); return { status: 'matched', comments: [] }; } },
  });
  const get = query => route.GET(new Request(`http://localhost/api/professors/${localId}/rmp-reviews${query}`), { params: Promise.resolve({ id: localId }) });
  for (const query of ['?after=invalid', '?course=invalid', `?after=${'x'.repeat(129)}`]) assert.equal((await get(query)).status, 400);
  assert.equal(reads, 0);
  assert.equal((await get('')).status, 200);
  fail = true;
  const response = await get('');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok((await response.json()).error.includes('temporarily unavailable'));
});
