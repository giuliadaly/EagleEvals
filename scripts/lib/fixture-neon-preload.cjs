// Used only by the local production-mode cache check. Never loaded by the app.
const fixtureUrl = 'postgresql://fixture:fixture@ep-fixture.us-east-2.aws.neon.tech/fixture';
if (process.env.DATABASE_URL !== fixtureUrl || !process.env.FIXTURE_SQL_ORIGIN) {
  throw new Error('The cache check requires its isolated fixture database');
}
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const connection = new Headers(options?.headers).get('Neon-Connection-String');
  if (connection) {
    if (connection !== fixtureUrl) throw new Error('Real database access is forbidden in the cache check');
    return originalFetch(`${process.env.FIXTURE_SQL_ORIGIN}/sql`, options);
  }
  return originalFetch(input, options);
};
