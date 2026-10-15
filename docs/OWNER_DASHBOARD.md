# Owner dashboard

EagleEvals keeps public review submissions anonymous. The private owner dashboard
uses Giulia's verified GitHub identity to read reports and manage corrected
review associations. Owner actions record the owner's immutable GitHub numeric
ID; anonymous reports and reviews do not receive an account, email, IP address,
student identifier, or browser fingerprint.

## Sign-in setup

Register a GitHub OAuth application while signed into the owner account at
[GitHub OAuth application settings](https://github.com/settings/applications/new).
Use `EagleEvals owner` for its name, `https://eagleevals.com` for the homepage,
and `https://eagleevals.com/api/owner/auth/callback/github` for its callback.
It needs basic GitHub identity access, not repository access.

Set these **server-only production** environment variables in the linked Vercel
project; never paste client secrets into a commit, issue, or public document:

| Variable | Value |
| --- | --- |
| `OWNER_AUTH_URL` | `https://eagleevals.com` |
| `OWNER_GITHUB_ID` | The owner's immutable numeric GitHub account ID |
| `OWNER_AUTH_SECRET` | A generated random session secret, at least 43 characters |
| `OWNER_GITHUB_CLIENT_ID` | OAuth application's client ID |
| `OWNER_GITHUB_CLIENT_SECRET` | OAuth application's client secret |

The first three values can be installed before the OAuth app is configured.
Missing or invalid configuration keeps all owner access closed. Redeploy after
setting the application credentials, then visit `/owner` and complete GitHub
authorization personally. Previews keep owner sign-in disabled unless they have
their own explicit origin and separately configured OAuth application.

Sign-in uses encrypted one-hour cookies with no authentication database.
Signing out clears this browser's cookies; an already copied cookie expires
after one hour or stops working when the session secret is rotated. Owner
credentials and sessions are separate from the anonymous submission flow.

## Implementation scope

| Complexity | Decision |
| --- | --- |
| Essential | Private report triage, confirmed associations, optimistic conflicts, and an audit history |
| External constraint | GitHub OAuth state, identity verification, and secure session cookies use Better Auth |
| Transitional | Recovery retains original records while explicit overlays correct public associations |
| Unknown | Campaign response and Google indexing need dated measurements, not forecasts |
| Avoided implementation work | No additional auth database, student accounts, queue, paid tracking, or new backend service |

## Access and private data

The server verifies the owner session before every dashboard/API request and
again in the data access layer. Owner access depends on the configured GitHub
numeric ID, rather than a display name or an email address. Never add these
private responses to the shared public cache. Owner routes use private/no-store
response headers and are excluded from indexing.

`anonymous_reports`, `review_association_overrides`, `owner_actions`, and
`owner_growth_baselines` are private management tables. They are not public
review feeds. Do not publish report text, audit records, growth exports, auth
secrets, or database backups in this public repository. Local owner exports
belong in ignored output files with restrictive file permissions.

## Report queue

Reports can be open, resolved, or dismissed. Resolving or dismissing sets
`resolved_at`; reopening clears it. Each action requires a reason and the
version the owner viewed. A concurrent update makes the old version fail with
a conflict rather than overwrite a newer decision.

Status changes create an append-only audit record. They do not delete the
report or edit its original target, reason, or message. Resolving a report does
not automatically change or remove a public review; the owner makes an explicit
association correction separately when the evidence supports it.

## Association corrections

Search for a public review by its exact ID, a phrase, professor, or course. The
unmatched filter finds written reviews with a missing professor or course link.
It does not prove that every existing link is correct. Course and professor
candidates come from the catalog; historical archive entries retain their
provenance and do not imply a currently offered course or current faculty member.

A correction requires the selected professor, selected course or an explicit
missing course, a reason, an HTTP/HTTPS evidence URL, and the review fingerprint
shown to the owner. Confirm the original evidence before saving. Existing
catalog IDs are checked in the database. Public names and IDs are resolved from
the override first, then from verified professor aliases.

The fingerprint covers the current public review and override version. A stale
fingerprint returns a conflict and requires reloading the review. Changes to
catalog names or aliases can also invalidate that fingerprint.

Corrections are overlays in `review_association_overrides`. They do not modify
original comments, numerical evaluation rows, imported source JSON, source IDs,
source professor URLs, or source snapshots. The written-review feed and its
course/professor counts follow the effective links. When a native comment is
explicitly paired with a numerical evaluation, its public numerical record and
counts follow the same corrected links. Numerical values and source rows remain
intact; unpaired archived evaluations retain their original associations.

The existing context note stays in place unless the owner explicitly chooses
to replace it after reviewing proof. An explicit replacement may supply a new
note or clear it. A later action that preserves context retains that reviewed
note. Course unlinking removes the effective catalog code/title from that
review; original source fields remain intact in the archive.

## Atomic actions and retries

Every mutation includes a client-generated UUID action ID. The database locks
that ID, computes a request hash from the complete mutation and authenticated
owner ID, checks the optimistic version/fingerprint, applies the change, and
writes its audit entry in one transaction. Review corrections also lock the
individual review. Report status changes lock the report row.

Retry an uncertain request with the **same action ID and identical payload**.
A matching retry returns the saved result with `replayed: true`; it does not
apply the change twice. Reusing the ID for different input returns a conflict.
After editing a request or reloading a changed record, generate a new action ID.
Audit records reject updates and deletes through the application database path.

The overview also shows published native submissions over rolling seven- and
28-day windows, the latest native submission time, written-review link coverage,
and the oldest open report. Native freshness uses `submitted_at` for
`eagleevals_anonymous` records; imported reviews do not inflate these counts.

## Growth baselines

Owner growth snapshots contain dated production aggregates and source URLs.
Their boundaries are inclusive UTC starts and exclusive UTC ends. Visitors are
a provider-reported measure, not verified distinct students. Own-use, sampling,
missing metrics, and access gaps remain explicit in the dataset.

A baseline ID cannot silently replace a different saved measurement. Actual
traffic and performance numbers appear only in the protected dashboard and
private exports. Public collection methods and field definitions live in
[GROWTH_BASELINE.md](GROWTH_BASELINE.md). Search Console values remain unavailable
until an authorized owner session supplies them; Vercel referrals cannot fill
that gap.

## Verification

Run `node --test scripts/owner-management.test.mjs` for isolated fixtures covering
owner authorization, input validation, conflict handling, request replay,
source preservation, context handling, report reopening, audit immutability,
private growth snapshots, and historical course provenance. Run the complete
migration test suite before applying migration 008. Never submit test reports,
reviews, or corrections to the live site.
