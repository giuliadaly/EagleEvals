# EagleEvals

EagleEvals is a student-run Boston College course and professor evaluation
site. This repository is the clean replacement for the legacy Angular and
Express application.

Production domain: [eagleevals.com](https://eagleevals.com)

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Vercel for hosting and deployment
- Neon Postgres through the Vercel Marketplace for restored evaluation data

## Current product

The production application includes:

- autocomplete and directory search tolerant of course-code spacing, punctuation, and small name/title typos
- paginated course and professor directories
- a paginated, searchable view of every public historical evaluation row
- a paginated, searchable view of every public written comment
- course ratings, workload estimates, same-course comparison of two or three professors, comments, and semester history
- written-review filters by course/professor and ordering by post date or known semester taken
- per-detail canonical URLs and a complete course/professor sitemap
- professor ratings, course history, public faculty details, and comments
- fully anonymous review submission with no account or identity fields
- recovery context, privacy information, terms, loading, error, and missing-record states

## Local development

Use Node.js 20 or newer and pnpm:

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm lint
pnpm build
pnpm test:migration
pnpm db:migrate:schema
```

## Data migration boundary

Recovered legacy data is intentionally stored outside this repository. Do not
commit database exports, source-feed snapshots, cached API responses, or user
identifiers. Migration code and database schemas may be committed later, but
the data itself must remain in the separate temporary recovery directory until
it is imported and independently backed up.

### Migration workflow

The migration accepts only an absolute path to an isolated recovery snapshot.
It verifies every gzip checksum, record count, foreign-key relationship, rating
range, and comment-anonymization invariant before connecting to Postgres. It is
idempotent: rerunning the same snapshot updates its rows and performs the same
database verification again.

After the Vercel Marketplace database has supplied `DATABASE_URL`:

```bash
pnpm db:migrate:recovered -- \
  --snapshot /Users/giuliadaly/workplace/eagle-eval/recovered-data/2026-08-13

pnpm db:verify -- \
  --snapshot /Users/giuliadaly/workplace/eagle-eval/recovered-data/2026-08-13
```

The schema preserves the original source object in a JSONB column while also
normalizing fields needed for the Next.js search, course, and professor pages.
Exact legacy professors are stored separately from the current public faculty
directory supplement. The discovery archive is retained for reconciliation
but is not inserted as a second set of reviews.

Successful migration writes `manifests/database-verification.json` into the
recovery snapshot and marks only the database-migration gate as verified. The
snapshot remains blocked from deletion until the independent provider backup,
restore test, and deployed-page checks also pass.

### Anonymous submissions

The application stores new ratings, metric responses, and written comments in
the same normalized tables while keeping them distinguishable from recovered
legacy rows. It does not request or persist a name, account, email, student ID,
IP address, user agent, cookie identifier, or browser fingerprint with a
review. Exact duplicate payloads are rejected with a content-only fingerprint.

New reviews require a course, professor, semester, two overall ratings, a short
comment, and one confirmation of first-hand experience and the guidelines.
Section, take-again preference, and the nine detailed ratings are optional.
Unanswered details are stored as SQL NULL, excluded from category averages,
and never displayed as a negative take-again response or a numbered section.

Before deploying the simpler form, apply `003_optional_review_details.sql` via
`node scripts/allow-optional-review-details.mjs` in each database environment.
This scoped rollout command verifies the three nullable columns. The migration only
relaxes required-value constraints and preserves existing data; it is also
compatible with the previous form during rollout.

## Deployment

Import this GitHub repository into Vercel. Vercel detects Next.js without a
custom build configuration. Connect `eagleevals.com` only after the production
database and core search routes have been verified.

### Review context and comparison rollout

Before deploying review navigation, run `node scripts/link-review-context.mjs`
in each target database environment. It applies only the additive migration
`004_comment_review_context.sql`, with a five-second lock timeout. The previous
application remains compatible. New comments link to their own anonymous
rating submission; historical comments remain unlinked and display “Semester
not recorded.” Never infer a semester from a comment's posting date.

The form offers recent terms and an earlier-semester picker back to 2000.
Known professors are suggestions; any catalog professor can still be selected.
The success screen links to the published pages and offers a fresh review form.

Comparison lives at `/courses/[id]/compare` and accepts two or three distinct
`professor` parameters. All averages, counts, latest terms, and written reviews
are scoped to that course. It does not claim current teaching availability.
Custom share previews and lower-homepage design changes remain deferred;
see [FOLLOW_UPS.md](FOLLOW_UPS.md).
