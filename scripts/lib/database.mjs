import { neon } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { sqlStatements } from './recovery-snapshot.mjs';

export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required');

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
  }
  return value;
}

export function connectDatabase() {
  return neon(databaseUrl());
}

export async function applySchema(sql, statements) {
  for (const [index, statement] of statements.entries()) {
    try {
      await sql.query(statement);
    } catch (error) {
      throw new Error(`Database schema statement ${index + 1} failed: ${error.message}`, { cause: error });
    }
  }
}

export async function applyMigrations(sql, migrationsPath) {
  const files = (await readdir(migrationsPath))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  for (const file of files) {
    const source = await readFile(path.join(migrationsPath, file), 'utf8');
    await applySchema(sql, sqlStatements(source));
  }
  return files;
}

export async function importBatches({ sql, query, records, snapshotId, label, batchSize = 250 }) {
  let imported = 0;
  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    await sql.query(query, [JSON.stringify(batch), snapshotId]);
    imported += batch.length;
    process.stdout.write(`\r${label}: ${imported}/${records.length}`);
  }
  process.stdout.write('\n');
}
