# Public data caching and crawler controls

Public queries use Next.js's existing Data Cache. No new service or database
migration is required. Requests without changes can reuse their query results,
letting Neon spend more time suspended between real database work.

## Freshness contract

- Review-dependent queries have a one-hour fallback lifetime and share the
  `eagleevals-public-reviews` tag. This includes detail pages, browse pages,
  comparisons, archive counts, homepage statistics, search results and counts,
  and known course/professor pairings.
- After the review transaction commits, the POST handler immediately expires
  that tag with `revalidateTag(tag, { expire: 0 })`. The next request waits for
  fresh data instead of serving an old result while refreshing in the background.
  A broad review tag deliberately covers cross-course professor summaries.
- Failed submissions do not expire the cache. Submissions themselves are never
  cached. The success links load fresh HTML, and the client refreshes its router
  cache and suggestion counts after a successful write.
- Course/professor names and catalog paths can be cached for 24 hours. Instant
  search downloads names separately from changing review counts. Counts use an
  uncached HTTP response backed by the invalidatable server cache. They refresh
  on mounting search, returning to the tab, and the student's own submission.
  An already-open page is not a live subscription to other students' submissions.
- Search still filters locally from the first letter. Missing counts stay blank
  until available; they are never presented as zero. Fuzzy fallback searches
  have no browser/CDN cache that could outlive server invalidation.

Database writes outside the submission endpoint (imports, moderation, manual
corrections) **must purge the production Data Cache and CDN cache after completion**
using Vercel's project cache settings or [`vercel cache purge`](https://vercel.com/docs/cli/cache) from the
linked project. A catalog correction may remain in an already-open browser's
24-hour names cache; force-refresh that browser when verifying the correction.
Do not rely on redeployment alone: Next's Data Cache can survive deployments.
Any future editing or moderation endpoint must call the same expiration helper.

## Query work

The ratings archive sorts and selects only the requested review page before
joining detailed metric columns. Its filtered total is cached independently of
the page number. It retains source priority, submitted date, semester, course,
and section ordering, with ID as a deterministic tie-breaker.

## Crawler controls

Vercel's project rule **Reduce bulk catalog crawling** denies user agents matching
`meta-externalagent`, `Amazonbot`, `panscient`, or `MJ12bot` (including observed case
variants). These were high-volume crawlers in the usage investigation. The same
agents are disallowed in `robots.txt`; robots alone is advisory.

This is a narrow user-agent rule, not identity verification or comprehensive bot
protection. Google, Bing, `facebookexternalhit`, and `Twitterbot` are not matched.
Blanket AI-bot denial and general browser challenges remain off. No paid bot
analysis or plan upgrade was enabled. The rule can be disabled in the project's
Firewall → Rules page, then published, independently of a code deployment.

## Verification

Run `pnpm test:migration` for SQL, submission, and search contracts. Run
`pnpm test:cache` for the actual production build and server against isolated
PGlite Postgres. It intercepts only a fake fixture database URL, makes no Neon
calls, and checks repeated reads and immediate post-write freshness. Its
`.next` build contains fixture data: rebuild normally for any manual deployment;
never deploy that fixture output with `--prebuilt`.

Use `node scripts/check-cache-freshness.mjs --keep-server` for local browser
checks at localhost:3134. Stop it with Ctrl-C when finished.

Actual compute savings depend on traffic and remaining unique page visits.
Compare Neon compute use and Vercel crawler traffic over similar periods;
these changes cannot recover compute hours already consumed.
