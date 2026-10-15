import { pathToFileURL } from 'node:url';
import { connectDatabase, databaseUrl } from './lib/database.mjs';
import { loadRmpSnapshot, prepareRmpImport, UPSERT_PROFILES, UPSERT_REVIEWS } from './lib/rmp-recovery.mjs';
import {recoveryDiff,assertRecoveryCoverage,prepareHistoricalCourses} from './lib/review-associations.mjs';

export async function prepareDatabaseImport(sql,snapshot) {
  const [professors,courses,relationships,existingProfiles,existingReviews]=await Promise.all([
    sql.query('SELECT id,name,titles,phone,catalog_source FROM professors'),
    sql.query('SELECT id,code,title,catalog_source FROM courses'),
    sql.query('SELECT DISTINCT professor_id,course_id FROM public_rating_records WHERE published AND professor_id IS NOT NULL AND course_id IS NOT NULL'),
    sql.query('SELECT source_teacher_id,professor_id,fetched_at FROM external_review_profiles'),
    sql.query('SELECT source_review_id,course_id,published FROM external_reviews'),
  ]);
  const catalogCourses=prepareHistoricalCourses(courses);
  const combinedCourses=[...courses.filter(c=>!catalogCourses.some(a=>a.id===c.id)),...catalogCourses];
  const plan=prepareRmpImport(snapshot,professors,combinedCourses,{catalogProfiles:true,relationships});
  plan.catalogCourses=catalogCourses;
  return {plan,diff:recoveryDiff(plan,existingProfiles,existingReviews)};
}

export async function stageRmpImport(sql, snapshot, plan, batchSize = 200) {
  await sql.query(`INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest)
    VALUES($1,'https://www.ratemyprofessors.com/search/professors/122','importing',$2::jsonb,$3::jsonb)
    ON CONFLICT(snapshot_id) DO UPDATE SET status='importing',expected_counts=EXCLUDED.expected_counts,
      verification_manifest=EXCLUDED.verification_manifest,updated_at=now()`,
  [snapshot.snapshotId, JSON.stringify(plan.coverage), JSON.stringify({ sha256: snapshot.sha256, completeSchoolInventory: true })]);
  for (const course of plan.catalogCourses ?? []) {
    await sql.query(`INSERT INTO courses(id,code,title,subject,college,description,legacy_document,source_snapshot,catalog_source,catalog_evidence)
      VALUES($1,$2,$3,$4,$5,$6,'{}',$7,'historical_archive',$8::jsonb)
      ON CONFLICT(id) DO UPDATE SET catalog_evidence=EXCLUDED.catalog_evidence
      WHERE courses.catalog_source='historical_archive' AND courses.code=EXCLUDED.code`,
    [course.id,course.code,course.title,course.subject,course.college,course.description,snapshot.snapshotId,JSON.stringify(course.catalog_evidence)]);
  }
  const catalogProfiles=plan.catalogProfiles ?? [];
  for (let start=0;start<catalogProfiles.length;start+=batchSize) {
    await sql.query(`INSERT INTO professors(id,name,titles,legacy_document,source_snapshot,catalog_source)
      SELECT id,name,titles,'{}',$2,'external_rmp'
      FROM jsonb_to_recordset($1::jsonb) AS x(id text,name text,titles text[])
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,titles=EXCLUDED.titles,source_snapshot=EXCLUDED.source_snapshot
      WHERE professors.catalog_source='external_rmp'`,[JSON.stringify(catalogProfiles.slice(start,start+batchSize)),snapshot.snapshotId]);
  }
  for (const alias of plan.nativeAliases ?? []) {
    await sql.query(`INSERT INTO professor_aliases(alias_id,canonical_id,evidence) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(alias_id) DO UPDATE SET canonical_id=EXCLUDED.canonical_id,evidence=EXCLUDED.evidence`,[alias.aliasId,alias.canonicalId,JSON.stringify(alias)]);
  }
  for (const [label, rows, query] of [['profiles', plan.profiles, UPSERT_PROFILES], ['reviews', plan.reviews, UPSERT_REVIEWS]]) {
    for (let start = 0; start < rows.length; start += batchSize) {
      await sql.query(query, [JSON.stringify(rows.slice(start, start + batchSize)), snapshot.snapshotId]);
    }
    console.log(JSON.stringify({ staged: label, records: rows.length }));
  }
  await sql.query(`UPDATE professors p SET search_names=ARRAY(SELECT DISTINCT n FROM unnest(p.search_names || x.names) n ORDER BY n)
    FROM (SELECT professor_id,array_agg(DISTINCT display_name) AS names FROM external_review_profiles
      WHERE professor_id IS NOT NULL GROUP BY professor_id) x WHERE x.professor_id=p.id`);
  const [check] = await sql.query(`SELECT count(*)::integer AS ratings,
    count(*) FILTER(WHERE length(btrim(message))>0)::integer AS written,
    count(*) FILTER(WHERE source_review_id IS DISTINCT FROM source_document->>'id'
      OR message IS DISTINCT FROM source_document->>'comment'
      OR course_code IS DISTINCT FROM source_document->>'class'
      OR would_take_again IS DISTINCT FROM CASE source_document->>'wouldTakeAgain' WHEN 'Yes' THEN true WHEN 'No' THEN false ELSE NULL END
      OR created_at IS DISTINCT FROM replace(source_document->>'date',' UTC','')::timestamptz)::integer AS mismatches
    FROM external_reviews WHERE source_snapshot=$1`, [snapshot.snapshotId]);
  if (check.ratings !== plan.coverage.ratingRecords || check.written !== plan.coverage.writtenReviews || check.mismatches !== 0) {
    throw new Error('Staged source content verification failed; new records remain unpublished');
  }
  return check;
}

export function publicationStatements(snapshotId) {
  // Called only after every BC profile was fetched and every staged row verified.
  // Absent external rows are retained privately, with publication disabled.
  return [
    [`UPDATE external_reviews SET published=(source_snapshot=$1)`, [snapshotId]],
    [`UPDATE migration_runs SET status='verified',completed_at=now(),updated_at=now() WHERE snapshot_id=$1`, [snapshotId]],
    [`SELECT count(*)::integer AS written FROM public_written_reviews WHERE source='ratemyprofessors'`, []],
  ];
}

async function run() {
  const args = process.argv.slice(2);
  const value = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  const root = value('--snapshot');
  if (!root) throw new Error('--snapshot is required');
  const snapshot = await loadRmpSnapshot(root);
  const sql = connectDatabase();
  const {plan,diff} = await prepareDatabaseImport(sql,snapshot);
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ dryRun: true, sha256: snapshot.sha256, coverage: plan.coverage, diff }, null, 2));
    return;
  }
  if (value('--expect-sha256') !== snapshot.sha256 || value('--expected-host') !== new URL(databaseUrl()).hostname) {
    throw new Error('Explicit verified snapshot digest and expected database host are required');
  }
  assertRecoveryCoverage(diff,snapshot.sha256,value('--approve-coverage-change-sha256'));
  await stageRmpImport(sql, snapshot, plan);
  const results = await sql.transaction(publicationStatements(snapshot.snapshotId).map(([query, parameters]) => sql.query(query, parameters)));
  if (results[2][0].written !== plan.coverage.writtenReviews) throw new Error('Published written-review count mismatch');
  console.log(JSON.stringify({ published: true, snapshotId: snapshot.snapshotId, sha256: snapshot.sha256, coverage: plan.coverage }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error(JSON.stringify({ failed: true, type: error.name, code: error.code ?? null }));
    process.exitCode = 1;
  });
}
