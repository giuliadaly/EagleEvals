import Link from "next/link";
import { ArrowIcon, BookIcon, PersonIcon } from "@/components/icons";
import { cleanTitle, commentSourceLabel, formatCount, formatDate, formatRating, formatWrittenReviewCount, initials } from "@/data/format";
import type { CourseSummary, EvaluationRecord, MetricValue, ProfessorSummary, StudentComment } from "@/data/types";

export function RatingBadge({ value, label = "Overall", large = false }: { value: number | null; label?: string; large?: boolean }) {
  return (
    <div className={`shrink-0 rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--gold-pale)] text-center ${large ? "min-w-28 px-5 py-4" : "min-w-17 px-3 py-2.5"}`}>
      <div className={`${large ? "text-3xl" : "text-lg"} font-black tracking-[-0.04em] text-[var(--navy)]`}>{formatRating(value)}</div>
      <div className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{value === null ? "No rating" : `${label} / 5`}</div>
    </div>
  );
}

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link href={`/courses/${course.id}`} className="card group flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="icon-tile"><BookIcon className="size-5" /></span>
        <RatingBadge value={course.courseOverall} />
      </div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[var(--gold-dark)]">{course.code}</p>
      <h3 className="mt-1 text-xl font-bold leading-tight tracking-[-0.025em] text-[var(--navy)] group-hover:text-[var(--blue)]">{course.title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{course.subject}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
        <span className="flex flex-wrap gap-x-3 gap-y-1"><span>{formatCount(course.reviewCount)} ratings</span><span className="font-bold text-[var(--maroon-deep)]">{formatWrittenReviewCount(course.commentCount)}</span></span>
        <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export function ProfessorCard({ professor }: { professor: ProfessorSummary }) {
  return (
    <Link href={`/professors/${professor.id}`} className="card group flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-[.375rem] bg-[var(--maroon-deep)] font-mono text-sm font-semibold text-[var(--on-maroon)]">{initials(professor.name)}</span>
        <RatingBadge value={professor.instructorOverall} />
      </div>
      <h3 className="mt-5 text-xl font-bold leading-tight tracking-[-0.025em] text-[var(--navy)] group-hover:text-[var(--blue)]">{professor.name}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">{cleanTitle(professor.titles[0]) ?? "Boston College faculty"}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
        <span className="flex flex-wrap gap-x-3 gap-y-1"><span>{formatCount(professor.reviewCount)} ratings</span><span className="font-bold text-[var(--maroon-deep)]">{formatWrittenReviewCount(professor.commentCount)}</span></span>
        <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export function MetricGrid({ metrics }: { metrics: MetricValue[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {metrics.map((metric) => {
        const percent = metric.value === null ? 0 : Math.max(0, Math.min(100, metric.value * 20));
        return (
          <div key={metric.label} className="rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-bold text-[var(--navy)]">{metric.label}</p>
              <p className="text-lg font-black text-[var(--navy)]">{formatRating(metric.value)}<span className="text-xs font-semibold text-[var(--muted)]"> / 5</span></p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--wash)]" aria-hidden="true">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--gold-dark),var(--gold))]" style={{ width: `${percent}%` }} />
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
    <article className="rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="result-icon">{context === "course" ? <PersonIcon className="size-4" /> : <BookIcon className="size-4" />}</span>
          <div>
            {href ? <Link href={href} className="font-bold text-[var(--navy)] hover:text-[var(--blue)]">{title}</Link> : <p className="font-bold text-[var(--navy)]">{title}</p>}
            <p className="text-xs text-[var(--muted)]">{formatDate(comment.createdAt)} · {commentSourceLabel(comment.source)}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${comment.wouldTakeAgain ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--rose-pale)] text-[var(--rose)]"}`}>
          {comment.wouldTakeAgain ? "Would take again" : "Would not take again"}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">{comment.message}</p>
    </article>
  );
}

export function EvaluationCard({ evaluation }: { evaluation: EvaluationRecord }) {
  const availableMetrics = evaluation.metrics.filter((metric) => metric.value !== null);
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1 ${evaluation.source === "eagleevals_anonymous" ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--wash)] text-[var(--muted)]"}`}>{evaluation.source === "eagleevals_anonymous" ? "New anonymous review" : "Historical evaluation"}</span>
            <span className="text-[var(--muted)]">{evaluation.semester} · Section {evaluation.section}</span>
            {evaluation.submittedAt ? <span className="text-[var(--muted)]">· {formatDate(evaluation.submittedAt)}</span> : null}
          </div>
          <h2 className="mt-3 text-lg font-bold text-[var(--navy)]">
            {evaluation.courseId ? <Link href={`/courses/${evaluation.courseId}`} className="hover:text-[var(--blue)]">{evaluation.courseCode}{evaluation.courseTitle ? ` · ${evaluation.courseTitle}` : ""}</Link> : evaluation.courseCode}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Instructor: {evaluation.professorId ? <Link href={`/professors/${evaluation.professorId}`} className="font-semibold text-[var(--ink)] hover:text-[var(--blue)]">{evaluation.professorName}</Link> : evaluation.professorName}</p>
        </div>
        <div className="flex gap-3"><RatingBadge value={evaluation.courseOverall} label="course" /><RatingBadge value={evaluation.instructorOverall} label="instructor" /></div>
      </div>
      {availableMetrics.length ? <div className="mt-5 grid gap-2 border-t border-[var(--line)] pt-5 sm:grid-cols-3 lg:grid-cols-5">{availableMetrics.map((metric) => <div key={metric.label} className="rounded-lg bg-[var(--wash)] px-3 py-2"><p className="text-[0.68rem] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{metric.label}</p><p className="mt-1 font-black text-[var(--navy)]">{formatRating(metric.value)} / 5</p></div>)}</div> : <p className="mt-5 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">No category-level metrics were available for this section.</p>}
      {evaluation.courseId && evaluation.professorId ? <div className="mt-5 border-t border-[var(--line)] pt-4"><Link className="text-sm font-bold text-[var(--blue)] hover:text-[var(--navy)]" href={`/review?course=${evaluation.courseId}&professor=${evaluation.professorId}`}>Review this course and professor</Link></div> : null}
    </article>
  );
}

export function CommentArchiveCard({ comment }: { comment: StudentComment }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1 ${comment.source === "eagleevals_anonymous" ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--wash)] text-[var(--muted)]"}`}>{commentSourceLabel(comment.source)}</span>
            <span className="text-[var(--muted)]">{formatDate(comment.createdAt)}</span>
          </div>
          <p className="mt-3 font-bold text-[var(--navy)]"><Link href={`/professors/${comment.professorId}`} className="hover:text-[var(--blue)]">{comment.professorName}</Link></p>
          {comment.courseId && comment.courseCode ? <p className="mt-1 text-sm text-[var(--muted)]"><Link href={`/courses/${comment.courseId}`} className="hover:text-[var(--blue)]">{comment.courseCode}{comment.courseTitle ? ` · ${comment.courseTitle}` : ""}</Link></p> : null}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${comment.wouldTakeAgain ? "bg-[var(--green-pale)] text-[var(--green)]" : "bg-[var(--rose-pale)] text-[var(--rose)]"}`}>{comment.wouldTakeAgain ? "Would take again" : "Would not take again"}</span>
      </div>
      <p className="mt-5 whitespace-pre-wrap border-t border-[var(--line)] pt-5 text-sm leading-7 text-[var(--ink-soft)]">{comment.message}</p>
    </article>
  );
}
