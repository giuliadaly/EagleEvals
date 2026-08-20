const tableCountQuery = `
  SELECT 'courses' AS name, count(*)::text AS count FROM courses WHERE source_snapshot = $1
  UNION ALL SELECT 'professors', count(*)::text FROM professors WHERE source_snapshot = $1
  UNION ALL SELECT 'reviews', count(*)::text FROM reviews WHERE source_snapshot = $1
  UNION ALL SELECT 'reviewMetrics', count(*)::text FROM review_metrics WHERE source_snapshot = $1
  UNION ALL SELECT 'comments', count(*)::text FROM student_comments WHERE source_snapshot = $1
  UNION ALL SELECT 'facultyDirectory', count(*)::text FROM faculty_directory_entries WHERE source_snapshot = $1
`;

const integrityQuery = `
  SELECT
    (SELECT count(*) FROM courses WHERE legacy_document->>'_id' IS DISTINCT FROM id)::text AS course_id_mismatches,
    (SELECT count(*) FROM professors WHERE legacy_document->>'_id' IS DISTINCT FROM id)::text AS professor_id_mismatches,
    (SELECT count(*) FROM reviews WHERE source_snapshot IS NOT NULL AND legacy_document->>'_id' IS DISTINCT FROM id)::text AS review_id_mismatches,
    (SELECT count(*) FROM review_metrics WHERE source_snapshot IS NOT NULL AND legacy_document->>'_id' IS DISTINCT FROM id)::text AS metric_id_mismatches,
    (SELECT count(*) FROM student_comments WHERE source = 'legacy_eagleeval' AND legacy_document->>'_id' IS DISTINCT FROM id)::text AS comment_id_mismatches,
    (SELECT count(*) FROM faculty_directory_entries WHERE source_document->>'profilePath' IS DISTINCT FROM profile_path)::text AS faculty_path_mismatches,
    (SELECT count(*) FROM student_comments WHERE legacy_document ? 'user_id')::text AS comments_containing_user_id,
    (SELECT count(*) FROM reviews WHERE course_overall NOT BETWEEN 1 AND 5 OR instructor_overall NOT BETWEEN 1 AND 5)::text AS invalid_review_ratings,
    (SELECT count(*) FROM review_metrics WHERE
      attendance_necessary NOT BETWEEN 1 AND 5 OR
      available_for_help_outside_class NOT BETWEEN 1 AND 5 OR
      course_intellectually_challenging NOT BETWEEN 1 AND 5 OR
      course_well_organized NOT BETWEEN 1 AND 5 OR
      instructor_clear_explanations NOT BETWEEN 1 AND 5 OR
      instructor_prepared NOT BETWEEN 1 AND 5 OR
      stimulated_interest NOT BETWEEN 1 AND 5 OR
      assignments_helpful NOT BETWEEN 1 AND 5 OR
      effort_average_hours_weekly NOT BETWEEN 1 AND 5
    )::text AS invalid_metric_ratings
`;

export function expectedDatabaseCounts(verification) {
  return {
    courses: verification.recoveredCounts.courses,
    professors: verification.recoveredCounts.professors,
    reviews: verification.recoveredCounts.reviews,
    reviewMetrics: verification.recoveredCounts.drilldowns,
    comments: verification.recoveredCounts.comments,
    facultyDirectory: verification.recoveredCounts.currentFacultyDirectory,
  };
}

export async function verifyDatabase({ sql, snapshotId, verification }) {
  const expected = expectedDatabaseCounts(verification);
  const countRows = await sql.query(tableCountQuery, [snapshotId]);
  const counts = Object.fromEntries(countRows.map((row) => [row.name, Number(row.count)]));
  const [integrityRow] = await sql.query(integrityQuery);
  const integrity = Object.fromEntries(
    Object.entries(integrityRow).map(([key, value]) => [key, Number(value)]),
  );

  const countDifferences = Object.fromEntries(
    Object.entries(expected)
      .filter(([name, expectedCount]) => counts[name] !== expectedCount)
      .map(([name, expectedCount]) => [name, { expected: expectedCount, actual: counts[name] ?? 0 }]),
  );
  const integrityFailures = Object.fromEntries(
    Object.entries(integrity).filter(([, count]) => count !== 0),
  );

  const report = {
    verifiedAt: new Date().toISOString(),
    snapshotId,
    expected,
    counts,
    countDifferences,
    integrity,
    passed: Object.keys(countDifferences).length === 0 && Object.keys(integrityFailures).length === 0,
  };

  if (!report.passed) {
    throw new Error(`Database verification failed: ${JSON.stringify({ countDifferences, integrityFailures })}`);
  }
  return report;
}
