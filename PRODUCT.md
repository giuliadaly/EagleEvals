# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are Boston College students choosing classes during registration. They need to make a time-sensitive decision with incomplete information about courses, professors, and sections.

## Product Purpose

EagleEvals helps students find a strong professor and understand what a class is likely to feel like before registering. Success means a student can quickly compare the available evidence, understand important tradeoffs such as challenge and workload, and make a more confident choice without needing to mine long pages of raw records.

## Positioning

EagleEvals combines a preserved historical Boston College evaluation archive with new, fully anonymous student reviews. Its value is school-specific decision support built from course, professor, section, semester, rating, workload, and written-review evidence rather than a generic national professor directory.

## Operating Context

Students typically use the product while planning or registering for classes. Their questions vary by decision: which professor is strongest, how challenging or organized a course is, how much weekly work it takes, whether attendance matters, and how much evidence supports a score.

## Capabilities and Constraints

- Search courses by code, title, or subject and professors by name.
- Browse course and professor directories plus the full public evaluation and comment archives.
- Read course, professor, evaluation, and comment evidence without creating an account or signing in.
- View course and professor averages, category metrics, workload estimates, comments, and semester history.
- Compare professors connected to a course using recovered evaluation data.
- Submit a fully anonymous review with no account or identity fields.
- Existing ratings use a five-point scale.
- Current normalized inputs cover course and instructor overall ratings, attendance necessity, availability outside class, intellectual challenge, organization, explanation clarity, instructor preparation, interest, assignment helpfulness, weekly effort, written comments, and whether the student would take the professor again.
- The product may add new structured review inputs and derived filters, but new claims must be backed by stored data and clearly distinguished from recovered historical fields.

## Brand Commitments

The product name is EagleEvals. It is an independent, student-run Boston College resource. The experience should feel warm, credible, and useful rather than corporate or gimmicky. The visual identity must clearly reflect Boston College's maroon-and-gold color tradition; navy must not be used as a substitute for BC maroon. Because EagleEvals is independent, it must not imply that it is an official Boston College product or use protected University or Athletics marks as its own logo.

## Evidence on Hand

- A verified, publicly reachable historical archive is stored in the production database.
- The recovered records include 4,250 courses, 2,237 professors, 32,417 reviews, 29,009 review-metric rows, and 720 comments.
- The live legacy count exposed 32,614 reviews, so 197 records were not reachable through public relationships and must not be presented as recovered.
- Current public Boston College faculty-directory data is stored separately from exact historical professor records.
- No fabricated testimonials, grades, schedule data, or registration-outcome claims are available.

## Product Principles

1. Start with the registration decision, not the database structure.
2. Show evidence strength and tradeoffs beside every score.
3. Keep recovered historical records, current directory enrichment, and newly submitted reviews visibly distinct by source and recency.
4. Make comparison and filtering first-class, especially within a course's professor options.
5. Keep reading and writing reviews fully anonymous and low-friction.
6. Expand the data model only when a new input creates a useful, explainable student decision signal.

## Accessibility & Inclusion

Core search, filtering, comparison, and review submission must work by keyboard and on small mobile screens. Scores cannot rely on color alone, controls need visible labels and focus states, and motion must respect reduced-motion preferences.
