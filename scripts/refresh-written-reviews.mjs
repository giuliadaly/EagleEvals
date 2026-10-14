import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chmod, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyMigrations, databaseUrl } from './lib/database.mjs';
import { loadRmpSnapshot } from './lib/rmp-recovery.mjs';
import { assertRecoveryCoverage } from './lib/review-associations.mjs';
import { prepareDatabaseImport, publicationStatements, stageRmpImport } from './import-rmp-reviews.mjs';
import { assertPrivateLocation, connectReviewMaintenanceDatabase, createPrivateDatabaseBackup, refreshDiffWithRecency, testReviewRefresh } from './lib/review-refresh.mjs';
export { maintenanceDatabaseUrl } from './lib/review-refresh.mjs';

const repository = fileURLToPath(new URL('..', import.meta.url));
const optionsWithValues = new Set(['--snapshot', '--resume', '--output', '--backup-root', '--expect-sha256', '--expected-host', '--approve-coverage-change-sha256']);

export function parseRefreshArguments(args) {
  const options = { apply: false, recover: false, help: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (seen.has(argument)) throw new Error(`Duplicate option ${argument}`);
    seen.add(argument);
    if (argument === '--apply' || argument === '--recover' || argument === '--help') options[argument.slice(2)] = true;
    else if (optionsWithValues.has(argument)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      options[argument.slice(2)] = value;
    } else throw new Error(`Unknown option ${argument}`);
  }
  if (options.help) return options;
  if ([options.snapshot, options.resume, options.recover].filter(Boolean).length !== 1) throw new Error('Choose exactly one of --snapshot, --recover, or --resume');
  if (options.output && !options.recover) throw new Error('--output requires a fresh --recover run');
  return options;
}

export async function recoveryDirectory(options) {
  if (options.snapshot) return assertPrivateLocation(options.snapshot);
  if (options.resume) {
    const directory = await assertPrivateLocation(options.resume);
    await readdir(directory); // Explicit resume must name an existing recovery.
    return directory;
  }
  if (options.output) {
    const directory = await assertPrivateLocation(options.output);
    await mkdir(directory, { mode: 0o700 }); // Never silently reuse old checkpoints.
    return directory;
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eagleevals-rmp-fresh-'));
  await chmod(directory, 0o700);
  return directory;
}

export function assertRefreshApply(options, snapshot, actualHost) {
  if (!options.apply) return;
  if (options['expect-sha256'] !== snapshot.sha256 || options['expected-host'] !== actualHost) {
    throw new Error('Applying requires this exact verified snapshot digest and database hostname');
  }
}

async function run() {
  const options = parseRefreshArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Manual review refresh: --recover [--output NEW_PRIVATE_FOLDER], --resume PRIVATE_FOLDER, or --snapshot COMPLETE_PRIVATE_FOLDER. Default: private backup, isolated restore/import test, and plan only. --apply requires --expect-sha256 DIGEST --expected-host HOST. Coverage regressions also require --approve-coverage-change-sha256 DIGEST.');
    return;
  }
  const snapshotRoot = await recoveryDirectory(options);
  if (options.recover || options.resume) {
    console.log(JSON.stringify({ recoveryFolder: snapshotRoot, fresh: options.recover, resume: Boolean(options.resume) }));
    const collector = spawn('python3', [path.join(repository, 'scripts/recover-rmp-reviews.py'), '--output', snapshotRoot], { stdio: 'inherit' });
    if ((await once(collector, 'exit'))[0] !== 0) throw new Error('Recovery did not complete; checkpoints remain private for explicit resume');
  }
  const snapshot = await loadRmpSnapshot(snapshotRoot);
  const connection = databaseUrl();
  const actualHost = new URL(connection).hostname;
  assertRefreshApply(options, snapshot, actualHost);
  const { sql, close } = connectReviewMaintenanceDatabase(connection);
  try {
    const backup = await createPrivateDatabaseBackup(sql, { parent: options['backup-root'] ?? os.tmpdir(), databaseHost: actualHost });
    const tested = await testReviewRefresh(backup.backupPath, snapshot, {
      approvalDigest: options['approve-coverage-change-sha256'],
      async onPlan({ plan, diff }) {
        const privatePlan = path.join(backup.directory, 'coverage-plan.json');
        await writeFile(privatePlan, `${JSON.stringify({ snapshotId: snapshot.snapshotId, sha256: snapshot.sha256,
          databaseHost: actualHost, backupPath: backup.backupPath, backupSha256: backup.sha256,
          coverage: plan.coverage, diff }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
        if (Object.values(diff).some(ids => ids.length) && options['approve-coverage-change-sha256'] !== snapshot.sha256) {
          console.log(JSON.stringify({ blocked: 'coverage-change', sha256: snapshot.sha256, privatePlan,
            diff: Object.fromEntries(Object.entries(diff).map(([name, ids]) => [name, ids.length])),
            nextStep: 'Inspect the private diff; owner approval requires --approve-coverage-change-sha256 with this exact digest.' }));
        }
      },
    });
    const report = { dryRun: !options.apply, snapshotId: snapshot.snapshotId, sha256: snapshot.sha256,
      databaseHost: actualHost, backupPath: backup.backupPath, backupSha256: backup.sha256,
      coverage: tested.plan.coverage, diff: tested.diff, isolatedImportVerified: true, preservedNativeRows: true };
    await writeFile(path.join(backup.directory, 'refresh-plan.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    if (options.apply) {
      if ((await loadRmpSnapshot(snapshotRoot)).sha256 !== snapshot.sha256) throw new Error('Recovery changed after verification; inspect and plan again');
      // Only versioned migrations tested on this exact backup may run remotely.
      await applyMigrations(sql, path.join(repository, 'database/migrations'));
      const prepared = await prepareDatabaseImport(sql, snapshot);
      const plan = prepared.plan;
      const diff = await refreshDiffWithRecency(sql, snapshot, prepared.diff);
      assertRecoveryCoverage(diff, snapshot.sha256, options['approve-coverage-change-sha256']);
      await stageRmpImport(sql, snapshot, plan);
      const results = await sql.transaction(publicationStatements(snapshot.snapshotId).map(([query, parameters]) => sql.query(query, parameters)));
      if (results[2][0].written !== plan.coverage.writtenReviews) throw new Error('Published written-review count mismatch; inspect before retrying');
      report.published = true;
      report.coverage = plan.coverage;
      report.diff = diff;
      report.cacheRevalidationRequired = true;
      await writeFile(path.join(backup.directory, 'refresh-result.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    }
    console.log(JSON.stringify({ ...report, diff: Object.fromEntries(Object.entries(report.diff).map(([name, ids]) => [name, ids.length])), privateReport: path.join(backup.directory, options.apply ? 'refresh-result.json' : 'refresh-plan.json') }, null, 2));
  } finally { await close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    // Driver failures may include source comments or credentials; retain those
    // privately and expose only a bounded category to the terminal.
    console.error(JSON.stringify({ failed: true, type: error.name, code: /^[A-Z0-9_]{1,20}$/.test(error.code ?? '') ? error.code : null }));
    process.exitCode = 1;
  });
}
