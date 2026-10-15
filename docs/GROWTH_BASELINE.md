# Growth measurement methodology

This public document describes how to measure EagleEvals traffic, performance,
and search visibility. Actual traffic and performance measurements belong in
the protected owner dashboard and private owner exports. Do not commit those
exports, credentials, visitor identifiers, or private account information.

## Dataset fields

Each owner baseline has an `id`, a UTC `measuredAt` timestamp, production scope,
source URLs, and these sections:

| Field | Meaning |
| --- | --- |
| `traffic.period` | Current comparison window: inclusive UTC `start`, exclusive UTC `end` |
| `traffic.current` | Provider-reported `visitors` and `pageViews` for that window |
| `traffic.previous` | Previous equal-length window, its boundaries, and its totals |
| `traffic.last28Days` | Complete trailing four-week window and its totals |
| `traffic.notes` | Coverage, maintainer activity, and interpretation limits |
| `speedInsights.period` | Performance measurement window |
| `speedInsights.metrics` | Whole-window p75, data-point count, and unit for each metric |
| `speedInsights.devices` | Device-specific measurements with explicit missing values |
| `searchConsole.available` | Whether an authorized owner session supplied search data |
| `searchConsole.reason` | Why data is unavailable, if applicable |
| `sources` | Provider, dashboard, and public-check URLs supporting the baseline |

Use `null` for unavailable values. A missing metric is different from a measured
zero. Keep the capture date separate from the measurement window; a baseline
may be collected after its final complete day.

## Traffic collection

Verify Giulia's Vercel account and the `giulia-daly/eagle-evals` project before
reading private reports. Use the existing Web Analytics API with a production
filter. Do not enable a new paid product to collect a baseline.

The traffic source is `GET /v1/query/web-analytics/visits/aggregate` with the
project and team scope, `since`, `until`, and
`filter=environment eq 'production'`. For period totals, use `by=environment`
and read the production row. Retain the normalized window boundaries returned
by the API. Compare complete UTC days and equal-length windows.

Optional breakdowns use `by=day`, `deviceType`, `referrerHostname`, or `route`.
Record the grouping and result limit with the source evidence. Route and
referrer visitor groups can overlap; do not add their visitors to reconstruct
the period total. A blank referrer does not establish acquisition channel.
Google-referrer traffic is different from Search Console clicks or queries.

Reported visitors are a privacy-preserving provider measure, not a verified
count of distinct students. Browser blocking, device changes, measurement
coverage, and maintainer QA affect interpretation. Record own-use limitations
without adding identities or attempting to reconstruct individual visits.

## Performance collection

Read existing production Speed Insights through `/v2/observability/query` with
the same project and fixed UTC window. This POST endpoint runs aggregate
queries; it does not require creating new telemetry or a subscription.

| Metric | Value query | Count query | Unit |
| --- | --- | --- | --- |
| Largest Contentful Paint | `vercel.speed_insights.lcp_ms`, p75 | `vercel.speed_insights.lcp_count`, sum | milliseconds |
| Interaction to Next Paint | `vercel.speed_insights.inp_ms`, p75 | `vercel.speed_insights.inp_count`, sum | milliseconds |
| Cumulative Layout Shift | `vercel.speed_insights.cls`, p75 | `vercel.speed_insights.cls_count`, sum | unitless score |
| First Contentful Paint | `vercel.speed_insights.fcp_ms`, p75 | `vercel.speed_insights.fcp_count`, sum | milliseconds |
| Time to First Byte | `vercel.speed_insights.ttfb_ms`, p75 | `vercel.speed_insights.ttfb_count`, sum | milliseconds |

Read the whole-period `summary`; do not average daily percentiles. Use
`groupBy: ["device_type"]` for device coverage. Pair every percentile with its
corresponding count and preserve `null` when no data points were collected.
Record the SDK sampling configuration from `src/components/site-telemetry.tsx`
at capture time.

Data points are measurements, not people or completed review submissions.
Small samples and device mix limit comparisons. These metrics do not establish
animation frame rate or prove availability. Dashboard-only values such as Real
Experience Score stay unavailable unless read in the authorized owner session.

## Public crawlability checks

For a dated crawl check, request the homepage, `robots.txt`, and `sitemap.xml`.
Confirm successful responses, canonical HTTPS hostname, general crawler access,
sitemap declaration, unique URLs, and expected course/profile paths. Historical
imported review profiles are valid profile URLs, but are not a faculty headcount.

Public checks on October 15, 2026 at 00:29 UTC found the canonical homepage,
robots file, and sitemap responding successfully. The sitemap contained 6,933
unique URLs: 4,250 course URLs and 2,656 professor/profile URLs. All used the
canonical HTTPS hostname. A Google verification meta tag was present.

These are crawl signals; they do not prove Google accepted verification,
processed the sitemap, indexed the pages, or improved rankings.

- [Homepage](https://eagleevals.com/)
- [robots.txt](https://eagleevals.com/robots.txt)
- [sitemap.xml](https://eagleevals.com/sitemap.xml)

## Search Console checks

Use Giulia's verified session and confirm the displayed account before opening
the [EagleEvals Search Console property](https://search.google.com/search-console?resource_id=https%3A%2F%2Feagleevals.com%2F).
If login or ownership verification is needed, give the owner the link and let
her complete it. Do not infer ownership from the public meta tag.

Record the property's ownership status, submitted sitemap and last processing
result, indexed/excluded pages, and search performance for an explicit date
range. Search performance includes impressions, clicks, CTR, average position,
queries, and landing pages. Mark each unavailable field explicitly; do not
substitute Vercel referrals or public search observations for these measures.

## Comparison limits

Keep original windows fixed for later comparisons. Traffic increases across a
maintenance-heavy period do not establish sustained student growth or prove
that a particular deployment caused the change. Check conversion or completion
time only when that measurement actually exists and its privacy implications
have been approved; do not infer either from page views.

Source definitions: [Web Analytics queries](https://vercel.com/docs/analytics/web-analytics-api),
[aggregate parameters](https://vercel.com/docs/rest-api/web-analytics/aggregates-page-views),
[Speed Insights metrics access](https://vercel.com/docs/speed-insights/accessing-metrics-with-vercel-cli).
