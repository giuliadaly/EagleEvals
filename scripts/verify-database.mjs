import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { connectDatabase } from './lib/database.mjs';
import { verifyDatabase } from './lib/database-verification.mjs';
import { loadAndValidateSnapshot, parseSnapshotArgument } from './lib/recovery-snapshot.mjs';

async function run() {
  const snapshotPath = parseSnapshotArgument(process.argv.slice(2));
  const snapshot = await loadAndValidateSnapshot(snapshotPath);
  const report = await verifyDatabase({
    sql: connectDatabase(),
    snapshotId: snapshot.snapshotId,
    verification: snapshot.verification,
  });
  const reportPath = path.join(snapshot.snapshotPath, 'manifests', 'database-verification.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
