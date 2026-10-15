import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { neon, neonConfig } from '@neondatabase/serverless';
import { applyMigrations } from './lib/database.mjs';

async function migrations(t, sources) {
  const directory = await mkdtemp('/private/tmp/eagleevals-atomic-migrations-');
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [filename, source] of Object.entries(sources)) await writeFile(path.join(directory, filename), source);
  return directory;
}

function lazyDatabase(pg, events) {
  const query = (text, parameters = []) => ({
    text, parameters,
    then(resolve, reject) {
      events.push({ kind: 'standalone', text });
      return pg.query(text, parameters).then(result => result.rows).then(resolve, reject);
    },
  });
  return {
    query,
    async transaction(queries) {
      events.push({ kind: 'transaction', count: queries.length });
      return pg.transaction(async tx => {
        const results = [];
        for (const { text, parameters } of queries) {
          events.push({ kind: 'transaction-query', text });
          results.push((await tx.query(text, parameters)).rows);
        }
        return results;
      });
    },
  };
}

test('a midway migration failure rolls back pending DDL, data, and registrations together', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  await pg.exec("CREATE TABLE original_data(id integer PRIMARY KEY,message text); INSERT INTO original_data VALUES(1,'Preserve the original review');");
  const directory = await migrations(t, {
    '001_additive.sql': "ALTER TABLE original_data ADD COLUMN annotation text;\n-- migrate:split\nUPDATE original_data SET message='Must roll back';",
    '002_failure.sql': "CREATE TABLE temporary_derived_data(id integer);\n-- migrate:split\nINSERT INTO missing_table VALUES(1);",
  });
  const events = [];
  const sql = lazyDatabase(pg, events);
  await assert.rejects(applyMigrations(sql, directory), error => error.code === '42P01');
  assert.deepEqual((await pg.query('SELECT * FROM original_data')).rows, [{ id: 1, message: 'Preserve the original review' }]);
  assert.equal((await pg.query("SELECT to_regclass('public.temporary_derived_data') AS table_name")).rows[0].table_name, null);
  assert.equal((await pg.query('SELECT count(*)::integer AS total FROM schema_migrations')).rows[0].total, 0);
  assert.equal(events.filter(event => event.kind === 'transaction').length, 1);
  assert.equal(events.filter(event => event.kind === 'standalone').length, 2, 'Only registry creation and the applied-checksum read execute outside the transaction');
  assert.match(events.find(event => event.kind === 'transaction-query').text, /ACCESS EXCLUSIVE MODE NOWAIT/);
});

test('a lock conflict aborts before any migration statement or checksum write and is never retried', async t => {
  const directory = await migrations(t, { '001_pending.sql': 'CREATE TABLE must_not_exist(id integer);' });
  const failure = Object.assign(new Error('fixture relation lock is unavailable'), { code: '55P03' });
  const executed = [];
  let transactions = 0;
  const sql = {
    query(text, parameters = []) {
      return { text, parameters, then(resolve, reject) {
        executed.push(text);
        return Promise.resolve([]).then(resolve, reject);
      } };
    },
    async transaction(queries) {
      transactions++;
      for (const { text } of queries) {
        executed.push(text);
        if (text.includes('ACCESS EXCLUSIVE MODE NOWAIT')) throw failure;
      }
      throw new Error('Lock guard did not run first');
    },
  };
  await assert.rejects(applyMigrations(sql, directory), error => error === failure);
  assert.equal(transactions, 1);
  assert.equal(executed.length, 3);
  assert.match(executed[2], /pg_catalog\.pg_class/);
  assert.match(executed[2], /c\.relkind IN \('r','p','v'\)/);
  assert.match(executed[2], /ORDER BY n\.nspname,c\.relname/);
  assert.match(executed[2], /format\('LOCK TABLE %I\.%I IN ACCESS EXCLUSIVE MODE NOWAIT'/);
  assert.equal(executed.some(text => text.includes('must_not_exist') || text.startsWith('INSERT INTO schema_migrations')), false);
});

test('successful migrations and quoted public relations replay without writes; changed checksums fail before new DDL', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  // These actual catalog identifiers require SQL identifier quoting. Views and
  // partitioned tables also belong to the lock set, not merely ordinary tables.
  await pg.exec(`CREATE TABLE "odd""name; DROP TABLE danger"(id integer);
    CREATE VIEW "quoted view" AS SELECT * FROM "odd""name; DROP TABLE danger";
    CREATE TABLE partitioned_fixture(id integer) PARTITION BY RANGE(id);
    CREATE TABLE fixture_partition PARTITION OF partitioned_fixture FOR VALUES FROM(0) TO(10);`);
  const source = "CREATE TABLE preserved_reviews(id integer PRIMARY KEY,message text);\n-- migrate:split\nINSERT INTO preserved_reviews VALUES(1,'Original fixture comment');";
  const directory = await migrations(t, { '001_comments.sql': source });
  const events = [];
  const sql = lazyDatabase(pg, events);
  assert.deepEqual(await applyMigrations(sql, directory), ['001_comments.sql']);
  const expectedDigest = createHash('sha256').update(source).digest('hex');
  const before = (await pg.query('SELECT filename,sha256,applied_at FROM schema_migrations')).rows;
  assert.equal(before[0].sha256, expectedDigest);
  assert.equal((await pg.query('SELECT count(*)::integer AS total FROM preserved_reviews')).rows[0].total, 1);
  const appliedEvents = events.length;
  assert.deepEqual(await applyMigrations(sql, directory), ['001_comments.sql']);
  assert.deepEqual((await pg.query('SELECT filename,sha256,applied_at FROM schema_migrations')).rows, before);
  assert.equal(events.slice(appliedEvents).some(event => event.kind === 'transaction'), false, 'A fully applied replay does not lock live tables');
  await writeFile(path.join(directory, '000_new.sql'), 'CREATE TABLE must_not_apply_before_checksum_check(id integer);');
  await writeFile(path.join(directory, '001_comments.sql'), `${await readFile(path.join(directory, '001_comments.sql'), 'utf8')}\n-- changed`);
  const beforeMismatch = events.length;
  await assert.rejects(applyMigrations(sql, directory), /Applied migration 001_comments\.sql has changed/);
  assert.equal(events.slice(beforeMismatch).some(event => event.kind === 'transaction'), false);
  assert.equal((await pg.query("SELECT to_regclass('public.must_not_apply_before_checksum_check') AS table_name")).rows[0].table_name, null);
  assert.deepEqual((await pg.query('SELECT * FROM preserved_reviews')).rows, [{ id: 1, message: 'Original fixture comment' }]);
});

test('an uncertain transaction acknowledgement is surfaced once and the next explicit run checks committed registrations', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  const directory = await migrations(t, { '001_reviews.sql': 'CREATE TABLE once_only(id integer);\n-- migrate:split\nINSERT INTO once_only VALUES(1);' });
  const events = [];
  const sql = lazyDatabase(pg, events);
  const transaction = sql.transaction.bind(sql);
  const lostAcknowledgement = new Error('Fixture connection dropped after commit');
  sql.transaction = async queries => { await transaction(queries); throw lostAcknowledgement; };
  await assert.rejects(applyMigrations(sql, directory), error => error === lostAcknowledgement);
  assert.equal(events.filter(event => event.kind === 'transaction').length, 1);
  assert.equal((await pg.query('SELECT count(*)::integer AS total FROM once_only')).rows[0].total, 1);
  assert.deepEqual(await applyMigrations(sql, directory), ['001_reviews.sql']);
  assert.equal(events.filter(event => event.kind === 'transaction').length, 1);
  assert.equal((await pg.query('SELECT count(*)::integer AS total FROM once_only')).rows[0].total, 1);
});

test('the actual Neon driver sends locks, DDL and checksum writes in one lazy transaction request', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  const directory = await migrations(t, { '001_neon.sql': 'CREATE TABLE atomic_neon_fixture(id integer);\n-- migrate:split\nINSERT INTO atomic_neon_fixture VALUES(1);' });
  const requests = [];
  const originalFetch = neonConfig.fetchFunction;
  t.after(() => { neonConfig.fetchFunction = originalFetch; });
  async function execute(db, statement) {
    const result = await db.query(statement.query, statement.params, { rowMode: 'array' });
    return { fields: result.fields, rowCount: result.affectedRows ?? result.rows.length,
      rows: result.rows.map(row => row.map(value => value == null ? null : String(value))) };
  }
  neonConfig.fetchFunction = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const result = body.queries ? { results: await pg.transaction(async tx => {
      const results = [];
      for (const statement of body.queries) results.push(await execute(tx, statement));
      return results;
    }) } : await execute(pg, body);
    return Response.json(result);
  };
  const sql = neon('postgresql://fixture:fixture@ep-fixture.neon.tech/fixture');
  await applyMigrations(sql, directory);
  assert.equal(requests.length, 3);
  assert.match(requests[0].query, /^CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.equal(requests[1].query, 'SELECT filename,sha256 FROM schema_migrations');
  assert.match(requests[2].queries[0].query, /ACCESS EXCLUSIVE MODE NOWAIT/);
  assert.equal(requests[2].queries.length, 4);
  assert.match(requests[2].queries.at(-1).query, /^INSERT INTO schema_migrations/);
  assert.equal((await pg.query('SELECT count(*)::integer AS total FROM atomic_neon_fixture')).rows[0].total, 1);
  assert.equal((await pg.query('SELECT count(*)::integer AS total FROM schema_migrations')).rows[0].total, 1);
});
