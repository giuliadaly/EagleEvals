---
name: EagleEvals Registrar Dossier
description: A BC-rooted, evidence-first course-planning system built from warm paper and ruled records.
colors:
  archive-paper: "#fbf8f1"
  raised-paper: "#fffdf9"
  ledger-paper: "#f1eadc"
  hover-paper: "#ebe1d1"
  carbon-ink: "#2b211f"
  soft-ink: "#544640"
  marginalia: "#74645d"
  bc-maroon: "#8a1830"
  bc-maroon-deep: "#5a1021"
  on-maroon: "#fffaf1"
  evidence-gold: "#c89c37"
  evidence-gold-light: "#e2c36f"
  evidence-gold-dark: "#8b6412"
  evidence-gold-pale: "#f5ecd2"
  ledger-rule: "#ded2c1"
  ledger-rule-strong: "#b8a48c"
  success-ink: "#247252"
  success-paper: "#e7f5ee"
  caution-ink: "#9c3f4b"
  caution-paper: "#fbecef"
typography:
  display:
    fontFamily: "Archivo, Avenir Next, sans-serif"
    fontSize: "clamp(2.35rem, 7vw, 4.75rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Archivo, Avenir Next, sans-serif"
    fontSize: "clamp(1.65rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, Avenir Next, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Atkinson Hyperlegible, Avenir Next, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.48
  label:
    fontFamily: "Atkinson Hyperlegible, Avenir Next, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.04em"
  data:
    fontFamily: "IBM Plex Mono, SFMono-Regular, monospace"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.45
rounded:
  control: "0.375rem"
  filter-panel: "0.75rem"
  information-panel: "1rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
  2xl: "4rem"
  record-end: "5rem"
components:
  button-primary:
    backgroundColor: "{colors.bc-maroon-deep}"
    textColor: "{colors.on-maroon}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.05rem"
    height: "2.75rem"
  button-gold:
    backgroundColor: "{colors.evidence-gold}"
    textColor: "{colors.bc-maroon-deep}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.05rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.raised-paper}"
    textColor: "{colors.bc-maroon-deep}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.05rem"
    height: "2.75rem"
  form-control:
    backgroundColor: "{colors.raised-paper}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.7rem 0.85rem"
    height: "2.85rem"
  directory-filter:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.filter-panel}"
    padding: "1rem"
  professor-card:
    backgroundColor: "{colors.raised-paper}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.control}"
    padding: "1.5rem"
  record-rail:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.control}"
    padding: "1.25rem"
  decision-summary:
    backgroundColor: "{colors.archive-paper}"
    textColor: "{colors.carbon-ink}"
    padding: "1rem"
---

# Design System: EagleEvals Registrar Dossier

## Overview

**Creative North Star: "The Student Registrar's Dossier"**

EagleEvals is a trustworthy student-built registrar: warm, direct, and organized around a real registration decision. It uses ruled evidence, visible counts, and legible comparison instead of a generic review-card wall. Boston College maroon and restrained gold root the experience in its student community without imitating an official University product.

The system moves from a filterable directory into a professor dossier. The directory helps students narrow a large archive; the dossier places the decision signal first, written experience immediately after it, and complete structured evidence below. Imagery is nearly absent because names, comments, scores, terms, and source labels are the material.

**Key Characteristics:**

- Warm ivory paper with dark, high-legibility ink.
- BC maroon for identity and primary actions; muted gold for contextual emphasis.
- Square identity marks, gently rounded controls, and flat ruled records.
- Geometric display type, hyperlegible body type, and monospaced data.
- Dense evidence that linearizes cleanly without losing meaning on mobile.

## Colors

The production palette is a warm paper system with exact hex values, anchored by Boston College maroon and a controlled gold accent.

### Primary

- **BC Maroon:** Brand emphasis, active links, interactive emphasis, and selected states.
- **Deep BC Maroon:** Primary buttons, avatar marks, important data values, and the strongest identity surfaces.
- **On-Maroon Paper:** High-contrast text on maroon fields.

### Secondary

- **Evidence Gold:** The compact global review action and other high-visibility contextual emphasis.
- **Light / Dark Evidence Gold:** Hover and focus variants, plus restrained course-code and label emphasis.
- **Pale Evidence Gold:** Rating badges and soft contextual surfaces; it must not turn a score into a winner badge.

### Tertiary

- **Success Ink / Paper:** Positive “would take again” and successful submission states with explicit text.
- **Caution Ink / Paper:** Negative “would not take again” and caution states with explicit text.

### Neutral

- **Archive Paper:** The site canvas and dossier body.
- **Raised Paper:** Header, controls, cards, and foreground surfaces.
- **Ledger Paper:** Directory filters, supporting records, and the desktop index rail.
- **Hover Paper:** Neutral hover feedback.
- **Carbon Ink / Soft Ink / Marginalia:** Primary copy, explanatory copy, and metadata respectively.
- **Ledger Rule / Strong Ledger Rule:** Row dividers, table boundaries, section breaks, and card edges.

### Named Rules

**The Maroon Means Priority Rule.** Deep maroon carries identity and the principal action. Standard maroon handles links and active emphasis; neither becomes a decorative page wash.

**The Gold Means Context Rule.** Gold draws attention to review actions, rating context, or focus. It never communicates ranking by itself.

**The No Navy Rule.** Navy is not part of the visual world; legacy navy and blue aliases resolve to maroon.

## Typography

**Display Font:** Archivo (with Avenir Next and sans-serif fallbacks)
**Body Font:** Atkinson Hyperlegible (with Avenir Next and sans-serif fallbacks)
**Data Font:** IBM Plex Mono (with SFMono-Regular and monospace fallbacks)

**Character:** Archivo makes professor names and section hierarchy direct without corporate polish. Atkinson Hyperlegible keeps filters, explanations, and comments readable. IBM Plex Mono makes scores, counts, terms, sections, course codes, and index numbers visibly factual.

### Hierarchy

- **Display** (600, fluid `2.35rem–4.75rem`, 1.02): Professor names and page-defining directory titles.
- **Headline** (600, fluid `1.65rem–2.25rem`, 1.08): Dossier evidence sections and empty-state decisions.
- **Title** (700, `1.25rem`, 1.25): Professor and course cards.
- **Body** (400, `1rem`, 1.48): Interface copy and evidence explanations; comments increase to `1.02rem` and 1.65 line height.
- **Label** (700, `0.75rem`, `0.04em`, uppercase for table keys): Form labels, column headings, and mobile data labels.
- **Data** (600, `1.05rem`, 1.45): Scores, counts, course codes, terms, sections, and numbered record links with tabular numerals.

### Named Rules

**The Three-Voice Rule.** Archivo names the record, Atkinson explains it, and IBM Plex Mono carries the evidence. Do not swap those jobs.

**The Data Stays Upright Rule.** Hierarchy comes from weight, scale, rules, and spacing; headings and data are never italicized.

## Layout

The page shell is capped at `92rem`, with `1rem` side gutters on small screens and `2.5rem` from `40rem` upward. Professor directories use one card column by default, two at `40rem`, and three at `64rem`. Their filter panel begins as a vertical stack and becomes a four-part row at `40rem`: professor name, order, minimum rating, and Apply filters.

Directory filters are explicit and URL-backed. Ordering offers Most evaluations by default, Highest instructor rating, Highest course rating, and Name A–Z. Minimum rating offers Any rating, 4.0 and above, and 4.5 and above. The result count remains beside the page purpose, and the empty state tells students how to broaden the query.

The professor page follows one fixed information architecture: professor name and record actions → The decision in one scan → Written comments → Course pairings → Every rating field → Term and section history → optional Faculty details. There is no separate “What came from where” section; source and recency appear inline with the evidence they describe.

The record index is desktop-only. At `64rem` and above it appears as a sticky `15rem` ledger rail and mirrors the exact dossier order. Below `64rem` it is absent, leaving a direct linear reading path. At `40rem`, the decision summary becomes five columns and the metric ledger becomes two. Below `40rem`, the summary becomes two columns, actions fill the width, and five-column tables transform into labeled two-column record rows without horizontal page overflow.

**The Comments-Second Rule.** Written comments follow the decision summary immediately because students need qualitative context before deeper tables.

**The Desktop Index Rule.** The record index aids wide-screen scanning; it must not consume mobile space or duplicate the linear mobile path.

## Elevation & Depth

Professor dossiers are flat. Depth comes from paper tones, strong opening rules, thin row dividers, and the sticky desktop rail. Directory cards use one low resting shadow and a restrained hover lift because they are navigation objects; record sections, comments, tables, and ledgers remain unshadowed. Search suggestions may use a larger transient shadow because they float above the page.

### Shadow Vocabulary

- **Directory Rest:** `0 1px 2px rgba(43, 33, 31, 0.045)` for browsable course and professor cards.
- **Directory Hover:** `0 12px 30px rgba(43, 33, 31, 0.08)` paired with a `-2px` lift.
- **Search Overlay:** A transient large shadow at ten-percent black for autocomplete results.

### Named Rules

**The Ruled-Not-Floated Rule.** Stable evidence is separated by rules and paper tones. Elevation belongs to navigation cards and overlays, not the dossier body.

## Shapes

The core form language uses compact `0.375rem` corners for marks, controls, cards, rating badges, and the record rail. The directory filter groups related controls inside a `0.75rem` container. Larger `1rem` information panels remain a secondary legacy-compatible treatment and should not spread into the dossier.

Pills are reserved for compact binary or source statuses such as “Would take again,” never for general navigation or every metadata item. The eagle-E mark and dossier avatars stay square rather than circular. The original gold eagle silhouette forms the letter’s middle arm and remains simple enough to read at favicon size.

**The Square Record Rule.** Professor records should read as documents, not soft lifestyle cards. Avoid inflated radii and repeated pill containers.

## Components

### Buttons

- **Primary:** Deep maroon, on-maroon text, `0.375rem` corners, and at least `2.75rem` height for submit, compare, and review actions.
- **Gold:** Evidence gold with deep-maroon text for the compact global Write review action.
- **Secondary:** Raised paper, a strong ledger-rule border, and deep-maroon text for supporting actions such as All evaluations.
- **Hover / Focus / Disabled:** Hover changes color or paper tone; keyboard focus uses a visible `2px` outline with `3px` offset. Disabled controls retain structure and reduced emphasis.

### Inputs / Fields

- **Style:** Raised paper, strong ledger-rule border, `0.375rem` corners, `2.85rem` minimum height, and explicit labels.
- **Focus:** Gold-dark border plus a soft four-pixel gold ring; global search uses maroon border and the same gold-family ring.
- **Error / Disabled:** Error and disabled states must retain a written message or label, never color alone.

### Cards / Containers

- **Directory Cards:** Flat raised-paper records with strong horizontal rules, compact corners, a square maroon avatar or icon tile, a pale-gold rating badge, evidence count, and directional arrow.
- **Filter Panel:** Ledger paper with strong border and `0.75rem` corners; it groups name, sort, rating threshold, and Apply filters.
- **Dossier Sections:** No card shell. Section spacing and ledger rules define the record.

### Navigation

- **Global Header:** Sticky raised-paper header with the eagle-E mark, optional desktop search, Courses, Professors, desktop-only Evaluations, and a compact gold review action.
- **Desktop Record Index:** Sticky at `64rem`, numbered in IBM Plex Mono, and ordered exactly like the visible dossier. It is hidden below the desktop breakpoint.

### Decision Summary

Five cells share a deep-maroon top and bottom rule at `40rem` and above. Each cell pairs one monospaced value with a plain-language label and a smaller count or recency note. On small screens the cells become a two-column ledger, with the final term cell spanning the row.

### Comments

Comments are ruled text records, not quote cards. Date, course, source, and would-take-again status form a compact metadata line above readable text. Source labels remain inline and written comments never alter structured averages.

### Data Tables and Metric Ledger

Course pairings and term history use aligned five-column tables at larger widths and labeled record rows below `40rem`. The metric ledger uses two columns from `40rem`, keeps missing values visible as “Not collected,” and uses monospaced scores aligned opposite descriptive labels.

## Do's and Don'ts

### Do:

- **Do** preserve the professor order: name → decision summary → written comments → course pairings → every rating field → term and section history → optional faculty details.
- **Do** keep the professor directory filters URL-backed, labeled, and usable by keyboard.
- **Do** put evidence counts, recency, course context, and source labels beside the evidence they qualify.
- **Do** hide the record index below `64rem` and preserve a single linear mobile reading path.
- **Do** keep interactive targets near `2.75rem` high with visible focus states.
- **Do** use rules and spacing as the default organization system for records.

### Don't:

- **Don't** move comments below course, metric, or history tables.
- **Don't** add a separate “What came from where” section; label provenance inline.
- **Don't** replace the dossier with a generic wall of review cards.
- **Don't** use navy, official Boston College marks, or any treatment implying University affiliation.
- **Don't** hide missing data, merge written comments into structured averages, or rely on color alone for status.
- **Don't** introduce decorative gradients, glass effects, pill-heavy navigation, or ornamental shadows into the dossier.
