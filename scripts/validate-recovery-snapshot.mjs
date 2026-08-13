import { loadAndValidateSnapshot, parseSnapshotArgument } from './lib/recovery-snapshot.mjs';

async function run() {
  const snapshotPath = parseSnapshotArgument(process.argv.slice(2));
  const snapshot = await loadAndValidateSnapshot(snapshotPath);
  const counts = Object.fromEntries(
    Object.entries(snapshot.records).map(([name, records]) => [name, records.length]),
  );
  process.stdout.write(`${JSON.stringify({
    snapshotId: snapshot.snapshotId,
    sourceUrl: snapshot.sourceUrl,
    counts,
    passed: true,
  }, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
