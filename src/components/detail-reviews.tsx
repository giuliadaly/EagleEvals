"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { DetailReview } from "@/components/detail-review";
import { formatCount, formatReviewCount } from "@/data/format";
import { browseReviews, reviewCourseKey, type ReviewSort } from "@/data/review-browsing";
import type { StudentComment } from "@/data/types";
import styles from "./detail-page.module.css";

type ReviewProps = {
  comments: StudentComment[];
  context: "professor" | "course";
  reviewHref: string;
  archiveHref?: string;
  instructors?: { id: string; name: string }[];
  courses?: { id: string; code: string; title: string }[];
};

export function DetailReviews({ comments, context, reviewHref, archiveHref, instructors = [], courses = [] }: ReviewProps) {
  const headingId = useId();
  const [selected, setSelected] = useState("");
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [query, setQuery] = useState("");
  const choices = [...new Map<string, string>([
    ...(context === "course" ? instructors.map(p => [p.id, p.name] as [string, string]) : courses.map(c => [c.id, `${c.code} · ${c.title}`] as [string, string])),
    ...comments.map((comment): [string, string] => context === "course"
    ? [comment.professorId, comment.professorName]
    : [reviewCourseKey(comment), comment.courseCode ? [comment.courseCode, comment.courseTitle].filter(Boolean).join(" · ") : "General reviews"]),
  ]).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const visible = browseReviews(comments, context, selected, sort, query);
  const remaining = visible.slice(5);
  return <section id="comments" className={styles.reviews} aria-labelledby={headingId}>
    <div className={styles.sectionHeading}>
      <div><h2 id={headingId}>Student reviews <span className={styles.count}>{formatCount(comments.length)}</span></h2><p className={styles.caption}>Student experiences, shown as submitted.</p></div>
      <Link href={reviewHref} className={styles.writeReview}>Write a review</Link>
    </div>
    {comments.length ? <label className={styles.reviewSearch}><span className="form-label">Search these reviews</span><input className="form-control" type="search" maxLength={160} value={query} onChange={event => setQuery(event.target.value)} placeholder="Exams, grading, attendance…" /></label> : null}
    {choices.length ?
      <div className={styles.reviewFilters}>
        <label><span className="form-label">{context === "course" ? "Professor" : "Course"}</span><select className="form-control" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">{context === "course" ? "All professors" : "All courses"}</option>
          {choices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label><span className="form-label">Order reviews</span><select className="form-control" value={sort} onChange={event => setSort(event.target.value as ReviewSort)}>
          <option value="newest">Newest posts</option><option value="oldest">Oldest posts</option><option value="term">Most recent class taken</option>
        </select></label>
      </div> : null}
    {comments.length ? <>
      <p className={styles.filterStatus} aria-live="polite">{formatCount(visible.length)} of {formatReviewCount(comments.length)}{sort === "term" ? " · Unknown semesters appear last" : ""}</p>
      <div className={styles.reviewList}>{visible.slice(0, 5).map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div>
      {!visible.length ? <p className={styles.detailText}>No written reviews match this selection yet.</p> : null}
      {remaining.length ? <details key={`${selected}-${sort}-${query}`} className={`${styles.disclosure} ${styles.moreReviews}`}><summary>Read {formatReviewCount(remaining.length, "more review", "more reviews")}</summary><div className={styles.disclosureBody}><div className={styles.reviewList}>{remaining.map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div></div></details> : null}
      {archiveHref ? <Link className={styles.textLink} href={archiveHref}>Browse the review archive <ChevronIcon /></Link> : null}
    </> : <div className={styles.emptyState}><h3>No written reviews yet</h3><p>Be the first to share what you wish you’d known before taking this {context === "course" ? "course" : "professor’s class"}.</p></div>}
  </section>;
}
