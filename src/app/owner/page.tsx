import Link from "next/link";
import { headers } from "next/headers";
import { ownerAuth, ownerSession } from "@/data/owner-auth";
import { getOwnerOverview, getOwnerReports, getOwnerReviewLookup, type OwnerOverview, type OwnerReport, type OwnerReview } from "@/data/owner-management";
import { OwnerSignIn } from "@/components/owner-sign-in";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatCount, formatDate } from "@/data/format";
import { OwnerAssociationControls, OwnerReportControls } from "./owner-controls";
import styles from "./owner.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { status?: string; page?: string; q?: string; review?: string; unmatched?: string; reviewsPage?: string; error?: string };
const pageNumber = (value?: string) => value && /^\d+$/.test(value) ? Math.min(500, Math.max(1, Number(value))) : 1;
const finalIncludedDay = (end: string) => formatDate(new Date(Date.parse(end) - 1).toISOString());
function ownerHref(params: Params, changes: Partial<Params>, section: string) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) if (value) query.set(key, value);
  return `/owner?${query.toString()}#${section}`;
}

export default async function OwnerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  let configured = false;
  let actor: Awaited<ReturnType<typeof ownerSession>> = null;
  let authUnavailable = false;
  try {
    configured = Boolean(ownerAuth());
    if (configured) actor = await ownerSession(new Headers(await headers()));
  } catch { authUnavailable = true; }
  if (!actor) return <><SiteHeader /><main className={styles.main}><div className="page-shell max-w-3xl"><p className="eyebrow">Owner workspace</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Keep EagleEvals useful.</h1><p className={styles.notice}>{authUnavailable ? "Owner access could not be verified. Please try again shortly." : configured ? "Sign in with Giulia’s GitHub account to review private reports, check growth, and correct review associations." : "Owner access is not available yet. Please finish setting up owner sign-in."}</p>{params.error ? <p role="alert" className={styles.error}>This workspace is limited to the owner account. Try again with Giulia’s GitHub account.</p> : null}<OwnerSignIn configured={configured && !authUnavailable} /></div></main><SiteFooter /></>;

  const status = ["open", "resolved", "dismissed", "all"].includes(params.status ?? "") ? params.status as OwnerReport["status"] | "all" : "open";
  const reportPage = pageNumber(params.page);
  const reviewsPage = pageNumber(params.reviewsPage);
  const unmatchedOnly = !params.review && params.unmatched !== "all";
  let overview: OwnerOverview | null = null;
  let reports: { reports: OwnerReport[]; total: number } = { reports: [], total: 0 };
  let reviews: { reviews: OwnerReview[]; total: number } = { reviews: [], total: 0 };
  let unavailable = false;
  try {
    [overview, reports, reviews] = await Promise.all([getOwnerOverview(), getOwnerReports({ status, limit: 20, offset: (reportPage - 1) * 20 }), getOwnerReviewLookup({ reviewId: params.review, query: params.q, unmatchedOnly, limit: 20, offset: (reviewsPage - 1) * 20 })]);
  } catch { unavailable = true; }
  return <><SiteHeader /><main className={styles.main}><div className="page-shell">
    <header className={styles.header}><div><p className="eyebrow">Owner workspace</p><h1>Keep the details right.</h1><p>Signed in as {actor.name || "Giulia"}. Reports and growth snapshots stay private.</p></div><OwnerSignIn configured signOut /></header>
    <nav className="flex flex-wrap gap-5 font-semibold text-[var(--maroon)]" aria-label="Owner sections"><a href="#reports">Reports</a><a href="#associations">Review associations</a><a href="#growth">Growth</a><a href="#history">Change history</a></nav>
    {unavailable ? <p role="alert" className={styles.notice}>The private workspace could not load. Please refresh before making changes.</p> : null}
    {overview ? <>
      <section className={`mt-8 ${styles.stats}`} aria-label="Private overview"><div className={styles.stat}><strong>{formatCount(overview.reportCounts.open)}</strong>Open reports</div><div className={styles.stat}><strong>{formatCount(overview.reportCounts.resolved)}</strong>Resolved reports</div><div className={styles.stat}><strong>{formatCount(overview.reportCounts.dismissed)}</strong>Dismissed reports</div><div className={styles.stat}><strong>{formatCount(overview.unmatchedReviews)}</strong>Written reviews with an unmatched course or professor</div></section>
      <section id="reports" className={styles.section}><h2>Private reports</h2><p className={styles.muted}>Resolve, dismiss, or reopen a report after checking it. These actions do not change a review’s publication.</p>
        <form action="/owner#reports" className={styles.filters}><label><span className="form-label">Status</span><select className="form-control" name="status" defaultValue={status}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All reports</option></select></label><button className="button-secondary">Show reports</button></form>
        <p className={styles.muted}>{formatCount(reports.total)} report{reports.total === 1 ? "" : "s"} in this view</p>
        <div className={styles.list}>{reports.reports.map(report => <article className={styles.item} key={`${report.id}:${report.version}`}><h3>{report.reason.replaceAll("-", " ")}</h3><div className={styles.meta}><span>{report.status}</span><span>{formatDate(report.createdAt)}</span><span>{report.targetKind}</span></div><p className={styles.text}>{report.message}</p>{report.targetKind === "review" && report.targetId ? <Link className="font-semibold underline" href={`/owner?review=${encodeURIComponent(report.targetId)}&unmatched=all#associations`}>Inspect the reported review</Link> : report.targetId && (report.targetKind === "course" || report.targetKind === "professor") ? <Link className="font-semibold underline" href={`/${report.targetKind === "course" ? "courses" : "professors"}/${encodeURIComponent(report.targetId)}`}>Open the reported page</Link> : null}<OwnerReportControls report={report} /></article>)}</div>
        {!reports.reports.length ? <p className={styles.notice}>No reports match this selection.</p> : null}<div className={styles.pager}>{reportPage > 1 ? <Link href={ownerHref(params, { page: String(reportPage - 1), status }, "reports")}>Previous reports</Link> : null}{reportPage * 20 < reports.total ? <Link href={ownerHref(params, { page: String(reportPage + 1), status }, "reports")}>Next reports</Link> : null}</div>
      </section>
      <section id="associations" className={styles.section}><h2>Written review associations</h2><p className={styles.muted}>Use the original source and public evidence to confirm a match. Leave uncertain courses unmatched. Original text and source records are preserved.</p>
        <form action="/owner#associations" className={styles.filters}><label><span className="form-label">Professor, course, review text, or ID</span><input className="form-control" name="q" maxLength={160} defaultValue={params.q ?? ""} /></label><label><span className="form-label">Show</span><select className="form-control" name="unmatched" defaultValue={unmatchedOnly ? "only" : "all"}><option value="only">Unmatched reviews</option><option value="all">All written reviews</option></select></label><input type="hidden" name="status" value={status} /><button className="button-secondary">Find reviews</button></form>
        {params.review ? <p className={styles.muted}>Showing the selected review. <Link href="/owner?unmatched=all#associations" className="underline">Clear this selection</Link></p> : null}<p className={styles.muted}>{formatCount(reviews.total)} written review{reviews.total === 1 ? "" : "s"} in this view</p>
        <div className={styles.list}>{reviews.reviews.map(review => <article className={styles.item} key={`${review.id}:${review.fingerprint}`}><h3>{review.professorName}</h3><div className={styles.meta}><span>{review.courseCode ? [review.courseCode, review.courseTitle].filter(Boolean).join(" · ") : "Course unmatched"}</span><span>Posted {formatDate(review.createdAt)}</span><span>Taken: {review.reviewSemester ?? "Semester not recorded"}</span></div><p className={styles.text}>{review.message}</p>{review.contextNote ? <p className={styles.notice}>{review.contextNote}</p> : null}{review.sourceUrl ? <a className="font-semibold underline" href={review.sourceUrl} target="_blank" rel="noreferrer">Original review</a> : null}<OwnerAssociationControls review={review} /></article>)}</div>
        {!reviews.reviews.length ? <p className={styles.notice}>No written reviews match this selection.</p> : null}<div className={styles.pager}>{reviewsPage > 1 ? <Link href={ownerHref(params, { reviewsPage: String(reviewsPage - 1) }, "associations")}>Previous reviews</Link> : null}{reviewsPage * 20 < reviews.total ? <Link href={ownerHref(params, { reviewsPage: String(reviewsPage + 1) }, "associations")}>Next reviews</Link> : null}</div>
      </section>
      <section id="growth" className={styles.section}><h2>Reviews and growth</h2><p className={styles.muted}>Review counts checked {formatDate(overview.reviewHealth.asOf)}. New submissions count anonymous reviews posted directly to EagleEvals; recovered historical comments are excluded.</p>
        <div className={`mt-4 ${styles.stats}`}><div className={styles.stat}><strong>{formatCount(overview.reviewHealth.nativeLast7Days)}</strong>New submissions in 7 days</div><div className={styles.stat}><strong>{formatCount(overview.reviewHealth.nativeLast28Days)}</strong>New submissions in 28 days</div><div className={styles.stat}><strong>{formatCount(overview.reviewHealth.courseLinkedWrittenReviews)} / {formatCount(overview.reviewHealth.writtenReviews)}</strong>Written reviews linked to a course</div><div className={styles.stat}><strong>{formatCount(overview.reviewHealth.professorLinkedWrittenReviews)} / {formatCount(overview.reviewHealth.writtenReviews)}</strong>Written reviews linked to a professor</div></div>
        <p className={`mt-4 ${styles.muted}`}>Latest native submission: {overview.reviewHealth.lastNativeSubmissionAt ? formatDate(overview.reviewHealth.lastNativeSubmissionAt) : "None yet"}. Oldest open report: {overview.reviewHealth.oldestOpenReportAt ? formatDate(overview.reviewHealth.oldestOpenReportAt) : "No open reports"}.</p>
        <h3 className="mt-8 text-xl font-bold">Saved traffic snapshots</h3><p className={styles.muted}>Saved measurements have a collection date. They do not update live, and anonymous review totals cannot identify which person or post caused a submission.</p>
        <div className={styles.list}>{overview.growthBaselines.map(baseline => <article className={styles.item} key={baseline.id}><h3>Measured {formatDate(baseline.measuredAt)}</h3><p className={styles.muted}>Traffic window: {formatDate(baseline.traffic.period.start)}–{finalIncludedDay(baseline.traffic.period.end)} (UTC). Compared with {formatDate(baseline.traffic.previous.start)}–{finalIncludedDay(baseline.traffic.previous.end)}.</p><div className={`mt-4 ${styles.stats}`}><div className={styles.stat}><strong>{formatCount(baseline.traffic.current.visitors)}</strong>Visitors</div><div className={styles.stat}><strong>{formatCount(baseline.traffic.current.pageViews)}</strong>Page views</div><div className={styles.stat}><strong>{formatCount(baseline.traffic.previous.visitors)}</strong>Visitors in comparison window</div><div className={styles.stat}><strong>{formatCount(baseline.traffic.previous.pageViews)}</strong>Page views in comparison window</div></div>
          {baseline.traffic.notes.map(note => <p className={`mt-3 ${styles.muted}`} key={note}>{note}</p>)}<p className={`mt-4 ${styles.muted}`}>{baseline.searchConsole.available ? "Search Console data is included in this snapshot." : baseline.searchConsole.reason}</p>
          <details className="mt-4"><summary className="cursor-pointer font-semibold">Performance and measurement details</summary><div className={styles.meta}>{Object.entries(baseline.speedInsights.metrics).map(([name, metric]) => <span key={name}>{name.toUpperCase()} p75: {metric.p75 === null ? "Unavailable" : `${metric.p75} ${metric.unit}`} · {formatCount(metric.dataPoints)} data points</span>)}</div>{baseline.speedInsights.notes.map(note => <p className={`mt-3 ${styles.muted}`} key={note}>{note}</p>)}<pre className={styles.json}>{JSON.stringify(baseline, null, 2)}</pre></details>
        </article>)}</div>{!overview.growthBaselines.length ? <p className={styles.notice}>No verified growth snapshot has been saved yet.</p> : null}<p className="mt-5"><Link href="/contribute" className="font-semibold underline">Open the anonymous review campaign</Link></p>
      </section>
      <section id="history" className={styles.section}><h2>Recent changes</h2><p className={styles.muted}>Review corrections and report decisions are recorded with the owner account, reason, and evidence.</p><div className={styles.list}>{overview.recentActions.map(action => <article className={styles.item} key={action.actionId}><h3>{action.kind === "report-status" ? "Report status changed" : "Written review association corrected"}</h3><p className={styles.meta}>{formatDate(action.createdAt)}</p><p className={styles.text}>{action.reason}</p>{action.evidenceUrl ? <a href={action.evidenceUrl} target="_blank" rel="noreferrer" className="underline">Reviewed evidence</a> : null}</article>)}</div>{!overview.recentActions.length ? <p className={styles.notice}>No owner changes have been recorded yet.</p> : null}</section>
    </> : null}
  </div></main><SiteFooter /></>;
}
