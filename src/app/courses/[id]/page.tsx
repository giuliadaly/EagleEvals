import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailDisclosure, DetailMetrics, DetailReviews, DetailScore } from "@/components/detail-page";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanTitle, collegeName, formatCount, formatRating } from "@/data/format";
import { getCourseDetail } from "@/data/queries";
import type { InstructorCourseRow } from "@/data/types";
import styles from "@/components/detail-page.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCourseDetail(id);
  if (!detail) return { title: "Course not found" };
  return { title: `${detail.course.code}: ${detail.course.title}`, description: `Historical ratings, workload, instructors, and student comments for ${detail.course.code} ${detail.course.title}.` };
}

function InstructorPairing({ instructor }: { instructor: InstructorCourseRow }) {
  return <div className={styles.related}>
    <Link href={`/professors/${instructor.id}`}>{instructor.name}</Link>
    {cleanTitle(instructor.titles[0]) ? <p>{cleanTitle(instructor.titles[0])}</p> : null}
    <p>{formatCount(instructor.reviewCount)} evaluation{instructor.reviewCount === 1 ? "" : "s"} for this course</p>
    <dl className={styles.pairRatings} aria-label="Ratings out of 5"><div><dt>Instructor</dt><dd>{formatRating(instructor.instructorOverall)}</dd></div><div><dt>Course</dt><dd>{formatRating(instructor.courseOverall)}</dd></div></dl>
  </div>;
}

export default async function CourseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; min?: string }> }) {
  const { id } = await params;
  const filters = await searchParams;
  const detail = await getCourseDetail(id);
  if (!detail) notFound();
  const { course, metrics, estimatedWeeklyHours, instructors, comments, semesters } = detail;
  const sort = ["rating", "course", "name"].includes(filters.sort ?? "") ? filters.sort! : "evidence";
  const min = [4, 4.5].includes(Number(filters.min)) ? Number(filters.min) : 0;
  const filtersActive = sort !== "evidence" || min !== 0;
  const visibleInstructors = instructors
    .filter(instructor => min === 0 || (instructor.instructorOverall ?? 0) >= min)
    .sort((a, b) => {
      if (sort === "rating") return (b.instructorOverall ?? -1) - (a.instructorOverall ?? -1) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name);
      if (sort === "course") return (b.courseOverall ?? -1) - (a.courseOverall ?? -1) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.reviewCount - a.reviewCount || a.name.localeCompare(b.name);
    });

  return <>
    <SiteHeader />
    <main className={styles.main}>
      <div className={styles.shell}>
        <Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: course.code }]} />
        <header className={styles.hero}>
          <div className={styles.identity}>
            <p className={styles.eyebrow}>{course.code} · {course.subject}</p>
            <h1>{course.title}</h1>
            {collegeName(course.college) ? <p className={styles.subtitle}>{collegeName(course.college)}</p> : null}
          </div>
          <div>
            <DetailScore value={course.courseOverall} label="Course rating" precision={1} />
            <p className={styles.evidence}>From {formatCount(course.reviewCount)} historical evaluations<br />Across {formatCount(instructors.length)} instructor{instructors.length === 1 ? "" : "s"}</p>
          </div>
        </header>

        <div className={styles.body}>
          <DetailReviews comments={comments} context="course" reviewHref={`/review?course=${course.id}`} archiveHref={`/comments?q=${encodeURIComponent(course.code)}`} />
          <aside className={styles.margin} aria-label="Instructors and course details">
            <section>
              <div className={styles.marginHeading}><h2>Who teaches this? <span className={styles.count}>{formatCount(instructors.length)}</span></h2></div>
              <p className={styles.ratingsNote}>Both ratings are out of 5, for each instructor’s sections of {course.code}.</p>
              {!filtersActive ? <div className={styles.relatedList}>{instructors.slice(0, 3).map(instructor => <InstructorPairing key={instructor.id} instructor={instructor} />)}</div> : null}
              <DetailDisclosure id="instructors" title={`All ${formatCount(instructors.length)} instructors · Sort & filter`} open={filtersActive}>
                <form className={styles.filters} action={`/courses/${course.id}#instructors`} method="get">
                  <label><span className="form-label">Order instructors</span><select className="form-control" name="sort" defaultValue={sort}><option value="evidence">Most evaluations</option><option value="rating">Highest instructor rating</option><option value="course">Highest course rating</option><option value="name">Name A–Z</option></select></label>
                  <label><span className="form-label">Minimum instructor rating</span><select className="form-control" name="min" defaultValue={String(min)}><option value="0">Any rating</option><option value="4">4.0 and above</option><option value="4.5">4.5 and above</option></select></label>
                  <button className="button-primary" type="submit">Apply filters</button>
                </form>
                <p className={styles.filterStatus}>{formatCount(visibleInstructors.length)} of {formatCount(instructors.length)} instructors</p>
                {visibleInstructors.length ? <div className={styles.relatedList}>{visibleInstructors.map(instructor => <InstructorPairing key={instructor.id} instructor={instructor} />)}</div> : <p className={styles.detailText}>No instructors match those filters.</p>}
              </DetailDisclosure>
            </section>
            <div className={styles.marginDetails}>
              <DetailDisclosure id="description" title="About this course"><p className={styles.detailText}>{course.description || "No course description is currently available."}</p></DetailDisclosure>
              <DetailDisclosure id="metrics" title="All evaluation ratings">
                <p className={styles.ratingsNote}>Averages use the original five-point historical evaluation scale.</p>
                <DetailMetrics metrics={metrics} />
                <div className={styles.workload}><strong>Weekly effort: {estimatedWeeklyHours === null ? "Not collected" : `~${estimatedWeeklyHours} hours`}</strong><p className={styles.detailText}>Estimated from the original workload response buckets. Individual sections may differ.</p></div>
              </DetailDisclosure>
              <a className={styles.textLink} href="#history">Evaluation history <span aria-hidden="true">↓</span></a>
              <Link className={styles.textLink} href={`/evaluations?q=${encodeURIComponent(course.code)}`}>Browse all evaluations <span aria-hidden="true">↗</span></Link>
            </div>
          </aside>
        </div>

        <DetailDisclosure id="history" title={<>Evaluation history <span className={styles.count}>{formatCount(semesters.length)} terms</span></>} className={styles.history}>
          {semesters.length ? <div className={styles.tableWrap}><table className={styles.table}>
            <caption>All available terms for {course.code}. Section averages use the original five-point scale.</caption>
            <thead><tr><th scope="col">Term</th><th scope="col">Sections</th><th scope="col">Course rating</th><th scope="col">Instructor rating</th></tr></thead>
            <tbody>{semesters.map(semester => <tr key={semester.semester}>
              <td data-label="Term">{semester.semester}</td>
              <td data-label="Sections" className={styles.numeric}>{formatCount(semester.reviewCount)}</td>
              <td data-label="Course rating" className={styles.numeric}>{formatRating(semester.courseOverall)}</td>
              <td data-label="Instructor rating" className={styles.numeric}>{formatRating(semester.instructorOverall)}</td>
            </tr>)}</tbody>
          </table></div> : <p className={styles.detailText}>No evaluation history is currently available.</p>}
        </DetailDisclosure>
      </div>
    </main>
    <SiteFooter />
  </>;
}
