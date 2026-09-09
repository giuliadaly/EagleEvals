# SEO and telemetry — September 8, 2026

## Decision and scope

Use the existing Next.js application and Vercel project for this iteration. Aidan and Giulia need to know whether students find useful pages, whether the review form works, and whether real devices load the site smoothly. Keep reviews anonymous and all collection optional to the product flow. At the current small-site scale, another analytics service, event database, session replay, or identity system adds maintenance without a demonstrated need.

| Concern | Evidence and owner | Class | Decision and failure boundary |
| --- | --- | --- | --- |
| Search visibility and anonymous contribution | Accepted product outcomes; site maintainers | Essential | Correct crawl signals and measure aggregate actions, with no review contents or identifiers in event properties. |
| Vercel SDKs, visitor hashing, quotas, reporting windows | Existing Pro team and live dashboards | Imported | Reuse Vercel; one telemetry component and typed event boundary. Analytics failure never blocks search or saving. |
| Page-two canonicals pointed at page one; archive canonicals missing | Live HTML audit | Accidental | Correct metadata and preserve crawlable sequential links. |
| Local QA fixtures and initial measurements | This rollout; maintainers | Transitional | Remove local-only fixtures before deployment; establish a production baseline after launch. |
| Google indexing and search queries; actual student completion times | Search Console ownership pending, no completion events yet | Unknown | Verify property ownership, submit sitemap, and collect enough real production traffic before making claims. |

No spending, paid upgrades, or newly introduced metered collection without Aidan's explicit prior cost approval. Custom events were briefly enabled in the initial rollout, but are now paused by default because their usage cost was not explicitly approved. `NEXT_PUBLIC_ENABLE_PRODUCT_EVENTS` must equal `true` at build time to send them; do not set this flag without approval, and rebuild when changing it. The privacy page follows the same flag. Existing page-view analytics remains enabled.

On the verified Pro team, custom Web Analytics events are supported and metered at the existing plan's rate ($0.03/1,000 events at audit time, subject to usage credit). Speed Insights remains on the free tier, sampled at 50%; its free allowance is shared across the team. Detailed performance breakdowns require a separate Plus upgrade, which this change does not enable. Search Console is free.

## SEO audit and changes

The public sitemap returned 6,496 unique URLs before this change: 4,250 courses, 2,237 professors, and nine other pages. Individual entity canonicals already worked, and robots.txt allowed public crawling and named the sitemap. This demonstrates crawlability, not actual inclusion or rankings in Google.

Changes:
- Paginated course/professor directories and review/evaluation archives have a canonical URL for each page, rather than pointing every page at the first.
- Search, custom sort, and rating-filter variants are noindex/follow. Default sort and page-one parameters deduplicate to the clean URL.
- The six subject collections already linked from the homepage have distinct canonicals, descriptions, and sitemap entries. Other arbitrary subject-filter values remain noindex.
- Search titles and descriptions identify Boston College and the review context.
- Visible breadcrumbs also render safe BreadcrumbList JSON-LD. The homepage names EagleEvals with WebSite JSON-LD.
- Existing entity sharing images remain in place. No review-star markup is added: historical counts represent section records, not individual reviewers.

Search Console uses Giulia Daly's Google account and the URL-prefix property `https://eagleevals.com/`. The root layout retains her public ownership-verification meta tag. After it deploys, complete Google's Verify step and submit https://eagleevals.com/sitemap.xml. Inspect the homepage plus a representative course and professor, and use the Performance report to learn which real searches produce impressions/clicks. Do not infer index coverage from a site: search or promise rankings from metadata changes.

## Telemetry definitions

The following custom events are implemented but disabled pending explicit cost approval. Previously collected events may remain in the dashboard.

| Event | Meaning | Properties |
| --- | --- | --- |
| review_started | First change to the form, or an attempted validation/submission; once per form attempt | None |
| review_submitted | Browser received a successful save response | duration: under_1_min, 1_to_2_min, 2_to_5_min, or 5_plus_min |
| review_error | Validation, selection, duplicate, server, or network failure | reason only |
| search_results | Settled suggestions after 800ms without a change, or immediately before submitting/opening a suggestion | outcome: matches, empty, or unavailable |
| search_opened | Course/professor suggestion opened by click or keyboard | kind: course or professor |
| search_submitted | Search submitted or “View all results” followed | None |

The 800ms interval applies only to measurement; search suggestions still filter immediately. These are interaction counts, not unique student counts or a reconstructed user journey. Search events currently cover the shared suggestion box, not the review form's course picker or every archive filter. Repeated identical settled results in the same mounted box are deduplicated. Review duration includes elapsed time and interruptions from first form change to confirmed response. Blockers, closing the tab, connectivity, and response loss can cause undercounting. A retry may produce an error even if the first request was saved; the database remains the source of truth for published review totals. Do not equate submitted/started with an exact individual conversion funnel.

No event properties include review text, search text, ratings, semester, selected course/professor IDs, or review IDs. URL processing keeps recognized public page paths and removes all query parameters and fragments; unknown/private paths are dropped. Public course/professor URLs remain part of ordinary page-view reports. Origin-only referrers avoid forwarding same-site prefill/search URLs to subsequent pages. No custom cookies, persistent IDs, or session recording are introduced. Vercel's existing temporary visitor hash and technical request processing still apply; provider logs are distinct from anonymous review records. Raw database errors are no longer logged on submission failure.

## Reading the results

Use the project's Vercel Analytics dashboard, with production traffic selected, for page views. Custom event collection is paused; only after cost approval and enabling the build flag should maintainers compare review_started, review_submitted, duration buckets, and error reasons over the same date range. Start with weekly totals and a production baseline; tests and your own use can otherwise dominate this small site's numbers. Speed Insights needs real traffic before its score is useful, and is not an animation FPS profiler.

Advance only when evidence supports it: investigate repeated errors first, evaluate completion times after representative submissions, then use Search Console queries to select genuinely useful student-facing content. Consider paid performance breakdowns or another tool only if the free view cannot answer a specific measured problem. Remove unused custom events after the first baseline review rather than accumulating trackers.

## References

- Google pagination: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- Google breadcrumbs: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google site names: https://developers.google.com/search/docs/appearance/site-names
- Vercel redaction: https://vercel.com/docs/analytics/redacting-sensitive-data
- Vercel Web Analytics pricing: https://vercel.com/docs/analytics/limits-and-pricing
- Vercel Speed Insights pricing: https://vercel.com/docs/speed-insights/limits-and-pricing
