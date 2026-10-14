import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { applyMigrations } from './database.mjs';
import { prepareDatabaseImport, publicationStatements, stageRmpImport } from '../import-rmp-reviews.mjs';
import { assertRecoveryCoverage } from './review-associations.mjs';

const repository = fileURLToPath(new URL('../..', import.meta.url));
const format = 'eagleevals-private-database-backup-v1';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const identifier = value => {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('Unexpected database identifier in backup');
  return `"${value}"`;
};
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const rowStrings = rows => rows.map(row => JSON.stringify(canonical(row))).sort();
const rowDigest = rows => sha256(JSON.stringify(rowStrings(rows)));

export function maintenanceDatabaseUrl(value) {
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('A Postgres connection is required');
  if (parsed.hostname.endsWith('.neon.tech') && parsed.hostname.startsWith('ep-')) {
    parsed.hostname = parsed.hostname.replace(/-pooler(?=\.)/, '');
  }
  return parsed.toString();
}

export function connectReviewMaintenanceDatabase(connectionString, { PoolConstructor = Pool } = {}) {
  if (typeof globalThis.WebSocket !== 'function') throw new Error('Manual database maintenance requires Node with native WebSocket support');
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  neonConfig.poolQueryViaFetch = false;
  const pool = new PoolConstructor({ connectionString: maintenanceDatabaseUrl(connectionString),
    max: 1, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 5_000,
    statement_timeout: 120_000, query_timeout: 150_000,
    idle_in_transaction_session_timeout: 180_000, allowExitOnIdle: true,
    application_name: 'eagleevals-manual-review-maintenance' });
  // Pending queries still reject; idle socket errors must not dump credentials.
  pool.on('error', () => {});
  const query = (text, values = []) => ({ text, values,
    then(resolve, reject) { return pool.query(text, values).then(result => result.rows).then(resolve, reject); } });
  const sql = { query, async transaction(queries, options = {}) {
    const levels = { ReadCommitted: 'READ COMMITTED', RepeatableRead: 'REPEATABLE READ', Serializable: 'SERIALIZABLE' };
    if (options.isolationLevel && !levels[options.isolationLevel]) throw new Error('Unsupported maintenance transaction isolation');
    const begin = `BEGIN${options.isolationLevel ? ` ISOLATION LEVEL ${levels[options.isolationLevel]}` : ''}${options.readOnly ? ' READ ONLY' : ''}`;
    const client = await pool.connect();
    let failed = false;
    try {
      await client.query(begin);
      const results = [];
      for (const statement of queries) results.push((await client.query(statement.text, statement.values)).rows);
      await client.query('COMMIT');
      return results;
    } catch (error) {
      failed = true;
      try { await client.query('ROLLBACK'); } catch { /* Discard this connection; never retry the transaction. */ }
      throw error;
    } finally { client.release(failed); }
  } };
  return { sql, close: () => pool.end() };
}

export async function assertPrivateLocation(location) {
  const requested = path.resolve(location);
  let parent = requested;
  while (true) {
    try { parent = await realpath(parent); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const next = path.dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
  const repo = await realpath(repository);
  for (const candidate of [requested, parent]) {
    const relative = path.relative(repo, candidate);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('Private recovery data and backups must remain outside the repository');
    }
  }
  return requested;
}

const inventorySql = `SELECT t.table_name::text AS name,
  ARRAY(SELECT c.column_name::text FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.table_name ORDER BY c.ordinal_position) AS columns,
  ARRAY(SELECT DISTINCT target.relname::text FROM pg_constraint fk
    JOIN pg_class source ON source.oid=fk.conrelid JOIN pg_namespace ns ON ns.oid=source.relnamespace
    JOIN pg_class target ON target.oid=fk.confrelid
    WHERE fk.contype='f' AND ns.nspname='public' AND source.relname=t.table_name AND target.relname<>source.relname
    ORDER BY target.relname::text) AS dependencies
  FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
  ORDER BY t.table_name`;

export async function createPrivateDatabaseBackup(sql, { parent = os.tmpdir(), databaseHost = null } = {}) {
  await assertPrivateLocation(parent);
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'eagleevals-review-backup-'));
  await chmod(directory, 0o700);
  const tables = await sql.query(inventorySql);
  if (!tables.length) throw new Error('The database has no public tables to back up');
  for (const table of tables) { identifier(table.name); table.columns.forEach(identifier); }
  // Discover and read every table under one consistent, read-only snapshot.
  const results = await sql.transaction([
    sql.query("SET LOCAL TIME ZONE 'UTC'"),
    sql.query(inventorySql),
    ...tables.map(table => sql.query(`SELECT to_jsonb(t) AS row FROM public.${identifier(table.name)} t`)),
  ], { isolationLevel: 'RepeatableRead', readOnly: true });
  if (JSON.stringify(results[1]) !== JSON.stringify(tables)) throw new Error('Schema changed while preparing the backup; retry with a fresh backup');
  const backup = { format, createdAt: new Date().toISOString(), databaseHost,
    tables: tables.map((table, index) => ({ ...table, rows: results[index + 2].map(record => record.row) })) };
  const uncompressed = Buffer.from(JSON.stringify(backup));
  const compressed = gzipSync(uncompressed);
  const manifest = { format, createdAt: backup.createdAt, databaseHost,
    file: 'database.json.gz', sha256: sha256(compressed), uncompressedSha256: sha256(uncompressed),
    tables: Object.fromEntries(backup.tables.map(table => [table.name, { count: table.rows.length, sha256: rowDigest(table.rows) }])) };
  const backupPath = path.join(directory, manifest.file);
  const manifestPath = path.join(directory, 'manifest.json');
  await writeFile(backupPath, compressed, { mode: 0o600, flag: 'wx' });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  // Read the files back, validate gzip and both content and per-table digests.
  await loadPrivateDatabaseBackup(backupPath);
  return { directory, backupPath, manifestPath, sha256: manifest.sha256, manifest };
}

export async function loadPrivateDatabaseBackup(backupPath) {
  await assertPrivateLocation(backupPath);
  const directory = path.dirname(backupPath);
  const [manifestBytes, compressed] = await Promise.all([readFile(path.join(directory, 'manifest.json')), readFile(backupPath)]);
  for (const location of [directory, backupPath, path.join(directory, 'manifest.json')]) {
    if (((await stat(location)).mode & 0o077) !== 0) throw new Error('Backup permissions must be private');
  }
  const manifest = JSON.parse(manifestBytes);
  if (manifest.format !== format || manifest.file !== 'database.json.gz' || path.basename(backupPath) !== manifest.file || sha256(compressed) !== manifest.sha256) {
    throw new Error('Backup checksum or manifest validation failed');
  }
  const uncompressed = gunzipSync(compressed);
  if (sha256(uncompressed) !== manifest.uncompressedSha256) throw new Error('Uncompressed backup checksum failed');
  const backup = JSON.parse(uncompressed);
  if (backup.format !== format || backup.createdAt !== manifest.createdAt || backup.databaseHost !== manifest.databaseHost
    || Object.keys(manifest.tables).length !== backup.tables.length) throw new Error('Backup manifest does not match its contents');
  const seen = new Set();
  for (const table of backup.tables) {
    identifier(table.name);
    table.columns.forEach(identifier);
    table.dependencies.forEach(identifier);
    if (seen.has(table.name) || new Set(table.columns).size !== table.columns.length || !manifest.tables[table.name]
      || manifest.tables[table.name].count !== table.rows.length || manifest.tables[table.name].sha256 !== rowDigest(table.rows)) throw new Error('Backup table content verification failed');
    seen.add(table.name);
  }
  return { backup, manifest, backupPath };
}

export function pgliteSql(pg) {
  const lazy = (text, values = []) => ({ text, values,
    then(resolve, reject) { return pg.query(text, values).then(result => result.rows).then(resolve, reject); } });
  return { query: lazy, transaction(queries) {
    return pg.transaction(async tx => {
      const results = [];
      for (const query of queries) results.push((await tx.query(query.text, query.values)).rows);
      return results;
    });
  } };
}

function orderedTables(tables) {
  const remaining = new Map(tables.map(table => [table.name, table]));
  const names = new Set(remaining.keys());
  const result = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter(table => table.dependencies.every(name => !names.has(name) || !remaining.has(name)));
    if (!ready.length) throw new Error('Backup dependencies cannot be restored safely');
    for (const table of ready) { result.push(table); remaining.delete(table.name); }
  }
  return result;
}

export async function verifyRestoredBackup(sql, backup) {
  for (const table of backup.tables) {
    const columns = table.columns.map(identifier).join(',');
    const actual = (await sql.query(`SELECT to_jsonb(t) AS row FROM (SELECT ${columns} FROM public.${identifier(table.name)}) t`)).map(record => record.row);
    const rows = table.name === 'schema_migrations' ? actual.filter(row => table.rows.some(original => original.filename === row.filename)) : actual;
    if (rowDigest(rows) !== rowDigest(table.rows)) throw new Error(`Restored table ${table.name} does not match the verified backup`);
  }
}

export async function refreshDiffWithRecency(sql, snapshot, diff) {
  const incoming = Date.parse(snapshot.manifest.completedAt);
  if (!Number.isFinite(incoming)) throw new Error('The source snapshot has no valid completion timestamp');
  const verified = await sql.query(`SELECT snapshot_id,verification_manifest FROM migration_runs
    WHERE status='verified' AND source_url=$1`, ['https://www.ratemyprofessors.com/search/professors/122']);
  const current = verified.map(row => {
    const completedAt = row.verification_manifest?.sourceCompletedAt
      ?? (row.snapshot_id.startsWith('rmp-bc-') ? row.snapshot_id.slice('rmp-bc-'.length) : null);
    return { snapshotId: row.snapshot_id, completedAt, timestamp: Date.parse(completedAt) };
  }).filter(row => Number.isFinite(row.timestamp)).sort((a, b) => b.timestamp - a.timestamp)[0];
  return { ...diff, olderSnapshots: current && incoming < current.timestamp ? [{
    snapshotId: snapshot.snapshotId, completedAt: snapshot.manifest.completedAt,
    currentSnapshotId: current.snapshotId, currentCompletedAt: current.completedAt,
  }] : [] };
}

export async function restorePrivateDatabaseBackup(loaded, { migrationsPath = path.join(repository, 'database/migrations'), batchSize = 250 } = {}) {
  const { backup } = typeof loaded === 'string' ? await loadPrivateDatabaseBackup(loaded) : loaded;
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  const sql = pgliteSql(pg);
  try {
    await pg.exec("SET TIME ZONE 'UTC'");
    await applyMigrations(sql, migrationsPath);
    const applied = new Map((await sql.query('SELECT filename,sha256 FROM schema_migrations')).map(row => [row.filename, row.sha256]));
    for (const row of backup.tables.find(table => table.name === 'schema_migrations')?.rows ?? []) {
      if (applied.get(row.filename) !== row.sha256) throw new Error('Backed-up migration checksums do not match the local schema');
    }
    for (const table of orderedTables(backup.tables)) {
      const columns = table.columns.map(identifier).join(',');
      const conflict = table.name === 'schema_migrations' ? ' ON CONFLICT(filename) DO UPDATE SET sha256=EXCLUDED.sha256,applied_at=EXCLUDED.applied_at' : '';
      for (let start = 0; start < table.rows.length; start += batchSize) {
        await sql.query(`INSERT INTO public.${identifier(table.name)}(${columns})
          SELECT ${columns} FROM jsonb_populate_recordset(NULL::public.${identifier(table.name)},$1::jsonb)${conflict}`,
        [JSON.stringify(table.rows.slice(start, start + batchSize))]);
      }
    }
    await verifyRestoredBackup(sql, backup);
    return { pg, sql, backup };
  } catch (error) { await pg.close(); throw error; }
}

async function verifyImportPreservesNative(sql, backup) {
  const protectedTables = new Set(['courses', 'reviews', 'review_metrics', 'student_comments', 'faculty_directory_entries', 'anonymous_reports', 'review_link_repairs']);
  for (const table of backup.tables) {
    if (!protectedTables.has(table.name) && table.name !== 'professors') continue;
    const expected = table.name === 'professors' ? table.rows.filter(row => row.catalog_source !== 'external_rmp') : table.rows;
    const columns = table.columns.filter(column => table.name !== 'professors' || column !== 'search_names');
    const actual = (await sql.query(`SELECT to_jsonb(t) AS row FROM (SELECT ${columns.map(identifier).join(',')} FROM public.${identifier(table.name)}) t`)).map(record => record.row);
    const actualRows = new Set(rowStrings(actual));
    if (rowStrings(expected.map(row => Object.fromEntries(columns.map(column => [column, row[column]])))).some(row => !actualRows.has(row))) {
      throw new Error(`Source refresh changed preserved rows in ${table.name}`);
    }
  }
}

export async function testReviewRefresh(backupPath, snapshot, { approvalDigest = null, migrationsPath, batchSize = 200, onPlan } = {}) {
  const restored = await restorePrivateDatabaseBackup(backupPath, { migrationsPath });
  try {
    const prepared = await prepareDatabaseImport(restored.sql, snapshot);
    const plan = prepared.plan;
    const diff = await refreshDiffWithRecency(restored.sql, snapshot, prepared.diff);
    await onPlan?.({ plan, diff });
    assertRecoveryCoverage(diff, snapshot.sha256, approvalDigest);
    await stageRmpImport(restored.sql, snapshot, plan, batchSize);
    const results = await restored.sql.transaction(publicationStatements(snapshot.snapshotId).map(([query, parameters]) => restored.sql.query(query, parameters)));
    if (results[2][0].written !== plan.coverage.writtenReviews) throw new Error('Isolated publication count mismatch');
    await verifyImportPreservesNative(restored.sql, restored.backup);
    return { plan, diff, writtenReviews: results[2][0].written, preservedNativeRows: true };
  } finally { await restored.pg.close(); }
}
