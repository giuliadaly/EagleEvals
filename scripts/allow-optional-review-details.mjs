import { readFile } from 'node:fs/promises';

import { connectDatabase } from './lib/database.mjs';
import { sqlStatements } from './lib/recovery-snapshot.mjs';

// One-time rollout command: apply only the approved optional-field migration.
// Keep database credentials inside the deployment environment.
const sql = connectDatabase();
const source = await readFile(new URL('../database/migrations/003_optional_review_details.sql', import.meta.url), 'utf8');
await sql.transaction([
  sql.query("SET LOCAL lock_timeout = '5s'"),
  ...sqlStatements(source).map(statement => sql.query(statement)),
]);

const columns = await sql.query(`
  SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND ((table_name = 'reviews' AND column_name IN ('section', 'section_code'))
      OR (table_name = 'student_comments' AND column_name = 'would_take_again'))
  ORDER BY table_name, column_name
`);
if (columns.length !== 3 || columns.some(column => column.is_nullable !== 'YES')) {
  throw new Error('Optional review column verification failed');
}
console.log('Verified optional review columns:', JSON.stringify(columns));
