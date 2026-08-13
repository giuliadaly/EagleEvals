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
- Postgres through a Vercel Marketplace integration for restored evaluation
  data (provider to be connected before the migration)

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
```

## Data migration boundary

Recovered legacy data is intentionally stored outside this repository. Do not
commit database exports, source-feed snapshots, cached API responses, or user
identifiers. Migration code and database schemas may be committed later, but
the data itself must remain in the separate temporary recovery directory until
it is imported and independently backed up.

## Deployment

Import this GitHub repository into Vercel. Vercel detects Next.js without a
custom build configuration. Connect `eagleevals.com` only after the production
database and core search routes have been verified.
