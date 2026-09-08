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
import { normalizeCatalogQuery, catalogSearchSql } from '../src/data/catalog-search.ts';
import { browseReviews } from '../src/data/review-browsing.ts';
import { comparisonSelection } from '../src/data/comparison.ts';
import { validateReviewSubmission } from '../src/data/review-validation.ts';

function loadTs(file, dependencies) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, console, Request, Response,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; } }, { filename: file });
  return compiled.exports;
}

const course = '000000000000000000000001';
const otherCourse = '000000000000000000000002';
const professor = '000000000000000000000003';
const otherProfessor = '000000000000000000000004';

test('search and real submission queries preserve course context and old reviews', async t => {
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
  await pg.query(`INSERT INTO migration_runs (snapshot_id, source_url, status, expected_counts, verification_manifest)
    VALUES ('test', 'fixture', 'importing', '{}', '{}')`);
  await pg.query(`INSERT INTO courses (id, code, title, subject, description, legacy_document, source_snapshot) VALUES
    ($1, 'ENGL1010', 'First Year Writing Seminar', 'English', 'Fixture course', '{}', 'test'),
    ($2, 'ENGL2000', 'Literature', 'English', 'Fixture course', '{}', 'test')`, [course, otherCourse]);
  await pg.query(`INSERT INTO professors (id, name, legacy_document, source_snapshot) VALUES
    ($1, 'Brian Zimmerman', '{}', 'test'), ($2, 'Jane O’Neill', '{}', 'test')`, [professor, otherProfessor]);
  await pg.query(`INSERT INTO student_comments (id, course_id, professor_id, message, would_take_again, source)
    VALUES ('legacy', $1, $2, 'An existing review without a known semester.', false, 'legacy_eagleeval')`, [course, professor]);

  for (const input of ['ENGL1010', 'ENGL 1010', 'ENGL-1010', 'engl.1010', 'First Year Writng']) {
    const query = normalizeCatalogQuery(input);
    const results = await sql.query(catalogSearchSql('course'), [query, query.replace(/ /g, ''), 6]);
    assert.equal(results[0]?.id, course, input);
  }
  for (const input of ['Zimmerman', 'Zimerman', 'Brian Zimerman']) {
    const query = normalizeCatalogQuery(input);
    assert.equal((await sql.query(catalogSearchSql('professor'), [query, query.replace(/ /g, ''), 6]))[0]?.id, professor, input);
  }
  for (const input of ["O'Neill", 'O Neill', 'ONeill']) {
    const query = normalizeCatalogQuery(input);
    assert.equal((await sql.query(catalogSearchSql('professor'), [query, query.replace(/ /g, ''), 6]))[0]?.id, otherProfessor, input);
  }
  assert.equal((await sql.query(catalogSearchSql('course'), ['zzzzqqqq', 'zzzzqqqq', 6])).length, 0);

  const route = loadTs('src/app/api/reviews/route.ts', {
    'node:crypto': { createHash, randomBytes }, 'next/cache': { revalidatePath() {} },
    'next/server': { NextResponse: Response }, '@/data/database': { database: () => sql },
    '@/data/review-validation': { validateReviewSubmission },
  });
  const payload = { courseId: course, professorId: professor, semester: 'Fall 2001', courseOverall: 4,
    instructorOverall: 5, message: 'Clear lectures with useful written feedback on every assignment.', firsthandConfirmed: true, guidelinesAccepted: true };
  const submit = data => route.POST(new Request('http://localhost/api/reviews', { method: 'POST', body: JSON.stringify(data) }));
  const response = await submit(payload);
  assert.equal(response.status, 201);
  const published = await response.json();
  const linked = (await pg.query(`SELECT r.semester, r.section, sc.would_take_again FROM student_comments sc JOIN reviews r ON r.id = sc.review_id WHERE r.id = $1`, [published.reviewId])).rows;
  assert.equal(linked[0].semester, 'Fall 2001');
  assert.equal(linked[0].section, null);
  assert.equal(linked[0].would_take_again, null);
  assert.equal((await submit(payload)).status, 409);
  assert.equal((await pg.query('SELECT count(*) FROM student_comments')).rows[0].count, 2);
  assert.equal((await submit({ ...payload, semester: 'Fall 1999' })).status, 400);
  assert.equal((await submit({ ...payload, courseId: '000000000000000000000099' })).status, 404);

  // One professor's unrelated course must not affect this course's comparison.
  assert.equal((await submit({ ...payload, courseId: otherCourse, courseOverall: 1, instructorOverall: 1 })).status, 201);
  assert.equal((await submit({ ...payload, professorId: otherProfessor, semester: 'Spring 2025', instructorOverall: 3 })).status, 201);
  const queries = loadTs('src/data/queries.ts', {
    'server-only': {}, react: { cache: fn => fn }, '@/data/database': { database: () => sql },
    '@/data/catalog-search': loadTs('src/data/catalog-search.ts', {}),
    '@/data/format': loadTs('src/data/format.ts', {}),
  });
  const detail = await queries.getCourseDetail(course);
  const paired = detail.instructors.find(item => item.id === professor);
  assert.equal(paired.instructorOverall, 5);
  assert.equal(paired.reviewCount, 1);
  assert.equal(paired.latestSemester, 'Fall 2001');
  assert.equal(detail.comments.find(item => item.id === 'legacy').semester, null);
  assert.equal(detail.comments.find(item => item.professorId === otherProfessor).semester, 'Spring 2025');
  assert.equal((await queries.getCourseProfessors(course)).length, 2);
  assert.equal((await queries.getCoursesPage('ENGL 1010', 1)).items[0].id, course);
  assert.equal((await queries.getProfessorsPage('Zimerman', 1)).items[0].id, professor);
  assert.equal((await queries.getCommentsPage('', 1)).total, 4);
  assert.equal((await queries.getCatalogPaths()).length, 4);
  // Reapplying migrations preserves the old comment and the new semester link.
  await applyMigrations(sql, path.join(process.cwd(), 'database/migrations'));
  assert.equal((await pg.query("SELECT review_id FROM student_comments WHERE id = 'legacy'")).rows[0].review_id, null);
});

test('review filtering retains unknown terms and separates class recency from posting recency', () => {
  const comments = [
    { id: 'a', professorId: professor, courseId: course, semester: 'Fall 2001', createdAt: '2026-09-08' },
    { id: 'b', professorId: professor, courseId: course, semester: 'Spring 2025', createdAt: '2025-06-01' },
    { id: 'c', professorId: otherProfessor, courseId: null, semester: null, createdAt: '2026-09-09' },
  ];
  assert.deepEqual(browseReviews(comments, 'course', '', 'term').map(item => item.id), ['b', 'a', 'c']);
  assert.deepEqual(browseReviews(comments, 'course', professor, 'newest').map(item => item.id), ['a', 'b']);
  assert.deepEqual(browseReviews(comments, 'professor', course, 'oldest').map(item => item.id), ['b', 'a']);
  assert.deepEqual(browseReviews(comments, 'professor', 'general', 'newest').map(item => item.id), ['c']);
  assert.equal(comments.length, 3);
});

test('comparison accepts only two or three distinct eligible professors', () => {
  const eligible = ['a', 'b', 'c'];
  assert.deepEqual(comparisonSelection(['a', 'b', ''], eligible).ids, ['a', 'b']);
  assert.deepEqual(comparisonSelection(['a', 'b', 'c'], eligible).ids, eligible);
  for (const ids of [['a'], ['a', 'a'], ['a', 'outside'], ['a', 'b', 'c', 'd']]) assert.ok(comparisonSelection(ids, eligible).error);
});
