import 'server-only';

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { withReadRetry, type ReadOperation } from '@/data/read-retry';

let client: NeonQueryFunction<false, false> | undefined;

export function database(): NeonQueryFunction<false, false> {
  if (client) return client;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  client = neon(databaseUrl);
  return client;
}

// Public SELECT queries opt in here; database() keeps writes single-attempt.
// Deliberately expose neither transaction() nor unsafe() on the read helper.
export function readDatabase(operation: ReadOperation) {
  const sql = database();
  let query = 0;
  function read(strings: TemplateStringsArray, ...values: unknown[]) {
    return withReadRetry(operation, ++query, () => sql(strings, ...values));
  }
  read.query = (text: string, values: unknown[] = []) =>
    withReadRetry(operation, ++query, () => sql.query(text, values));
  return read;
}
