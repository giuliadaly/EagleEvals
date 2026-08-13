import 'server-only';

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

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
