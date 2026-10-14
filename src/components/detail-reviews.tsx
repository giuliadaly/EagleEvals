"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { DetailReview } from "@/components/detail-review";
import { RmpReviews } from "@/components/rmp-reviews";
import { formatCount } from "@/data/format";
import { browseReviews, type ReviewSort } from "@/data/review-browsing";
import type { StudentComment } from "@/data/types";
import styles from "./detail-page.module.css";

type ReviewProps = {
  comments: StudentComment[];
  context: "professor" | "course";
  reviewHref: string;
  archiveHref?: string;
  professor?: { id: string; name: string };
  instructors?: { id: string; name: string }[];
  course?: { id: string; code: string };
  courses?: { id: string; code: string; title: string }[];
};

export function DetailReviews({ comments, context, reviewHref, archiveHref, professor, instructors = [], course, courses = [] }: ReviewProps) {
  const headingId = useId();
  const [selected, setSelected] = useState("");
  const [sort, setSort] = useState<ReviewSort>("newest");
  const choices = [...new Map<string, string>([
    ...(context === "course" ? instructors.map(p => [p.id, p.name] as [string, string]) : courses.map(c => [c.id, `${c.code} · ${c.title}`] as [string, string])),
    ...comments.map((comment): [string, string] => context === "course"
    ? [comment.professorId, comment.professorName]
    : [comment.courseId ?? "general", comment.courseCode ? `${comment.courseCode} · ${comment.courseTitle}` : "General reviews"]),
  ]).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const visible = browseReviews(comments, context, selected, sort);
  const remaining = visible.slice(5);
  const selectedProfessor = context === "professor" ? professor ?? null : instructors.find(p => p.id === selected) ?? null;
  const selectedCourse = context === "course" ? course : courses.find(c => c.id === selected);
  return <section id="comments" className={styles.reviews} aria-labelledby={headingId}>
    <div className={styles.sectionHeading}>
      <div><h2 id={headingId}>EagleEvals reviews <span className={styles.count}>{formatCount(comments.length)}</span></h2><p className={styles.caption}>Written feedback from the original archive and new anonymous submissions.</p></div>
      <Link href={reviewHref} className={styles.writeReview}>Write a review</Link>
    </div>
    {choices.length ?
      <div className={styles.reviewFilters}>
        <label><span className="form-label">{context === "course" ? "Professor" : "Course"}</span><select className="form-control" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">{context === "course" ? "All professors" : "All courses"}</option>
          {choices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label><span className="form-label">Order EagleEvals reviews</span><select className="form-control" value={sort} onChange={event => setSort(event.target.value as ReviewSort)}>
          <option value="newest">Newest posts</option><option value="oldest">Oldest posts</option><option value="term">Most recent class taken</option>
        </select></label>
      </div> : null}
    {comments.length ? <>
      <p className={styles.filterStatus} aria-live="polite">{formatCount(visible.length)} of {formatCount(comments.length)} reviews{sort === "term" ? " · Unknown semesters appear last" : ""}</p>
      <div className={styles.reviewList}>{visible.slice(0, 5).map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div>
      {!visible.length ? <p className={styles.detailText}>No EagleEvals written reviews match this selection yet.</p> : null}
      {remaining.length ? <details key={`${selected}-${sort}`} className={`${styles.disclosure} ${styles.moreReviews}`}><summary>Read {formatCount(remaining.length)} more reviews</summary><div className={styles.disclosureBody}><div className={styles.reviewList}>{remaining.map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div></div></details> : null}
      {archiveHref ? <Link className={styles.textLink} href={archiveHref}>Browse the review archive <ChevronIcon /></Link> : null}
    </> : <div className={styles.emptyState}><h3>No written reviews on EagleEvals yet</h3><p>Be the first to share what you wish you’d known before taking this {context === "course" ? "course" : "professor’s class"}.</p></div>}
    {selected !== "general" ? <RmpReviews professor={selectedProfessor} course={selectedCourse} context={context} /> : null}
  </section>;
}
