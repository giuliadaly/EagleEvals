import assert from 'node:assert/strict';
import { chmod, cp, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { neon, neonConfig } from '@neondatabase/serverless';
import { applyMigrations } from './lib/database.mjs';
import { RMP_BC_SCHOOL } from './lib/rmp-recovery.mjs';
import { prepareDatabaseImport, publicationStatements, stageRmpImport } from './import-rmp-reviews.mjs';
import { assertPrivateLocation, connectReviewMaintenanceDatabase, createPrivateDatabaseBackup, loadPrivateDatabaseBackup, pgliteSql, refreshDiffWithRecency, restorePrivateDatabaseBackup, testReviewRefresh } from './lib/review-refresh.mjs';
import { assertRecoveryCoverage } from './lib/review-associations.mjs';
import { assertRefreshApply, maintenanceDatabaseUrl, parseRefreshArguments, recoveryDirectory } from './refresh-written-reviews.mjs';

const course = '000000000000000000000001';
const professor = '000000000000000000000002';
const encode = value => Buffer.from(value).toString('base64');
const digest = 'a'.repeat(64);
function snapshot(reviews = [1, 2]) {
  const teacher = { id: encode('Teacher-123'), legacyId: 123, firstName: 'Jane', lastName: 'Teacher', department: 'Mathematics', numRatings: reviews.length, school: { id: RMP_BC_SCHOOL } };
  return { snapshotId: `rmp-fixture-${reviews.join('-')}`, sha256: digest,
    manifest: { completedAt: '2026-10-14T00:00:00Z', ratings: reviews.length, writtenReviews: reviews.length }, snapshots: [{
      teacher, pages: 1, complete: true, reportedRatingCount: reviews.length, fetchedAt: '2026-10-14T00:00:00Z',
      reviews: reviews.map(id => ({ id: encode(`Rating-${id}`), legacyId: id, class: ' MATH 1004 ',
        comment: `Original source comment ${id}, preserved exactly.`, date: '2025-01-02 03:04:05 +0000 UTC', wouldTakeAgain: 'Yes' })),
    }] };
}

async function fixture(t, migrationsPath = 'database/migrations') {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'eagleevals-refresh-test-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  t.after(() => pg.close());
  const sql = pgliteSql(pg);
  await applyMigrations(sql, migrationsPath);
  await sql.query("INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest) VALUES('native','fixture','verified','{}','{}')");
  await sql.query(`INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot)
    VALUES($1,'MATH1004','Finite Probability','Mathematics','Fixture',$2::jsonb,'native')`, [course, JSON.stringify({ original: 'Untouched course source.' })]);
  await sql.query(`INSERT INTO professors(id,name,legacy_document,source_snapshot)
    VALUES($1,'Jane Teacher',$2::jsonb,'native')`, [professor, JSON.stringify({ original: 'Untouched professor source.' })]);
  await sql.query(`INSERT INTO student_comments(id,course_id,professor_id,message,would_take_again,source,created_at,legacy_document)
    VALUES('native-comment',$1,$2,'An untouched native comment.',true,'legacy_eagleeval','2025-01-01T00:00:00Z',$3::jsonb)`, [course, professor, JSON.stringify({ raw: 'An untouched native comment.' })]);
  return { sql, pg, parent };
}

test('database inventory and backup decode through the actual Neon wire parser without network access', async t => {
  const { pg, parent } = await fixture(t);
  const originalFetch = neonConfig.fetchFunction;
  t.after(() => { neonConfig.fetchFunction = originalFetch; });
  const inventoryTypes = [];
  const wireValue = (value, oid) => value == null ? null
    : oid === 114 || oid === 3802 ? JSON.stringify(value)
    : Array.isArray(value) ? `{${value.map(item => JSON.stringify(String(item))).join(',')}}`
    : value instanceof Date ? value.toISOString() : String(value);
  const execute = async (db, query) => {
    const result = await db.query(query.query, query.params, { rowMode: 'array' });
    if (query.query.includes('information_schema.tables')) inventoryTypes.push(result.fields.map(field => field.dataTypeID));
    return { fields: result.fields,
      rows: result.rows.map(row => row.map((value, index) => wireValue(value, result.fields[index].dataTypeID))),
      rowCount: result.affectedRows ?? result.rows.length };
  };
  neonConfig.fetchFunction = async (_url, init) => {
    const query = JSON.parse(init.body);
    const result = query.queries ? { results: await pg.transaction(async tx => {
      const results = [];
      for (const statement of query.queries) results.push(await execute(tx, statement));
      return results;
    }) } : await execute(pg, query);
    return Response.json(result);
  };
  const sql = neon('postgresql://fixture:fixture@ep-fixture.neon.tech/fixture');
  const saved = await createPrivateDatabaseBackup(sql, { parent, databaseHost: 'ep-fixture.neon.tech' });
  assert.deepEqual(inventoryTypes, [[25, 1009, 1009], [25, 1009, 1009]], 'inventory exposes text and text[] rather than domain/name array OIDs');
  const loaded = await loadPrivateDatabaseBackup(saved.backupPath);
  assert.ok(loaded.backup.tables.every(table => Array.isArray(table.columns) && Array.isArray(table.dependencies)));
  assert.equal(loaded.manifest.tables.student_comments.count, 1);
});

test('full backup uses one read-only snapshot, includes private reports, and restores every captured field', async t => {
  const { sql, parent } = await fixture(t);
  await sql.query(`INSERT INTO anonymous_reports(id,target_kind,reason,message)
    VALUES('000000000000000000000003','site','incorrect-information','A private correction report for the fixture.')`);
  let readOnlyOptions;
  const observed = { query: sql.query, transaction(queries, options) { readOnlyOptions = options; return sql.transaction(queries, options); } };
  const saved = await createPrivateDatabaseBackup(observed, { parent, databaseHost: 'fixture.local' });
  assert.deepEqual(readOnlyOptions, { isolationLevel: 'RepeatableRead', readOnly: true });
  assert.equal(saved.manifest.tables.anonymous_reports.count, 1);
  assert.equal((await stat(saved.backupPath)).mode & 0o777, 0o600);
  assert.equal((await stat(saved.directory)).mode & 0o777, 0o700);
  const loaded = await loadPrivateDatabaseBackup(saved.backupPath);
  assert.equal(loaded.backup.tables.find(table => table.name === 'anonymous_reports').rows[0].message, 'A private correction report for the fixture.');
  const restored = await restorePrivateDatabaseBackup(loaded);
  t.after(() => restored.pg.close());
  assert.equal((await restored.sql.query('SELECT message FROM student_comments'))[0].message, 'An untouched native comment.');
  assert.equal((await restored.sql.query('SELECT count(*)::integer AS n FROM schema_migrations'))[0].n, 7);
  await chmod(saved.backupPath, 0o644);
  await assert.rejects(loadPrivateDatabaseBackup(saved.backupPath), /permissions must be private/);
  await chmod(saved.backupPath, 0o600);
  const corrupt = await readFile(saved.backupPath);
  corrupt[corrupt.length - 1] ^= 1;
  await writeFile(saved.backupPath, corrupt);
  await assert.rejects(loadPrivateDatabaseBackup(saved.backupPath), /checksum/);
});

test('old-schema backup omits new columns on restore and preserves old migration metadata', async t => {
  const migrations = await mkdtemp(path.join(os.tmpdir(), 'eagleevals-old-schema-'));
  t.after(() => rm(migrations, { recursive: true, force: true }));
  for (const file of ['001_initial.sql', '002_anonymous_reviews.sql', '003_optional_review_details.sql', '004_comment_review_context.sql', '005_external_written_reviews.sql']) {
    await cp(path.join('database/migrations', file), path.join(migrations, file));
  }
  const { sql, parent } = await fixture(t, migrations);
  const saved = await createPrivateDatabaseBackup(sql, { parent });
  const loaded = await loadPrivateDatabaseBackup(saved.backupPath);
  assert.ok(!loaded.backup.tables.find(table => table.name === 'professors').columns.includes('catalog_source'));
  const restored = await restorePrivateDatabaseBackup(loaded);
  t.after(() => restored.pg.close());
  const [row] = await restored.sql.query('SELECT catalog_source,search_names,legacy_document FROM professors');
  assert.equal(row.catalog_source, 'legacy_eagleeval');
  assert.deepEqual(row.search_names, []);
  assert.deepEqual(row.legacy_document, { original: 'Untouched professor source.' });
  assert.equal((await restored.sql.query('SELECT count(*)::integer AS n FROM schema_migrations'))[0].n, 7);
});

test('isolated refresh preserves native data and blocks dropped source coverage before staging', async t => {
  const { sql, parent } = await fixture(t);
  const current = snapshot();
  const { plan } = await prepareDatabaseImport(sql, current);
  await stageRmpImport(sql, current, plan);
  await sql.transaction(publicationStatements(current.snapshotId).map(([query, values]) => sql.query(query, values)));
  const saved = await createPrivateDatabaseBackup(sql, { parent });
  const tested = await testReviewRefresh(saved.backupPath, current);
  assert.equal(tested.writtenReviews, 2);
  assert.equal(tested.preservedNativeRows, true);
  let blockedPlan;
  const reduced = snapshot([1]);
  await assert.rejects(testReviewRefresh(saved.backupPath, reduced, { onPlan: value => { blockedPlan = value; } }), /coverage regressed/);
  assert.deepEqual(blockedPlan.diff.removedPublishedReviews, [encode('Rating-2')]);
  await assert.rejects(testReviewRefresh(saved.backupPath, reduced, { approvalDigest: 'wrong-digest' }), /coverage regressed/);
  const approved = await testReviewRefresh(saved.backupPath, reduced, { approvalDigest: digest });
  assert.equal(approved.writtenReviews, 1);
  assert.equal(approved.preservedNativeRows, true);
  assert.equal((await sql.query('SELECT count(*)::integer AS n FROM public_written_reviews'))[0].n, 3, 'all testing remains isolated from the original database');
});

test('fresh collection never reuses checkpoints without explicit resume and raw data cannot enter Git', async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'eagleevals-refresh-options-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const output = path.join(parent, 'fresh');
  assert.equal(await recoveryDirectory({ recover: true, output }), output);
  await assert.rejects(recoveryDirectory({ recover: true, output }), error => error.code === 'EEXIST');
  assert.equal(await recoveryDirectory({ resume: output }), output);
  await assert.rejects(assertPrivateLocation(path.join(process.cwd(), 'tmp/raw-recovery')), /outside the repository/);
  const linked = path.join(parent, 'repo-link');
  await symlink(process.cwd(), linked);
  await assert.rejects(assertPrivateLocation(path.join(linked, 'raw-recovery')), /outside the repository/);
  assert.throws(() => parseRefreshArguments(['--recover', '--snapshot', output]), /exactly one/);
  assert.throws(() => parseRefreshArguments(['--snapshot', output, '--output', output]), /fresh --recover/);
  assert.equal(parseRefreshArguments(['--snapshot', output]).apply, false);
  const options = { apply: true, 'expect-sha256': digest, 'expected-host': 'fixture.local' };
  assert.doesNotThrow(() => assertRefreshApply(options, snapshot(), 'fixture.local'));
  assert.throws(() => assertRefreshApply(options, snapshot(), 'wrong.local'), /exact verified snapshot digest and database hostname/);
  assert.throws(() => assertRefreshApply({ ...options, 'expect-sha256': 'old-digest' }, snapshot(), 'fixture.local'), /exact verified snapshot digest/);
  const direct = new URL(maintenanceDatabaseUrl('postgresql://fixture:fixture@ep-fixture-pooler.c-10.us-east-1.aws.neon.tech/fixture?sslmode=require'));
  assert.equal(direct.hostname, 'ep-fixture.c-10.us-east-1.aws.neon.tech');
  assert.equal(direct.pathname, '/fixture');
  assert.equal(direct.searchParams.get('sslmode'), 'require');
  assert.equal(direct.username, 'fixture');
  assert.equal(new URL(maintenanceDatabaseUrl('postgresql://fixture:fixture@custom-pooler.example/fixture')).hostname, 'custom-pooler.example');
});

test('an older source snapshot cannot replace a newer verified refresh without exact owner approval', async () => {
  const current = 'rmp-bc-2026-10-15T00:00:00Z';
  const sql = { query: async () => [{ snapshot_id: current, verification_manifest: {} }] };
  const diff = await refreshDiffWithRecency(sql, snapshot(), {});
  assert.equal(diff.olderSnapshots[0].currentSnapshotId, current);
  assert.throws(() => assertRecoveryCoverage(diff, digest), /coverage regressed/);
  assert.throws(() => assertRecoveryCoverage(diff, digest, 'a-different-snapshot'), /coverage regressed/);
  assert.doesNotThrow(() => assertRecoveryCoverage(diff, digest, digest));
  const fresh = { ...snapshot(), manifest: { ...snapshot().manifest, completedAt: '2026-10-16T00:00:00Z' } };
  assert.deepEqual((await refreshDiffWithRecency(sql, fresh, {})).olderSnapshots, []);
  await assert.rejects(refreshDiffWithRecency(sql, { manifest: { completedAt: 'invalid' } }, {}), /valid completion timestamp/);
});

function sessionMock(failAt = null) {
  const events = [];
  let config;
  const failure = new Error('Fixture session failure');
  class MockPool {
    constructor(options) { config = options; }
    on() {}
    async query(text) { events.push(`pool:${text}`); return { rows: [{ text }] }; }
    async connect() {
      events.push('connect');
      return { async query(text) {
        events.push(text);
        if (text === failAt) throw failure;
        return { rows: [{ text }] };
      }, release(discard) { events.push(`release:${discard}`); } };
    }
    async end() { events.push('end'); }
  }
  const connection = connectReviewMaintenanceDatabase('postgresql://fixture:fixture@ep-fixture-pooler.neon.tech/fixture', { PoolConstructor: MockPool });
  return { ...connection, events, failure, config };
}

test('session backup transaction holds one client, executes sequentially, and commits read-only repeatable reads', async () => {
  const { sql, close, events, config } = sessionMock();
  const queries = [sql.query('SELECT first'), sql.query('SELECT second')];
  assert.deepEqual(events, [], 'query descriptors are lazy');
  const result = await sql.transaction(queries, { isolationLevel: 'RepeatableRead', readOnly: true });
  assert.deepEqual(events, ['connect', 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'SELECT first', 'SELECT second', 'COMMIT', 'release:false']);
  assert.deepEqual(result, [[{ text: 'SELECT first' }], [{ text: 'SELECT second' }]]);
  assert.equal(config.max, 1);
  assert.equal(config.connectionTimeoutMillis, 15000);
  assert.equal(new URL(config.connectionString).hostname, 'ep-fixture.neon.tech');
  await close();
  assert.equal(events.at(-1), 'end');
});

test('failed or uncertain session transactions roll back, discard the client, and never retry', async () => {
  for (const failAt of ['SELECT second', 'COMMIT']) {
    const { sql, close, events, failure } = sessionMock(failAt);
    await assert.rejects(sql.transaction([sql.query('SELECT first'), sql.query('SELECT second')]), error => error === failure);
    assert.equal(events.filter(event => event === 'SELECT first').length, 1);
    assert.equal(events.filter(event => event === 'ROLLBACK').length, 1);
    assert.equal(events.at(-1), 'release:true');
    await close();
  }
});

test('session SQL adapter exports a consistent full backup without an aggregate HTTP response', async t => {
  const { pg, parent } = await fixture(t);
  const commands = [];
  class FixturePool {
    on() {}
    async query(text, values) { commands.push(`outside:${text}`); return pg.query(text, values); }
    async connect() {
      return { async query(text, values) { commands.push(text); return pg.query(text, values); }, release() {} };
    }
    async end() {}
  }
  const { sql, close } = connectReviewMaintenanceDatabase('postgresql://fixture:fixture@ep-fixture.neon.tech/fixture', { PoolConstructor: FixturePool });
  t.after(close);
  const saved = await createPrivateDatabaseBackup(sql, { parent });
  assert.equal(commands.filter(command => command.startsWith('outside:')).length, 1, 'only initial inventory discovery uses the pool directly');
  assert.equal(commands[1], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(commands.at(-1), 'COMMIT');
  assert.equal(saved.manifest.tables.student_comments.count, 1);
});
