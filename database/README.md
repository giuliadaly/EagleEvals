# EagleEvals database

The production database is Postgres provisioned through the Vercel Marketplace.
The application uses the official Neon serverless driver and reads its
connection string only from the server-side `DATABASE_URL` environment
variable.

## Restored and supplemental data

The schema deliberately keeps two professor sources separate:

- `professors` contains exact, publicly reachable legacy EagleEval documents.
- `faculty_directory_entries` contains current public Boston College directory
  listings from the available school feeds. These records are optional
  enrichment and are not presented as recovered historical rows.

Every restored table retains its full original document in a JSONB column in
addition to normalized fields. Legacy identifiers remain the primary keys so
the migration is traceable and old relationships stay exact.

## Rerun behavior

The importer applies `database/migrations/001_initial.sql`, upserts one
snapshot in dependency order, and verifies the database before marking the run
successful. A failed or interrupted import can be rerun with the same command.
The original compressed archives remain the source of truth until the provider
backup and restore gates pass.

## Verification gates

Database verification requires:

- exact counts for courses, professors, reviews, review metrics, comments, and
  the current faculty supplement;
- preserved legacy IDs in every source JSON document;
- no retained comment `user_id` fields; and
- no values outside the original 1–5 evaluation scale.

Foreign keys and uniqueness constraints additionally prevent broken restored
relationships and duplicate identifiers from entering the database.
