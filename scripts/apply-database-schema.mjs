import path from 'node:path';

import { applyMigrations, connectDatabase } from './lib/database.mjs';

async function run() {
  const files = await applyMigrations(
    connectDatabase(),
    path.join(process.cwd(), 'database', 'migrations'),
  );
  process.stdout.write(`Applied ${files.length} database migrations: ${files.join(', ')}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
