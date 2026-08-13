import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { applySchema, connectDatabase, importBatches } from './lib/database.mjs';
import { verifyDatabase } from './lib/database-verification.mjs';
import {
  loadAndValidateSnapshot,
  parseSnapshotArgument,
  sqlStatements,
} from './lib/recovery-snapshot.mjs';

const courseQuery = `
  INSERT INTO courses (id, code, title, subject, college, description, legacy_document, source_snapshot, imported_at)
  SELECT
    document->>'_id', document->>'code', document->>'title', document->>'subject',
    document->>'college', document->>'description', document, $2, now()
  FROM jsonb_array_elements($1::jsonb) AS source(document)
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code, title = EXCLUDED.title, subject = EXCLUDED.subject,
    college = EXCLUDED.college, description = EXCLUDED.description,
    legacy_document = EXCLUDED.legacy_document, source_snapshot = EXCLUDED.source_snapshot,
    imported_at = now()
`;

const professorQuery = `
  INSERT INTO professors (
    id, name, titles, education, phone, email, office, photo_url,
    legacy_document, source_snapshot, imported_at
  )
  SELECT
    document->>'_id', document->>'name',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(document->'title', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(document->'education', '[]'::jsonb))),
    document->>'phone', document->>'email', document->>'office', document->>'photoLink',
    document, $2, now()
  FROM jsonb_array_elements($1::jsonb) AS source(document)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, titles = EXCLUDED.titles, education = EXCLUDED.education,
    phone = EXCLUDED.phone, email = EXCLUDED.email, office = EXCLUDED.office,
    photo_url = EXCLUDED.photo_url, legacy_document = EXCLUDED.legacy_document,
    source_snapshot = EXCLUDED.source_snapshot, imported_at = now()
`;

const reviewQuery = `
  INSERT INTO reviews (
    id, course_id, professor_id, section_code, course_code, professor_name,
    semester, section, course_overall, instructor_overall,
    legacy_document, source_snapshot, imported_at
  )
  SELECT
    document->>'_id', NULLIF(document->>'course_id', ''), NULLIF(document->>'professor_id', ''),
    document->>'code', left(document->>'code', -2), document->>'prof', document->>'semester',
    (document->>'section')::integer, NULLIF(document->>'course_overall', '')::numeric,
    NULLIF(document->>'instructor_overall', '')::numeric, document, $2, now()
  FROM jsonb_array_elements($1::jsonb) AS source(document)
  ON CONFLICT (id) DO UPDATE SET
    course_id = EXCLUDED.course_id, professor_id = EXCLUDED.professor_id,
    section_code = EXCLUDED.section_code, course_code = EXCLUDED.course_code,
    professor_name = EXCLUDED.professor_name, semester = EXCLUDED.semester,
    section = EXCLUDED.section, course_overall = EXCLUDED.course_overall,
    instructor_overall = EXCLUDED.instructor_overall,
    legacy_document = EXCLUDED.legacy_document, source_snapshot = EXCLUDED.source_snapshot,
    imported_at = now()
`;

const metricQuery = `
  INSERT INTO review_metrics (
    id, review_id, attendance_necessary, available_for_help_outside_class,
    course_intellectually_challenging, course_well_organized,
    instructor_clear_explanations, instructor_prepared, stimulated_interest,
    assignments_helpful, effort_average_hours_weekly,
    legacy_document, source_snapshot, imported_at
  )
  SELECT
    document->>'_id', document->>'review_id',
    NULLIF(document->>'attendancenecessary', '')::numeric,
    NULLIF(document->>'availableforhelpoutsideofclass', '')::numeric,
    NULLIF(document->>'courseintellectuallychallenging', '')::numeric,
    NULLIF(document->>'coursewellorganized', '')::numeric,
    NULLIF(document->>'instructorclearexplanations', '')::numeric,
    NULLIF(document->>'instructorprepared', '')::numeric,
    NULLIF(document->>'stimulatedinterestinthesubjectmatter', '')::numeric,
    NULLIF(document->>'assignmentshelpful', '')::numeric,
    NULLIF(document->>'effortavghoursweekly', '')::numeric,
    document, $2, now()
  FROM jsonb_array_elements($1::jsonb) AS source(document)
  ON CONFLICT (id) DO UPDATE SET
    review_id = EXCLUDED.review_id, attendance_necessary = EXCLUDED.attendance_necessary,
    available_for_help_outside_class = EXCLUDED.available_for_help_outside_class,
    course_intellectually_challenging = EXCLUDED.course_intellectually_challenging,
    course_well_organized = EXCLUDED.course_well_organized,
    instructor_clear_explanations = EXCLUDED.instructor_clear_explanations,
    instructor_prepared = EXCLUDED.instructor_prepared,
    stimulated_interest = EXCLUDED.stimulated_interest,
    assignments_helpful = EXCLUDED.assignments_helpful,
    effort_average_hours_weekly = EXCLUDED.effort_average_hours_weekly,
    legacy_document = EXCLUDED.legacy_document, source_snapshot = EXCLUDED.source_snapshot,
    imported_at = now()
`;

const commentQuery = `
  INSERT INTO student_comments (
    id, professor_id, course_id, message, would_take_again, source, published,
    created_at, legacy_document, source_snapshot, imported_at
  )
  SELECT
    document->>'_id', document->>'professor_id', NULLIF(document->>'course_id', ''),
    document->>'message', (document->>'wouldTakeAgain')::boolean,
    'legacy_eagleeval', true, (document->>'createdAt')::timestamptz, document, $2, now()
  FROM jsonb_array_elements($1::jsonb) AS source(document)
  ON CONFLICT (id) DO UPDATE SET
    professor_id = EXCLUDED.professor_id, course_id = EXCLUDED.course_id,
    message = EXCLUDED.message, would_take_again = EXCLUDED.would_take_again,
    source = EXCLUDED.source, published = EXCLUDED.published,
    created_at = EXCLUDED.created_at, legacy_document = EXCLUDED.legacy_document,
    source_snapshot = EXCLUDED.source_snapshot, imported_at = now()
`;

const facultyQuery = `
  INSERT INTO faculty_directory_entries (
    profile_path, source_school, name, first_name, last_name, title, department,
    phone, email, office, profile_url, source_name, source_document,
    source_snapshot, imported_at
  )
  SELECT
    document->>'profilePath', document->>'sourceSchool', document->>'name',
    document->>'firstName', document->>'lastName', document->>'title',
    document->>'department', document->>'phone', document->>'email', document->>'office',
    document->>'profileUrl', document->>'source', document, $2, now()
  FROM jsonb_array_elements($1::jsonb) AS source(document)
  ON CONFLICT (profile_path) DO UPDATE SET
    source_school = EXCLUDED.source_school, name = EXCLUDED.name,
    first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    title = EXCLUDED.title, department = EXCLUDED.department, phone = EXCLUDED.phone,
    email = EXCLUDED.email, office = EXCLUDED.office, profile_url = EXCLUDED.profile_url,
    source_name = EXCLUDED.source_name, source_document = EXCLUDED.source_document,
    source_snapshot = EXCLUDED.source_snapshot, imported_at = now()
`;

async function atomicWriteJson(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

async function updateLocalMigrationState(snapshot, report) {
  const reportPath = path.join(snapshot.snapshotPath, 'manifests', 'database-verification.json');
  const inventoryPath = path.join(snapshot.snapshotPath, 'manifests', 'migration-inventory.json');
  await atomicWriteJson(reportPath, report);
  await atomicWriteJson(inventoryPath, {
    ...snapshot.inventory,
    databaseMigrationStatus: 'verified',
    databaseMigrationVerifiedAt: report.verifiedAt,
    localDeletionStatus: 'blocked',
  });
}

async function run() {
  const snapshotPath = parseSnapshotArgument(process.argv.slice(2));
  process.stdout.write('Validating recovery snapshot checksums and relationships...\n');
  const snapshot = await loadAndValidateSnapshot(snapshotPath);
  const sql = connectDatabase();
  const schemaPath = path.join(process.cwd(), 'database', 'migrations', '001_initial.sql');
  const schemaSource = await readFile(schemaPath, 'utf8');
  await applySchema(sql, sqlStatements(schemaSource));

  await sql.query(
    `INSERT INTO migration_runs (
       snapshot_id, source_url, status, expected_counts, verification_manifest,
       started_at, completed_at, updated_at
     ) VALUES ($1, $2, 'importing', $3::jsonb, $4::jsonb, now(), NULL, now())
     ON CONFLICT (snapshot_id) DO UPDATE SET
       source_url = EXCLUDED.source_url, status = 'importing',
       expected_counts = EXCLUDED.expected_counts,
       verification_manifest = EXCLUDED.verification_manifest,
       started_at = now(), completed_at = NULL, updated_at = now()`,
    [
      snapshot.snapshotId,
      snapshot.sourceUrl,
      JSON.stringify(snapshot.verification.recoveredCounts),
      JSON.stringify(snapshot.verification),
    ],
  );

  try {
    const jobs = [
      ['Courses', courseQuery, snapshot.records.courses],
      ['Professors', professorQuery, snapshot.records.professors],
      ['Reviews', reviewQuery, snapshot.records.reviews],
      ['Review metrics', metricQuery, snapshot.records.reviewMetrics],
      ['Student comments', commentQuery, snapshot.records.comments],
      ['Current faculty directory', facultyQuery, snapshot.records.facultyDirectory],
    ];
    for (const [label, query, records] of jobs) {
      await importBatches({ sql, query, records, snapshotId: snapshot.snapshotId, label });
    }

    const report = await verifyDatabase({
      sql,
      snapshotId: snapshot.snapshotId,
      verification: snapshot.verification,
    });
    await sql.query(
      `UPDATE migration_runs
       SET status = 'verified', completed_at = now(), updated_at = now()
       WHERE snapshot_id = $1`,
      [snapshot.snapshotId],
    );
    await updateLocalMigrationState(snapshot, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    await sql.query(
      `UPDATE migration_runs SET status = 'failed', updated_at = now() WHERE snapshot_id = $1`,
      [snapshot.snapshotId],
    );
    throw error;
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
