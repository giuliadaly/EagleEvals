"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { commentSourceLabel, formatCount, formatDate } from "@/data/format";
import { browseReviews, type ReviewSort } from "@/data/review-browsing";
import type { StudentComment } from "@/data/types";
import styles from "./detail-page.module.css";

export function DetailReview({ comment, context }: { comment: StudentComment; context: "professor" | "course" }) {
  const href = context === "course" ? `/professors/${comment.professorId}` : comment.courseId ? `/courses/${comment.courseId}` : null;
  const label = context === "course" ? comment.professorName : comment.courseCode ?? "General review";
  return <article className={styles.review}>
    <div className={styles.reviewMeta}>
      {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
      <time dateTime={comment.createdAt}>Posted {formatDate(comment.createdAt)}</time>
    </div>
    <p className={styles.reviewTerm}>{comment.semester ? `Taken ${comment.semester}` : "Semester not recorded"}</p>
    <p className={styles.reviewMessage}>{comment.message}</p>
    <div className={styles.reviewFoot}>
      {comment.wouldTakeAgain !== null ? <span className={`${styles.verdict} ${comment.wouldTakeAgain ? styles.positive : styles.negative}`}><span aria-hidden="true">{comment.wouldTakeAgain ? "✓" : "−"}</span>{comment.wouldTakeAgain ? "Would take again" : "Would not take again"}</span> : null}
      <span className={styles.reviewSource}>{commentSourceLabel(comment.source)}</span>
    </div>
  </article>;
}

export function DetailReviews({ comments, context, reviewHref, archiveHref }: { comments: StudentComment[]; context: "professor" | "course"; reviewHref: string; archiveHref?: string }) {
  const headingId = useId();
  const [selected, setSelected] = useState("");
  const [sort, setSort] = useState<ReviewSort>("newest");
  const choices = [...new Map(comments.map(comment => context === "course"
    ? [comment.professorId, comment.professorName]
    : [comment.courseId ?? "general", comment.courseCode ? `${comment.courseCode} · ${comment.courseTitle}` : "General reviews"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const visible = browseReviews(comments, context, selected, sort);
  const remaining = visible.slice(5);
  return <section id="comments" className={styles.reviews} aria-labelledby={headingId}>
    <div className={styles.sectionHeading}>
      <div><h2 id={headingId}>Student reviews <span className={styles.count}>{formatCount(comments.length)}</span></h2>{comments.length ? <p className={styles.caption}>Anonymous, shown as submitted.</p> : null}</div>
      <Link href={reviewHref} className={styles.writeReview}>Write a review <span aria-hidden="true">↗</span></Link>
    </div>
    {comments.length ? <>
      <div className={styles.reviewFilters}>
        <label><span className="form-label">{context === "course" ? "Professor" : "Course"}</span><select className="form-control" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">{context === "course" ? "All professors" : "All courses"}</option>
          {choices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label><span className="form-label">Order reviews</span><select className="form-control" value={sort} onChange={event => setSort(event.target.value as ReviewSort)}>
          <option value="newest">Newest posts</option><option value="oldest">Oldest posts</option><option value="term">Most recent class taken</option>
        </select></label>
      </div>
      <p className={styles.filterStatus} aria-live="polite">{formatCount(visible.length)} of {formatCount(comments.length)} reviews{sort === "term" ? " · Unknown semesters appear last" : ""}</p>
      <div className={styles.reviewList}>{visible.slice(0, 5).map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div>
      {remaining.length ? <details key={`${selected}-${sort}`} className={`${styles.disclosure} ${styles.moreReviews}`}><summary>Read {formatCount(remaining.length)} more reviews</summary><div className={styles.disclosureBody}><div className={styles.reviewList}>{remaining.map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div></div></details> : null}
      {archiveHref ? <Link className={styles.textLink} href={archiveHref}>Browse the review archive <span aria-hidden="true">↗</span></Link> : null}
    </> : <p className={styles.emptyState}>No written reviews yet. Share what you wish you’d known before taking this {context === "course" ? "course" : "professor’s class"}.</p>}
  </section>;
}
