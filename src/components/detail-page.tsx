import type { ReactNode } from "react";
import Link from "next/link";
import { commentSourceLabel, formatCount, formatDate } from "@/data/format";
import type { MetricValue, StudentComment } from "@/data/types";
import styles from "./detail-page.module.css";

export function preciseRating(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function DetailScore({ value, label, precision = 2 }: { value: number | null; label: string; precision?: number }) {
  return <div className={styles.score}><strong>{value === null ? "—" : value.toFixed(precision)}{value !== null ? <small> / 5</small> : null}</strong><span>{label}</span>{value === null ? <small>No rating collected</small> : null}</div>;
}

export function DetailDisclosure({ title, children, id, open = false, className = "" }: { title: ReactNode; children: ReactNode; id?: string; open?: boolean; className?: string }) {
  return <details id={id} open={open} className={`${styles.disclosure} ${className}`}><summary>{title}</summary><div className={styles.disclosureBody}>{children}</div></details>;
}

function DetailReview({ comment, context }: { comment: StudentComment; context: "professor" | "course" }) {
  const href = context === "course" ? `/professors/${comment.professorId}` : comment.courseId ? `/courses/${comment.courseId}` : null;
  const label = context === "course" ? comment.professorName : comment.courseCode ?? "General review";
  return (
    <article className={styles.review}>
      <div className={styles.reviewMeta}>
        {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
        <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
      </div>
      <p className={styles.reviewMessage}>{comment.message}</p>
      <div className={styles.reviewFoot}>
        <span className={`${styles.verdict} ${comment.wouldTakeAgain ? styles.positive : styles.negative}`}><span aria-hidden="true">{comment.wouldTakeAgain ? "✓" : "−"}</span>{comment.wouldTakeAgain ? "Would take again" : "Would not take again"}</span>
        <span className={styles.reviewSource}>{commentSourceLabel(comment.source)}</span>
      </div>
    </article>
  );
}

export function DetailReviews({ comments, context, reviewHref, archiveHref }: { comments: StudentComment[]; context: "professor" | "course"; reviewHref: string; archiveHref?: string }) {
  const first = comments.slice(0, 5);
  const remaining = comments.slice(5);
  return (
    <section id="comments" className={styles.reviews} aria-labelledby="reviews-heading">
      <div className={styles.sectionHeading}>
        <div><h2 id="reviews-heading">Student reviews <span className={styles.count}>{formatCount(comments.length)}</span></h2>{comments.length ? <p className={styles.caption}>Anonymous, shown as submitted · Newest first</p> : null}</div>
        <Link href={reviewHref} className={styles.writeReview}>Write a review <span aria-hidden="true">↗</span></Link>
      </div>
      {comments.length ? <>
        <div className={styles.reviewList}>{first.map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div>
        {remaining.length ? <DetailDisclosure title={`Read ${formatCount(remaining.length)} more review${remaining.length === 1 ? "" : "s"}`} className={styles.moreReviews}><div className={styles.reviewList}>{remaining.map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div></DetailDisclosure> : null}
        {archiveHref ? <Link className={styles.textLink} href={archiveHref}>Browse the review archive <span aria-hidden="true">↗</span></Link> : null}
      </> : <p className={styles.emptyState}>No written reviews yet. Share what you wish you’d known before taking this {context === "course" ? "course" : "professor’s class"}.</p>}
    </section>
  );
}

export function DetailMetrics({ metrics }: { metrics: MetricValue[] }) {
  return <dl className={styles.metrics}>{metrics.map(metric => <div key={metric.label} className={styles.metric}>
    <dt>{metric.label}{metric.description ? <small>{metric.description}</small> : null}{metric.sampleCount !== undefined ? <small>{metric.sampleCount ? `${formatCount(metric.sampleCount)} evaluations` : "No responses in this record"}</small> : null}</dt>
    <dd data-empty={metric.value === null || undefined}>{metric.value === null ? "Not collected" : metric.kind === "hours" ? `${metric.value.toFixed(1)} hrs` : `${metric.value.toFixed(2)} / 5`}</dd>
  </div>)}</dl>;
}
