import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

import { applyMigrations, importBatches } from './lib/database.mjs';
import { verifyDatabase } from './lib/database-verification.mjs';
import { loadAndValidateSnapshot, parseSnapshotArgument } from './lib/recovery-snapshot.mjs';
import { migrationJobs } from './migrate-recovered-data.mjs';

async function run() {
  const snapshotPath = parseSnapshotArgument(process.argv.slice(2));
  const snapshot = await loadAndValidateSnapshot(snapshotPath);
  const pg = await PGlite.create({ dataDir: 'memory://', extensions: { pg_trgm } });
  const sql = {
    query: async (text, parameters = []) => (await pg.query(text, parameters)).rows,
  };

  try {
    await applyMigrations(sql, path.join(process.cwd(), 'database', 'migrations'));
    await sql.query(
      `INSERT INTO migration_runs
         (snapshot_id, source_url, status, expected_counts, verification_manifest)
       VALUES ($1, $2, 'importing', $3::jsonb, $4::jsonb)`,
      [
        snapshot.snapshotId,
        snapshot.sourceUrl,
        JSON.stringify(snapshot.verification.recoveredCounts),
        JSON.stringify(snapshot.verification),
      ],
    );

    for (const [label, query, records] of migrationJobs(snapshot.records)) {
      await importBatches({ sql, query, records, snapshotId: snapshot.snapshotId, label });
    }

    const report = await verifyDatabase({
      sql,
      snapshotId: snapshot.snapshotId,
      verification: snapshot.verification,
    });
    const [summaryCounts] = await sql.query(`
      SELECT
        (SELECT count(*) FROM course_summaries)::text AS course_summaries,
        (SELECT count(*) FROM professor_summaries)::text AS professor_summaries
    `);
    const searchSmoke = await sql.query(
      `SELECT code, title FROM courses
       WHERE lower(code || ' ' || title || ' ' || subject) LIKE '%' || lower($1) || '%'
       ORDER BY similarity(lower(code || ' ' || title || ' ' || subject), lower($1)) DESC
       LIMIT 5`,
      ['portico'],
    );
    if (!searchSmoke.some((course) => course.title === 'Portico')) {
      throw new Error('Full migration search smoke test could not find Portico');
    }
    process.stdout.write(`${JSON.stringify({
      ...report,
      summaryCounts: Object.fromEntries(
        Object.entries(summaryCounts).map(([key, value]) => [key, Number(value)]),
      ),
      searchSmoke,
    }, null, 2)}\n`);
  } finally {
    await pg.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
