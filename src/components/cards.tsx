import Link from "next/link";
import { ArrowIcon, BookIcon, PersonIcon } from "@/components/icons";
import { cleanTitle, commentSourceLabel, formatDate, formatEvaluationCount, formatRating, formatWrittenReviewCount } from "@/data/format";
import type { CourseSummary, EvaluationRecord, MetricValue, ProfessorSummary, StudentComment } from "@/data/types";

export function RatingBadge({ value, label = "Overall", large = false }: { value: number | null; label?: string; large?: boolean }) {
  return <div className={`rating-badge ${large ? "rating-badge-large" : ""}`}><strong>{formatRating(value)}</strong><span>{value === null ? "No rating" : `${label} / 5`}</span></div>;
}

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link href={`/courses/${course.id}`} className="catalog-record">
      <div><span className="catalog-code">{course.code}</span><h3>{course.title}</h3><p className="catalog-context">{course.subject}</p><div className="catalog-evidence"><span>{formatEvaluationCount(course.reviewCount)}</span><span className="written-review-status" data-empty={course.commentCount === 0}>{formatWrittenReviewCount(course.commentCount)}</span></div></div>
      <RatingBadge value={course.courseOverall} label="Course" /><ArrowIcon className="size-4 text-[var(--muted)]" />
    </Link>
  );
}

export function ProfessorCard({ professor }: { professor: ProfessorSummary }) {
  return (
    <Link href={`/professors/${professor.id}`} className="catalog-record">
      <div><h3>{professor.name}</h3><p className="catalog-context">{cleanTitle(professor.titles[0]) ?? "Boston College faculty"}</p><div className="catalog-evidence"><span>{formatEvaluationCount(professor.reviewCount)}</span><span className="written-review-status" data-empty={professor.commentCount === 0}>{formatWrittenReviewCount(professor.commentCount)}</span></div></div>
      <RatingBadge value={professor.instructorOverall} label="Instructor" /><ArrowIcon className="size-4 text-[var(--muted)]" />
    </Link>
  );
}

export function MetricGrid({ metrics }: { metrics: MetricValue[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {metrics.map((metric) => {
        const percent = metric.value === null ? 0 : Math.max(0, Math.min(100, metric.value * 20));
        return (
          <div key={metric.label} className="metric-note">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-bold text-[var(--navy)]">{metric.label}</p>
              <p className="text-lg font-black text-[var(--navy)]">{formatRating(metric.value)}<span className="text-xs font-semibold text-[var(--muted)]"> / 5</span></p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--wash)]" aria-hidden="true">
              <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${percent}%` }} />
            </div>
            {metric.description ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{metric.description}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function CommentCard({ comment, context }: { comment: StudentComment; context: "course" | "professor" }) {
  const href = context === "course" ? `/professors/${comment.professorId}` : comment.courseId ? `/courses/${comment.courseId}` : null;
  const title = context === "course" ? comment.professorName : comment.courseCode ? `${comment.courseCode} · ${comment.courseTitle}` : "General comment";
  return (
    <article className="review-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="result-icon">{context === "course" ? <PersonIcon className="size-4" /> : <BookIcon className="size-4" />}</span>
          <div>
            {href ? <Link href={href} className="font-bold text-[var(--navy)] hover:text-[var(--blue)]">{title}</Link> : <p className="font-bold text-[var(--navy)]">{title}</p>}
            <p className="text-xs text-[var(--muted)]">Posted {formatDate(comment.createdAt)} · {commentSourceLabel(comment.source)}</p>
            <p className="text-xs text-[var(--muted)]">{comment.semester ? `Taken ${comment.semester}` : "Semester not recorded"}</p>
          </div>
        </div>
        {comment.wouldTakeAgain !== null ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${comment.wouldTakeAgain ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--rose-pale)] text-[var(--rose)]"}`}>
          {comment.wouldTakeAgain ? "Would take again" : "Would not take again"}
        </span> : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">{comment.message}</p>
    </article>
  );
}

export function EvaluationCard({ evaluation }: { evaluation: EvaluationRecord }) {
  const availableMetrics = evaluation.metrics.filter((metric) => metric.value !== null);
  return (
    <article className="review-paper">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1 ${evaluation.source === "eagleevals_anonymous" ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--wash)] text-[var(--muted)]"}`}>{evaluation.source === "eagleevals_anonymous" ? "New anonymous review" : "Historical evaluation"}</span>
            <span className="text-[var(--muted)]">{evaluation.semester}{evaluation.section !== null ? ` · Section ${evaluation.section}` : ""}</span>
            {evaluation.submittedAt ? <span className="text-[var(--muted)]">· {formatDate(evaluation.submittedAt)}</span> : null}
          </div>
          <h2 className="mt-3 text-lg font-bold text-[var(--navy)]">
            {evaluation.courseId ? <Link href={`/courses/${evaluation.courseId}`} className="hover:text-[var(--blue)]">{evaluation.courseCode}{evaluation.courseTitle ? ` · ${evaluation.courseTitle}` : ""}</Link> : evaluation.courseCode}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Instructor: {evaluation.professorId ? <Link href={`/professors/${evaluation.professorId}`} className="font-semibold text-[var(--ink)] hover:text-[var(--blue)]">{evaluation.professorName}</Link> : evaluation.professorName}</p>
        </div>
        <div className="flex gap-3"><RatingBadge value={evaluation.courseOverall} label="course" /><RatingBadge value={evaluation.instructorOverall} label="instructor" /></div>
      </div>
      {availableMetrics.length ? <div className="mt-5 grid gap-2 border-t border-[var(--line)] pt-5 sm:grid-cols-3 lg:grid-cols-5">{availableMetrics.map((metric) => <div key={metric.label} className="rounded-lg bg-[var(--wash)] px-3 py-2"><p className="text-[0.68rem] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{metric.label}</p><p className="mt-1 font-black text-[var(--navy)]">{formatRating(metric.value)} / 5</p></div>)}</div> : <p className="mt-5 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">No detailed ratings were provided.</p>}
      {evaluation.courseId && evaluation.professorId ? <div className="mt-5 border-t border-[var(--line)] pt-4"><Link className="text-sm font-bold text-[var(--blue)] hover:text-[var(--navy)]" href={`/review?course=${evaluation.courseId}&professor=${evaluation.professorId}`}>Review this course and professor</Link></div> : null}
    </article>
  );
}

export function CommentArchiveCard({ comment }: { comment: StudentComment }) {
  return (
    <article className="review-paper">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1 ${comment.source === "eagleevals_anonymous" ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--wash)] text-[var(--muted)]"}`}>{commentSourceLabel(comment.source)}</span>
            <span className="text-[var(--muted)]">Posted {formatDate(comment.createdAt)}</span>
            <span className="text-[var(--muted)]">{comment.semester ? `Taken ${comment.semester}` : "Semester not recorded"}</span>
          </div>
          <p className="mt-3 font-bold text-[var(--navy)]"><Link href={`/professors/${comment.professorId}`} className="hover:text-[var(--blue)]">{comment.professorName}</Link></p>
          {comment.courseId && comment.courseCode ? <p className="mt-1 text-sm text-[var(--muted)]"><Link href={`/courses/${comment.courseId}`} className="hover:text-[var(--blue)]">{comment.courseCode}{comment.courseTitle ? ` · ${comment.courseTitle}` : ""}</Link></p> : null}
        </div>
        {comment.wouldTakeAgain !== null ? <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${comment.wouldTakeAgain ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--rose-pale)] text-[var(--rose)]"}`}>{comment.wouldTakeAgain ? "Would take again" : "Would not take again"}</span> : null}
      </div>
      <p className="mt-5 whitespace-pre-wrap border-t border-[var(--line)] pt-5 text-sm leading-7 text-[var(--ink-soft)]">{comment.message}</p>
    </article>
  );
}
