import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanTitle, commentSourceLabel, formatCount, formatDate, initials } from "@/data/format";
import { getProfessorDetail } from "@/data/queries";
import type { MetricValue } from "@/data/types";
import styles from "./professor.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProfessorDetail(id);
  if (!detail) return { title: "Professor not found" };
  return { title: detail.professor.name, description: `Ratings, courses, evaluation history, and anonymous written reviews for ${detail.professor.name} at Boston College.` };
}

function preciseRating(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function metricValue(metric: MetricValue): string {
  if (metric.value === null) return "Not collected";
  return metric.kind === "hours" ? `${metric.value.toFixed(1)} hrs` : `${metric.value.toFixed(2)} / 5`;
}

export default async function ProfessorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProfessorDetail(id);
  if (!detail) notFound();

  const { professor, metrics, courses, comments, evaluations } = detail;
  const titles = professor.titles.map(cleanTitle).filter(Boolean);
  const hasFacultyDetails = Boolean(professor.office || professor.email || professor.phone || professor.education.length);
  const latestTerm = evaluations[0]?.semester ?? "Unavailable";

  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <header className={styles.recordHeader}>
          <div className="page-shell">
            <Breadcrumbs items={[{ label: "Professors", href: "/professors" }, { label: professor.name }]} />
            <div className={styles.titleRow}>
              <div className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">{initials(professor.name)}</span>
                <div className={styles.personCopy}>
                  <h1>{professor.name}</h1>
                  <p>{titles.length ? titles.join(" · ") : "Boston College faculty"}</p>
                </div>
              </div>
              <div className={styles.actions}>
                <Link className="button-secondary" href="#comments">Read {formatCount(comments.length)} written review{comments.length === 1 ? "" : "s"}</Link>
                <Link className="button-primary" href={`/review?professor=${professor.id}`}>Review anonymously</Link>
              </div>
            </div>
          </div>
        </header>

        <div className={`page-shell ${styles.recordLayout}`}>
          <aside className={styles.recordRail} aria-label="Professor record index">
            <p className={styles.recordLabel}>Professor record</p>
            <div className={styles.railCounts}>
              <p><strong>{formatCount(professor.reviewCount)}</strong> structured evaluations</p>
              <p><strong>{formatCount(comments.length)}</strong> written reviews</p>
              <p><strong>{formatCount(courses.length)}</strong> course pairing{courses.length === 1 ? "" : "s"}</p>
            </div>
            <nav className={styles.recordIndex} aria-label="Jump to professor data">
              <a href="#decision"><span>01</span><span>Decision summary</span></a>
              <a href="#comments"><span>02</span><span>Written reviews</span></a>
              <a href="#courses"><span>03</span><span>Course pairings</span></a>
              <a href="#metrics"><span>04</span><span>All rating fields</span></a>
              <a href="#history"><span>05</span><span>Term history</span></a>
              {hasFacultyDetails ? <a href="#faculty"><span>06</span><span>Faculty details</span></a> : null}
            </nav>
          </aside>

          <article className={styles.recordBody}>
            <section className={styles.recordSection} id="decision">
              <div className={styles.sectionHeading}>
                <h2>The decision in one scan</h2>
                <p>Start with the overall signal, then use written reviews and course-level evidence to understand what is behind it.</p>
              </div>
              <div className={styles.summary} aria-label="Professor rating summary">
                <div><strong>{preciseRating(professor.instructorOverall)}</strong><span>Instructor rating</span><small>{formatCount(professor.reviewCount)} evaluations</small></div>
                <div><strong>{preciseRating(professor.courseOverall)}</strong><span>Course rating</span><small>{formatCount(professor.reviewCount)} evaluations</small></div>
                <div><strong>{formatCount(professor.reviewCount)}</strong><span>Structured evaluations</span><small>{formatCount(courses.length)} courses</small></div>
                <div><strong>{formatCount(comments.length)}</strong><span>Written reviews</span><small>Read separately</small></div>
                <div><strong className={styles.termValue}>{latestTerm}</strong><span>Latest evaluation term</span><small>Most recent record</small></div>
              </div>
              <p className={styles.summaryNote}>Instructor rating and course rating answer different questions. Written reviews do not change either average.</p>
            </section>

            <section className={styles.recordSection} id="comments">
              <div className={styles.sectionHeading}>
                <h2>Written reviews</h2>
                <p>{comments.length ? `All ${formatCount(comments.length)} public written reviews attached to this professor, shown without a user identifier.` : "No public written reviews are attached to this professor yet."}</p>
              </div>
              {comments.length ? (
                <div className={styles.comments}>
                  {comments.map((comment) => (
                    <article className={styles.comment} key={comment.id}>
                      <div className={styles.commentMeta}>
                        <span>{formatDate(comment.createdAt)}</span>
                        {comment.courseId && comment.courseCode ? <Link href={`/courses/${comment.courseId}`}>{comment.courseCode}</Link> : <span>Course unavailable</span>}
                        <span>{commentSourceLabel(comment.source)}</span>
                        <strong>{comment.wouldTakeAgain ? "Would take again" : "Would not take again"}</strong>
                      </div>
                      <p>{comment.message}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>Be the first student to add context for this professor.</p>
                  <Link className="button-primary" href={`/review?professor=${professor.id}`}>Write an anonymous review</Link>
                </div>
              )}
            </section>

            <section className={styles.recordSection} id="courses">
              <div className={styles.sectionHeading}>
                <h2>Course pairings</h2>
                <p>A professor is not one universal score. These averages show how the record changes by course.</p>
              </div>
              {courses.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <caption className="sr-only">Courses taught by {professor.name}</caption>
                    <thead><tr><th>Course</th><th>Title</th><th>Evaluations</th><th>Instructor</th><th>Course</th></tr></thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course.id}>
                          <td data-label="Course"><Link className={styles.courseCode} href={`/courses/${course.id}`}>{course.code}</Link></td>
                          <td data-label="Title">{course.title}</td>
                          <td data-label="Evaluations" className={styles.dataValue}>{formatCount(course.reviewCount)}</td>
                          <td data-label="Instructor" className={styles.dataValue}>{preciseRating(course.instructorOverall)}</td>
                          <td data-label="Course" className={styles.dataValue}>{preciseRating(course.courseOverall)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className={styles.emptyLine}>No course relationships were available in the evaluation record.</p>}
            </section>

            <section className={styles.recordSection} id="metrics">
              <div className={styles.sectionHeading}>
                <h2>Every rating field</h2>
                <p>Missing responses remain visible as “Not collected” instead of being hidden or estimated.</p>
              </div>
              <div className={styles.metricLedger}>
                {metrics.map((metric) => (
                  <div className={styles.metricRow} key={metric.label}>
                    <div>
                      <strong>{metric.label}</strong>
                      <small>{metric.description ?? (metric.sampleCount ? `Average across ${formatCount(metric.sampleCount)} evaluations` : "No responses in this record")}</small>
                    </div>
                    <span data-empty={metric.value === null ? "true" : undefined}>{metricValue(metric)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.recordSection} id="history">
              <div className={styles.sectionHeading}>
                <h2>Term and section history</h2>
                <p>Every public structured evaluation attached to this professor, kept uncollapsed so recency and course context stay visible.</p>
              </div>
              {evaluations.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <caption className="sr-only">Evaluation history for {professor.name}</caption>
                    <thead><tr><th>Term</th><th>Course</th><th>Section</th><th>Instructor</th><th>Course</th></tr></thead>
                    <tbody>
                      {evaluations.map((evaluation) => (
                        <tr key={evaluation.id}>
                          <td data-label="Term">{evaluation.semester}</td>
                          <td data-label="Course">{evaluation.courseId ? <Link className={styles.courseCode} href={`/courses/${evaluation.courseId}`}>{evaluation.courseCode}</Link> : <span className={styles.courseCode}>{evaluation.courseCode}</span>}</td>
                          <td data-label="Section" className={styles.dataValue}>{String(evaluation.section).padStart(2, "0")}</td>
                          <td data-label="Instructor" className={styles.dataValue}>{preciseRating(evaluation.instructorOverall)}</td>
                          <td data-label="Course" className={styles.dataValue}>{preciseRating(evaluation.courseOverall)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className={styles.emptyLine}>No public evaluation rows were available for this professor.</p>}
            </section>

            {hasFacultyDetails ? (
              <section className={styles.recordSection} id="faculty">
                <div className={styles.sectionHeading}>
                  <h2>Faculty details</h2>
                  <p>Contact and education information attached to this professor record.</p>
                </div>
                <dl className={styles.facultyDetails}>
                  {professor.office ? <div><dt>Office</dt><dd>{professor.office}</dd></div> : null}
                  {professor.email ? <div><dt>Email</dt><dd><a href={`mailto:${professor.email}`}>{professor.email}</a></dd></div> : null}
                  {professor.phone ? <div><dt>Phone</dt><dd><a href={`tel:${professor.phone}`}>{professor.phone}</a></dd></div> : null}
                  {professor.education.map((item, index) => <div key={`${item}-${index}`}><dt>Education</dt><dd>{item}</dd></div>)}
                </dl>
              </section>
            ) : null}
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
