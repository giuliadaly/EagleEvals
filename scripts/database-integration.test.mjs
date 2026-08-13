import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

import { applySchema, importBatches } from './lib/database.mjs';
import { verifyDatabase } from './lib/database-verification.mjs';
import { sqlStatements } from './lib/recovery-snapshot.mjs';
import {
  commentQuery,
  courseQuery,
  facultyQuery,
  metricQuery,
  professorQuery,
  reviewQuery,
} from './migrate-recovered-data.mjs';

const snapshotId = '2026-08-13-test';
const ids = {
  course: '65c4299149939741c6777c1d',
  professor: '65c42b4949939741c67c70da',
  review: '65c42c5949939741c67fa226',
  metric: '65c430be49939741c68d51f3',
  comment: '69fbec15e3a0f04a164d45f0',
};

const fixture = {
  courses: [{
    _id: ids.course,
    code: 'TEST1001',
    title: 'Test Course',
    subject: 'Testing',
    college: 'MCAS',
    description: 'Fixture course',
  }],
  professors: [{
    _id: ids.professor,
    name: 'Test Professor',
    title: ['Professor of Testing'],
    education: ['Ph.D., Test University'],
    email: 'professor@bc.edu',
    photoLink: 'https://example.com/photo.jpg',
  }],
  reviews: [{
    _id: ids.review,
    code: 'TEST100101',
    prof: 'Test Professor',
    semester: 'Fall 2025',
    course_id: ids.course,
    professor_id: ids.professor,
    section: 1,
    course_overall: 4.5,
    instructor_overall: 4.75,
  }],
  reviewMetrics: [{
    _id: ids.metric,
    review_id: ids.review,
    attendancenecessary: 4,
    coursewellorganized: 5,
  }],
  comments: [{
    _id: ids.comment,
    message: 'Helpful fixture comment',
    wouldTakeAgain: true,
    professor_id: ids.professor,
    course_id: ids.course,
    createdAt: '2026-01-01T00:00:00.000Z',
  }],
  facultyDirectory: [{
    source: 'Boston College public faculty directory',
    sourceSchool: 'csom',
    name: 'Current Professor',
    firstName: 'Current',
    lastName: 'Professor',
    title: 'Professor',
    email: 'current@bc.edu',
    profilePath: '/faculty/current-professor.html',
    profileUrl: 'https://www.bc.edu/faculty/current-professor.html',
  }],
};

const verification = {
  recoveredCounts: {
    courses: 1,
    professors: 1,
    reviews: 1,
    drilldowns: 1,
    comments: 1,
    currentFacultyDirectory: 1,
  },
};

test('executes the schema, importer, views, and verifier against Postgres', async (t) => {
  const pg = await PGlite.create({
    dataDir: 'memory://',
    extensions: { pg_trgm },
  });
  t.after(() => pg.close());
  const sql = {
    query: async (text, parameters = []) => (await pg.query(text, parameters)).rows,
  };

  const schema = await readFile(
    new URL('../database/migrations/001_initial.sql', import.meta.url),
    'utf8',
  );
  await applySchema(sql, sqlStatements(schema));
  await sql.query(
    `INSERT INTO migration_runs
       (snapshot_id, source_url, status, expected_counts, verification_manifest)
     VALUES ($1, $2, 'importing', $3::jsonb, $4::jsonb)`,
    [snapshotId, 'https://eagleeval.com', JSON.stringify(verification.recoveredCounts), JSON.stringify(verification)],
  );

  const jobs = [
    ['Courses', courseQuery, fixture.courses],
    ['Professors', professorQuery, fixture.professors],
    ['Reviews', reviewQuery, fixture.reviews],
    ['Review metrics', metricQuery, fixture.reviewMetrics],
    ['Student comments', commentQuery, fixture.comments],
    ['Current faculty directory', facultyQuery, fixture.facultyDirectory],
  ];

  for (const [label, query, records] of jobs) {
    await importBatches({ sql, query, records, snapshotId, label });
  }
  for (const [label, query, records] of jobs) {
    await importBatches({ sql, query, records, snapshotId, label: `${label} rerun` });
  }

  const report = await verifyDatabase({ sql, snapshotId, verification });
  assert.equal(report.passed, true);
  assert.deepEqual(report.counts, {
    courses: 1,
    professors: 1,
    reviews: 1,
    reviewMetrics: 1,
    comments: 1,
    facultyDirectory: 1,
  });

  const [courseSummary] = await sql.query('SELECT * FROM course_summaries WHERE id = $1', [ids.course]);
  assert.equal(courseSummary.review_count, 1);
  assert.equal(Number(courseSummary.course_overall), 4.5);
  assert.equal(courseSummary.comment_count, 1);

  const [professorSummary] = await sql.query('SELECT * FROM professor_summaries WHERE id = $1', [ids.professor]);
  assert.equal(professorSummary.review_count, 1);
  assert.equal(Number(professorSummary.instructor_overall), 4.75);
  assert.equal(professorSummary.comment_count, 1);

  const searchResults = await sql.query(
    `SELECT code FROM courses
     WHERE lower(code || ' ' || title || ' ' || subject) LIKE '%' || lower($1) || '%'`,
    ['test course'],
  );
  assert.deepEqual(searchResults, [{ code: 'TEST1001' }]);
});
