# Anonymous reports and submission protection

Every written review has a **Report review** link. `/contact` also accepts private site issues and suggestions; course and professor correction links preselect the relevant record. Reports do not automatically unpublish, alter, or delete any review. The owner reviews them manually.

The database stores only a random report ID, public record reference, reason, message, status, and timestamps. It does not save a reporter name, email address, account, student ID, IP address, cookie, user agent, or browser fingerprint. The form asks people to omit identifying details and rejects common email, phone, and external-link patterns. Free text cannot guarantee anonymity if someone includes other identifying details, so handle the private queue accordingly. Hosting providers still process ordinary security information as described in the privacy policy.

## Owner workflow

The queue has no public GET endpoint or browser admin page. Use an authorized database connection from the owner's existing private environment:

```sh
node --env-file=/path/to/private/production.env scripts/manage-reports.mjs
```

This exports the oldest 100 open reports into a new private temporary folder and prints only its path and count. Report text is not printed to terminal logs. Keep that file out of Git and delete it after review. Resolve or dismiss a reviewed report with the exact database hostname as a write guard:

```sh
node --env-file=/path/to/private/production.env scripts/manage-reports.mjs --resolve REPORT_ID --expected-host VERIFIED_DATABASE_HOST
node --env-file=/path/to/private/production.env scripts/manage-reports.mjs --dismiss REPORT_ID --expected-host VERIFIED_DATABASE_HOST
```

These commands change the report's status only. Any catalog correction or review moderation is a separate, reviewed operation; preserve original source documents. If 100 reports were exported, process that batch and export again to reach later open reports. Reports stay stored after resolution; the tool does not delete them or contact anyone. No response-time or notification promise is made in the interface.

## Application protections

- POST bodies must be JSON and are bounded while reading, even without a trustworthy Content-Length header. Cross-site browser submissions are rejected. These checks reduce drive-by abuse but are not authentication or a complete bot defense.
- Existing honeypot, contact/link validation, and exact content-derived duplicate protection remain. No user-derived identifier is added.
- A transaction lock on a public course/professor pair enforces a generous limit of 50 successful anonymous reviews per minute for that pair across server instances. A 429 response includes `Retry-After: 60`. This is a short circuit for a burst, and could briefly delay legitimate students during an unusually concentrated campaign.
- Recent near-duplicate detection is limited to the same course, professor, and semester, and only the last 24 hours of published anonymous submissions. It compares at most 100 recent comments. Normalized exact text is rejected; fuzzy comparison requires at least 80 normalized characters, similar lengths, and 0.96 trigram similarity. Other semesters, courses, and professors remain independent. Small wording differences that convey a distinct experience should remain allowed.
- Reports validate references against currently public reviews and catalog records. Repeated identical open reports are acknowledged without creating duplicates. A private-queue limit of 120 new reports per minute returns 429 with `Retry-After: 60`.
- Database creation, course/professor lookup, and write failures return bounded public errors without logging submitted content or connection credentials. Writes are attempted once; a lost response is not automatically retried.

## Deployment protection

The read-only October 14, 2026 inspection of Giulia's Vercel project found an enabled firewall, one crawler-deny rule, and managed security rules in log mode. There was no POST submission rate-limit rule. That snapshot is not a guarantee of current configuration. Provider-level POST-only rate limits complement app checks and can stop abuse before it reaches the database. They must be scoped and reviewed without adding paid services; the application does not store a client IP or provider counting key.
