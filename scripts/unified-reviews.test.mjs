import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { applyMigrations } from './lib/database.mjs';
import { matchRecoveredProfessor, prepareRmpImport, RMP_BC_SCHOOL } from './lib/rmp-recovery.mjs';
import { publicationStatements, stageRmpImport } from './import-rmp-reviews.mjs';
import { browseReviews, reviewCourseKey, reviewProfessorHref } from '../src/data/review-browsing.ts';

const course = '000000000000000000000001';
const nativeProfessor = '000000000000000000000002';
const matchedProfessor = '000000000000000000000003';
const encode = value => Buffer.from(value).toString('base64');
const teacher = (id, firstName, lastName, numRatings = 0) => ({ id: encode(`Teacher-${id}`), legacyId: id,
  firstName, lastName, numRatings, department: 'Mathematics', school: { id: RMP_BC_SCHOOL } });
const sourceReview = (id, code, comment) => ({ id: encode(`Rating-${id}`), legacyId: id, class: code,
  comment, date: '2025-01-02 03:04:05 +0000 UTC', wouldTakeAgain: 'No', helpfulRating: 5, clarityRating: 5, difficultyRating: 3 });
const sourceSnapshots = [
  { teacher: teacher(123, 'Jane', 'Teacher', 0), pages: 1, complete: true, reportedRatingCount: 0,
    fetchedAt: '2026-10-14T00:00:00Z', reviews: [sourceReview(1, ' MATH 1004 ', 'Fixture experience for this course.'),
      sourceReview(2, 'UNKNOWN1234', 'Fixture experience with an unknown course.'), sourceReview(3, 'MATH1004', '')] },
  { teacher: teacher(124, 'Unlisted', 'Teacher', 1), pages: 1, complete: true, reportedRatingCount: 1,
    fetchedAt: '2026-10-14T00:00:00Z', reviews: [sourceReview(4, 'MATH1004', 'Fixture feedback from an unlinked professor.')] },
];

function snapshot(snapshots = sourceSnapshots, id = 'rmp-fixture') {
  return { snapshotId: id, sha256: 'fixture-digest', snapshots,
    manifest: { ratings: snapshots.reduce((n, p) => n + p.reviews.length, 0),
      writtenReviews: snapshots.flatMap(p => p.reviews).filter(r => r.comment.trim()).length } };
}

function loadTs(file, dependencies) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; } }, { filename: file });
  return compiled.exports;
}

test('one database collection preserves every recovered review, including zero-count and unlinked profiles', async t => {
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  t.after(() => pg.close());
  const lazy = (text, values = []) => ({ text, values, then(resolve, reject) { return pg.query(text, values).then(result => result.rows).then(resolve, reject); } });
  const sql = (strings, ...values) => lazy(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values);
  sql.query = lazy;
  await applyMigrations(sql, 'database/migrations');
  await pg.query(`INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest)
    VALUES('native','fixture','verified','{}','{}')`);
  await pg.query(`INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot)
    VALUES($1,'MATH1004','Finite Probability','Mathematics','Fixture','{}','native')`, [course]);
  await pg.query(`INSERT INTO professors(id,name,legacy_document,source_snapshot)
    VALUES($1,'Native Professor','{}','native'),($2,'Jane Teacher','{}','native')`, [nativeProfessor, matchedProfessor]);
  await pg.query(`INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,course_overall,instructor_overall,legacy_document,source_snapshot)
    VALUES('000000000000000000000004',$1,$2,'MATH1004','Native Professor','Fall 2025',4,3,'{}','native')`, [course, nativeProfessor]);
  await pg.query(`INSERT INTO student_comments(id,course_id,professor_id,message,would_take_again,source,created_at)
    VALUES('native-comment',$1,$2,'An untouched native comment.',true,'legacy_eagleeval','2024-01-01T00:00:00Z')`, [course, nativeProfessor]);
  const nativeBefore = (await pg.query('SELECT to_jsonb(sc) AS row FROM student_comments sc')).rows;
  const professors = [{ id: nativeProfessor, name: 'Native Professor' }, { id: matchedProfessor, name: 'Jane Teacher' }];
  const source = snapshot();
  const plan = prepareRmpImport(source, professors, [{ id: course, code: 'MATH1004' }]);
  assert.equal(plan.coverage.ratingRecords, 4);
  assert.equal(plan.coverage.writtenReviews, 3);
  assert.equal(plan.reviews[0].message, sourceSnapshots[0].reviews[0].comment);
  assert.equal(plan.reviews[0].course_code, ' MATH 1004 ');
  await stageRmpImport(sql, source, plan, 2);
  assert.equal((await pg.query('SELECT count(*)::integer AS n FROM public_written_reviews')).rows[0].n, 1, 'new records stay unpublished until verification');
  for (const [query, args] of publicationStatements(source.snapshotId)) await sql.query(query, args);
  const queries = loadTs('src/data/queries.ts', {
    'server-only': {}, react: { cache: fn => fn }, '@/data/public-cache': { publicQuery: (_key, fn) => fn },
    '@/data/database': { readDatabase: () => sql }, '@/data/catalog-search': loadTs('src/data/catalog-search.ts', {}),
    '@/data/format': loadTs('src/data/format.ts', {}),
  });
  const detail = await queries.getCourseDetail(course);
  assert.equal(detail.course.commentCount, 3);
  assert.equal(detail.comments.length, 3);
  assert.equal(new Set(detail.comments.map(c => c.id)).size, 3);
  assert.equal(detail.course.courseOverall, 4, 'external scores do not alter numerical evaluation averages');
  assert.equal(detail.instructors.find(p => p.id === matchedProfessor).reviewCount, 0);
  assert.equal((await queries.getProfessorDetail(matchedProfessor)).comments.length, 2);
  assert.equal((await queries.getCourseProfessors(course)).length, 2);
  assert.equal((await queries.getSiteStats()).comments, 4);
  const archive = await queries.getCommentsPage('', 1);
  assert.equal(archive.total, 4);
  const unlinked = archive.items.find(c => c.professorName === 'Unlisted Teacher');
  assert.equal(unlinked.professorId, 'rmp:124');
  assert.equal(unlinked.courseId, course);
  assert.equal(unlinked.sourceUrl, 'https://www.ratemyprofessors.com/professor/124');
  assert.equal(unlinked.wouldTakeAgain, false);
  assert.equal((await queries.getCommentsPage('Unlisted Teacher', 1)).total, 1);
  assert.equal((await queries.getCommentsPage('UNKNOWN1234', 1)).total, 1);
  assert.equal(reviewProfessorHref(unlinked), '/comments?q=Unlisted%20Teacher');
  const unknownCourse = archive.items.find(c => c.courseCode === 'UNKNOWN1234');
  assert.equal(reviewCourseKey(unknownCourse), 'code:UNKNOWN1234');
  assert.equal(browseReviews(archive.items, 'professor', 'code:UNKNOWN1234', 'newest').length, 1);
  await stageRmpImport(sql, source, plan, 2);
  for (const [query, args] of publicationStatements(source.snapshotId)) await sql.query(query, args);
  assert.equal((await queries.getCommentsPage('', 1)).total, 4, 'reruns cannot duplicate imported comments');
  assert.deepEqual((await pg.query('SELECT to_jsonb(sc) AS row FROM student_comments sc')).rows, nativeBefore);
  // A later complete source snapshot can withdraw an external row without
  // deleting its stored document or changing any native submission.
  const nextSource = snapshot(sourceSnapshots.map(p => ({ ...p, reviews: p.reviews.filter(r => r.id !== encode('Rating-4')) })), 'rmp-next');
  const nextPlan = prepareRmpImport(nextSource, professors, [{ id: course, code: 'MATH1004' }]);
  await stageRmpImport(sql, nextSource, nextPlan, 2);
  for (const [query, args] of publicationStatements(nextSource.snapshotId)) await sql.query(query, args);
  assert.equal((await queries.getCommentsPage('', 1)).total, 3);
  assert.equal((await pg.query('SELECT count(*)::integer AS n FROM external_reviews')).rows[0].n, 4);
  assert.deepEqual((await pg.query('SELECT to_jsonb(sc) AS row FROM student_comments sc')).rows, nativeBefore);
});

test('matching respects ambiguity and middle names while preserving verified aliases', () => {
  const p = teacher(10, 'Jane', 'Teacher');
  assert.equal(matchRecoveredProfessor(p, [{ id: 'a', name: 'Jane B. Teacher' }], [p]).professorId, 'a');
  assert.equal(matchRecoveredProfessor(p, [{ id: 'a', name: 'Jane Teacher' }, { id: 'b', name: 'Jane Teacher' }], [p]).professorId, null);
  assert.equal(matchRecoveredProfessor(teacher(11, 'Jane C.', 'Teacher'), [{ id: 'a', name: 'Jane B. Teacher' }], [teacher(11, 'Jane C.', 'Teacher')]).professorId, null);
  const alias = teacher(2712447, 'Jeff', 'Lucas');
  assert.equal(matchRecoveredProfessor(alias, [{ id: '65c42b4a49939741c67c7693', name: 'Jeffrey Lucas' }], [alias]).method, 'verified_alias');
});
