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

The production migration adapter checks all existing file checksums before
starting. Pending schema changes and their checksum registrations commit in
one transaction. It first acquires existing public relation locks with `NOWAIT`;
if a live request holds a conflicting lock, the migration stops before changing
the schema. Retry only after inspecting the recorded migration state. A lost
commit acknowledgement is not automatically replayed. Query-only adapters are
reserved for isolated local fixtures.

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
that depends on them. The general schema command includes all versioned migrations.

## External written-review recovery

Migration `005_external_written_reviews.sql` adds external profile/review tables
and a unified public written-review view. Apply it before deploying code that
queries `public_written_reviews`. Original course, professor, evaluation and
comment rows are preserved. Numerical rating averages do not include external
rating values.

Use Python 3.10 or newer for a resumable recovery of the public BC profile list:

```bash
python3 scripts/recover-rmp-reviews.py --output /path/to/private/recovery
```

Snapshots must remain outside this repository. The collector preserves all
reachable review pages, queries zero-count profiles too, and stops on an access
denial. It does not collect reviewer account fields. A complete snapshot is
required for import; interrupted runs resume from verified profile checkpoints.

Run the importer without `--apply` to inspect matching coverage and the snapshot
digest. Applying requires that exact digest, an explicit expected database host,
an owner-approved production connection, a current backup, and an isolated
restore/import test. New rows remain unpublished until record-content checks
pass. Publication and source reconciliation run in one transaction.

Unmatched professors and course codes remain searchable in the review archive.
Do not create false catalog relationships or relabel imported rows as native
submissions. Source URLs are available through unobtrusive “Original review” links.

## Manual external-review refresh

`scripts/refresh-written-reviews.mjs` combines the existing collector and importer
with a fresh private database backup and an isolated restore/import check. It is
a manual maintenance command; no schedule, background service, or new paid
dependency is enabled. Use an already authorized `DATABASE_URL` supplied through
the environment or a private environment file.
The command uses the corresponding direct Neon endpoint for maintenance while
leaving the application's pooled environment variable unchanged. The expected
host flag must still match the supplied `DATABASE_URL` hostname exactly.
Use Node with native WebSocket support. Maintenance holds one session connection
and reads each table sequentially inside the consistent backup transaction,
avoiding the aggregate result-size cap of Neon's HTTP transport. Connections
have bounded timeouts and close when the command completes or fails.

Start a fresh recovery and inspect the plan:

```bash
node --env-file=.env.local scripts/refresh-written-reviews.mjs --recover
```

Each `--recover` creates a new private snapshot folder. An optional
`--output /path/to/new/private/folder` must name a folder that does not already
exist. Only `--resume /path/to/private/recovery` reuses completed checkpoints from
an interrupted recovery. To inspect a completed snapshot again, use
`--snapshot /path/to/private/recovery`; it does not contact the source provider.

The default is a dry run. It backs up every public database table, including
source documents, private correction reports, relationship evidence, and
migration metadata, under one read-only repeatable-read snapshot. Backups and
reports stay outside Git with private permissions. Compressed-file,
uncompressed-content, and per-table checksums are verified, then every captured
column is restored into disposable local Postgres before an import is tested.
New schema columns use their defaults; existing native source rows stay intact.

After reviewing the private plan, apply that exact snapshot to the intended host:

```bash
node --env-file=.env.local scripts/refresh-written-reviews.mjs \
  --snapshot /path/to/private/recovery \
  --apply --expect-sha256 EXACT_SNAPSHOT_DIGEST --expected-host EXACT_DATABASE_HOST
```

Applying makes another fresh backup and repeats the isolated test before any
remote changes. Missing source profiles, removed published comments, and lost
course/professor links block publication. The affected source IDs are written to
the private `coverage-plan.json`. An owner may approve a reviewed coverage change
only with `--approve-coverage-change-sha256 EXACT_SNAPSHOT_DIGEST`. Disappeared
records are retained in storage and unpublished rather than deleted. Review
text, class codes, dates, and original source JSON are preserved.
An older source snapshot also cannot replace the newest verified source snapshot
without that exact approval digest for a deliberate rollback.

After an applied refresh, [purge the production Data Cache and CDN cache](DATA_FRESHNESS.md)
and verify course, professor, and archive counts. The command does not operate
Vercel or create an automatic refresh job. Retain the verified backup and source
snapshot independently of the working checkout.
