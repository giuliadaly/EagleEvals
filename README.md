# EagleEvals (Eagle Evals)

**Independent Boston College course and professor reviews.**

*A little advice before you register.*

[EagleEvals](https://eagleevals.com) is an independent resource for Boston College
students to find courses, compare professors, and share anonymous reviews.
No account needed. Not affiliated with or operated by Boston College.

**Live website: [eagleevals.com](https://eagleevals.com)**

[Explore courses](https://eagleevals.com/courses) ·
[Find a professor](https://eagleevals.com/professors) ·
[Write a review](https://eagleevals.com/review) ·
[Pass a little advice on](https://eagleevals.com/contribute)

## What you can do

- Search courses and professors as you type, including spaced course codes and small typos.
- Read student reviews alongside numerical ratings, weekly effort on a 1–5 scale, and semester history.
- Compare two or three professors for the same course.
- Search written reviews for exam tips and other details, filter by professor or course, and sort by posting date or known semester.
- Leave an anonymous review with two overall ratings and a short comment; detailed ratings are optional.
- Share course and professor pages with their own branded previews.
- Report a review or request a correction through a private, anonymous form.

The archive includes recovered reviews from the original **EagleEval** and new
EagleEvals submissions. Historical numerical records summarize
course sections and may have no written feedback. Rating counts and written-review
counts are shown separately.

Written feedback appears in one collection across course pages, professor pages,
comparisons, search counts, and the review archive. The collection includes a
recovered Boston College Rate My Professors snapshot. Original documents and IDs
remain separate internally; external ratings are not mixed into numerical evaluation
averages. Imported archive profiles keep unmatched instructors' comments findable,
and unverified course codes remain visible in the review archive. Archive profiles
do not imply a verified current faculty appointment.
Verified older course codes are linked using official catalog evidence. Historical
courses missing from the recovered catalog have clearly marked archive pages;
they do not imply a current offering.

## Development

Built with Next.js App Router, React, TypeScript, and Tailwind CSS. Data lives in
Neon Postgres; the site is deployed on Vercel.

Use a current Node.js 22 LTS release or newer and the pnpm version specified in
`package.json`.

```bash
git clone https://github.com/giuliadaly/EagleEvals.git
cd EagleEvals
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to a development Neon database with the current
schema and catalog data. Database credentials and recovery data are not included
in this repository. See [database setup and recovery](docs/DATABASE.md).

```bash
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

## Checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test:migration
python3 -B scripts/recover-rmp-reviews.test.py
pnpm build
```

The tests cover database migration and restoration, preserved source records,
course/professor associations, anonymous submissions and reports, search,
keyboard controls, review context, and effort ratings. The Python recovery tests
require Python 3.10 or newer. A production build needs access to the configured
database.

`pnpm test:cache` builds and runs the application against an isolated fixture
database to check fresh submissions and caching without production writes.
Its build output contains fixture data; rebuild normally before any manual deployment.

## Deployment and project notes

Pull requests receive Vercel previews. Merging into `main` deploys to
[eagleevals.com](https://eagleevals.com). Verify schema compatibility before
deploying a change that depends on a database migration.

- [Data freshness, cache checks, and crawler controls](docs/DATA_FRESHNESS.md)
- [Database setup, recovery, and anonymous review storage](docs/DATABASE.md)
- [Anonymous reports, moderation, and submission protection](docs/MODERATION.md)
- [SEO and privacy-conscious telemetry](docs/SEO_AND_TELEMETRY.md)
- [Private owner dashboard and correction audit](docs/OWNER_DASHBOARD.md)
- [Anonymous review campaign drafts](docs/REVIEW_CAMPAIGN.md)
- [Growth measurement methodology](docs/GROWTH_BASELINE.md)
- [Design direction](DESIGN.md)
- [Privacy](https://eagleevals.com/privacy) and [terms](https://eagleevals.com/terms)

Keep credentials, database exports, recovery snapshots, and identifying student
data out of commits and issue reports. Paid services and additional metered
tracking require the owner's approval.
