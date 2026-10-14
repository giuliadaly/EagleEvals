import Link from "next/link";
import { formatDate } from "@/data/format";
import { reviewProfessorHref } from "@/data/review-browsing";
import type { StudentComment } from "@/data/types";
import styles from "./detail-page.module.css";

export function DetailReview({ comment, context }: { comment: StudentComment; context: "professor" | "course" }) {
  const href = context === "course" ? reviewProfessorHref(comment) : comment.courseId ? `/courses/${comment.courseId}` : null;
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
      {comment.sourceUrl ? <a className={styles.reviewSource} href={comment.sourceUrl} target="_blank" rel="noopener noreferrer">Original review</a> : null}
    </div>
  </article>;
}
