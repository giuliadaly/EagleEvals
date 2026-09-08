import { readFile } from 'node:fs/promises';
import { connectDatabase } from './lib/database.mjs';
import { sqlStatements } from './lib/recovery-snapshot.mjs';

// One-time additive rollout, with credentials kept in Vercel's environment.
const sql = connectDatabase();
const source = await readFile(new URL('../database/migrations/004_comment_review_context.sql', import.meta.url), 'utf8');
await sql.transaction([
  sql.query("SET LOCAL lock_timeout = '5s'"),
  ...sqlStatements(source).map(statement => sql.query(statement)),
]);
const columns = await sql.query(`SELECT is_nullable FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'student_comments' AND column_name = 'review_id'`);
if (columns.length !== 1 || columns[0].is_nullable !== 'YES') throw new Error('Review context migration verification failed');
console.log('Verified nullable written-review link. Existing comments preserved.');
