# EagleEvals

**A little advice before you register.**

[EagleEvals](https://eagleevals.com) is an independent resource for Boston College
students to find courses, compare professors, and share anonymous reviews.
No account needed. Not affiliated with or operated by Boston College.

[Explore courses](https://eagleevals.com/courses) ·
[Find a professor](https://eagleevals.com/professors) ·
[Write a review](https://eagleevals.com/review)

## What you can do

- Search courses and professors as you type, including spaced course codes and small typos.
- Read student reviews alongside numerical ratings, workload details, and semester history.
- Compare two or three professors for the same course.
- Filter written reviews by professor or course and sort by posting date or known semester.
- Leave an anonymous review with two overall ratings and a short comment; detailed ratings are optional.
- Share course and professor pages with their own branded previews.

The archive includes recovered reviews from the original **EagleEval** and new
EagleEvals submissions, labeled by source. Historical numerical records summarize
course sections and may have no written feedback. Rating counts and written-review
counts are shown separately.

## Development

Built with Next.js App Router, React, TypeScript, and Tailwind CSS. Data lives in
Neon Postgres; the site is deployed on Vercel.

Use Node.js 22 or newer and the pnpm version specified in `package.json`.

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
pnpm build
```

The tests cover database migration, anonymous submissions, search, and review
context. A production build needs access to the configured database.

## Deployment and project notes

Pull requests receive Vercel previews. Merging into `main` deploys to
[eagleevals.com](https://eagleevals.com). Verify schema compatibility before
deploying a change that depends on a database migration.

- [Database setup, recovery, and anonymous review storage](docs/DATABASE.md)
- [SEO and privacy-conscious telemetry](docs/SEO_AND_TELEMETRY.md)
- [Design direction](DESIGN.md)
- [Privacy](https://eagleevals.com/privacy) and [terms](https://eagleevals.com/terms)

Keep credentials, database exports, recovery snapshots, and identifying student
data out of commits and issue reports. Paid services and additional metered
tracking require the owner's approval.
