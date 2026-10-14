import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connectDatabase, databaseUrl } from './lib/database.mjs';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const resolveId = option('--resolve');
const dismissId = option('--dismiss');
const selectedId = resolveId ?? dismissId;

try {
  const sql = connectDatabase();
  if (selectedId) {
    if (resolveId && dismissId || !/^[0-9a-f]{24}$/.test(selectedId)) throw new Error('Choose one valid report ID.');
    const expectedHost = option('--expected-host');
    if (!expectedHost || new URL(databaseUrl()).hostname !== expectedHost) throw new Error('Pass the verified database hostname with --expected-host before changing report status.');
    const status = resolveId ? 'resolved' : 'dismissed';
    const result = await sql`UPDATE anonymous_reports SET status = ${status}, resolved_at = now()
      WHERE id = ${selectedId} AND status = 'open' RETURNING id, status`;
    console.log(JSON.stringify({ changed: result.length, status }));
  } else {
    const rows = await sql`SELECT ar.id, ar.target_kind, ar.target_id, ar.reason, ar.message, ar.created_at,
        wr.message AS reported_review, COALESCE(wr.professor_name, p.name) AS professor_name,
        COALESCE(wr.course_code, c.code) AS course_code
      FROM anonymous_reports ar
      LEFT JOIN public_written_reviews wr ON ar.target_kind = 'review' AND wr.id = ar.target_id
      LEFT JOIN professors p ON ar.target_kind = 'professor' AND p.id = ar.target_id
      LEFT JOIN courses c ON ar.target_kind = 'course' AND c.id = ar.target_id
      WHERE ar.status = 'open' ORDER BY ar.created_at, ar.id LIMIT 100`;
    const folder = await mkdtemp(path.join(tmpdir(), 'eagleevals-private-reports-'));
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const file = path.join(folder, 'open-reports.json');
    await writeFile(file, JSON.stringify({ exportedAt: new Date().toISOString(), reports: rows }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ reports: rows.length, privateFile: file,
      note: rows.length === 100 ? 'Showing the oldest 100 open reports. Process these, then export again.' : 'No report content was printed to terminal logs.' }));
  }
} catch (error) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'configuration-or-connection';
  console.error(JSON.stringify({ operation: selectedId ? 'update-report-status' : 'export-report-queue', outcome: 'failed', code }));
  process.exitCode = 1;
}
