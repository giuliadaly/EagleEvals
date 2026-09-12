# Database setup and recovery

The application uses Neon Postgres through `DATABASE_URL`. Use a separate
development database for local work. Next.js loads `.env.local` automatically;
the standalone Node scripts need the variable supplied explicitly.

## Schema

For a new development database, apply the versioned SQL files in
[`database/migrations`](../database/migrations):

```bash
node --env-file=.env.local scripts/apply-database-schema.mjs
```

This sets up the schema, not the course and professor catalog. Catalog data must
come from an authorized recovery snapshot. Before running migrations against
production, review the SQL, confirm an independent backup, and verify compatibility
with the currently deployed application.

## Recovered data

Recovery snapshots stay outside this repository. Never commit database exports,
source-feed snapshots, cached API responses, credentials, or user identifiers.
Set `RECOVERY_SNAPSHOT` in your shell to the absolute location of the snapshot.
Keep `DATABASE_URL` in the environment or supply it with Node's `--env-file` option.

```bash
pnpm db:validate-snapshot -- --snapshot "$RECOVERY_SNAPSHOT"
pnpm db:migrate:recovered -- --snapshot "$RECOVERY_SNAPSHOT"
pnpm db:verify -- --snapshot "$RECOVERY_SNAPSHOT"
```

The import validates gzip checksums, record counts, foreign-key relationships,
rating ranges, and comment anonymization before connecting to Postgres. Imports
are idempotent: rerunning the same snapshot updates its rows and verifies the
database again.

The schema preserves source records in JSONB while normalizing fields used by
search and detail pages. Exact legacy professors remain separate from the public
faculty-directory supplement. The discovery archive is retained for reconciliation
and is not imported as another set of reviews.

Verification writes `manifests/database-verification.json` into the snapshot.
Do not delete recovery data until an independent provider backup, a restore test,
and deployed-page checks have also passed.

## Anonymous submissions

New submissions use the normalized rating and comment tables and remain
distinguishable from recovered rows. Reviews do not store a name, account, email,
student ID, IP address, user agent, cookie identifier, or browser fingerprint.
Exact duplicate payloads are rejected using a fingerprint of the review contents.
Provider request logs and aggregate analytics are separate from review records;
see the [privacy policy](https://eagleevals.com/privacy).

A new review requires a course, professor, semester, two overall ratings, a short
comment, and confirmation of first-hand experience and the guidelines. Section,
take-again preference, and nine detailed ratings are optional. Missing details
are stored as SQL `NULL` and excluded from category averages.

## Compatibility migrations

- `003_optional_review_details.sql` makes the three relevant columns nullable.
  `scripts/allow-optional-review-details.mjs` applies and verifies that scoped
  migration. It preserves existing data and supports the previous form during rollout.
- `004_comment_review_context.sql` links new comments to their anonymous rating
  submission. `scripts/link-review-context.mjs` applies that additive migration
  with a five-second lock timeout. Historical comments stay unlinked and show
  “Semester not recorded”; never infer a class semester from the posting date.

Apply the required migrations to each target database before deploying code
that depends on them. The general schema command includes both migrations.
