import type { Metadata } from "next";
import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { notFound } from "next/navigation";
import { DetailDisclosure, DetailMetrics, DetailReviews, DetailRatingEvidence, DetailScore } from "@/components/detail-page";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SharePage } from "@/components/share-page";
import { detailSharingMetadata } from "@/data/sharing";
import { cleanTitle, collegeName, formatCount, formatRating } from "@/data/format";
import { getCourseDetail } from "@/data/queries";
import { reportHref } from "@/data/report-validation";
import type { InstructorCourseRow } from "@/data/types";
import styles from "@/components/detail-page.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCourseDetail(id);
  if (!detail) return { alternates: { canonical: `/courses/${id}` }, title: "Course not found", robots: { index: false, follow: false } };
  return detailSharingMetadata(`/courses/${id}`, `${detail.course.code}: ${detail.course.title} at Boston College`, `Read Boston College student reviews of ${detail.course.code} ${detail.course.title}. Compare instructors, numerical ratings, workload, and evaluation history.`);
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
  const { course, metrics, instructors, comments, semesters } = detail;
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
            {course.catalogSource === "historical_archive" ? <p className={styles.subtitle}><strong>Historical course archive.</strong> Saved student experiences; this page does not confirm a current offering.</p> : null}
            {collegeName(course.college) ? <p className={styles.subtitle}>{collegeName(course.college)}</p> : null}
            <div className={styles.actions}>
              {instructors.length >= 2 ? <Link className={styles.textLink} href={`/courses/${course.id}/compare`}>Compare professors <ChevronIcon /></Link> : null}
              <SharePage path={`/courses/${course.id}`} title={`${course.code}: ${course.title}`} />
              <Link href={reportHref("course", course.id)}>Suggest a correction</Link>
            </div>
          </div>
          <div>
            <p className={styles.ratingLabel}>Scores from numerical evaluations</p>
            <DetailScore value={course.courseOverall} label="Course rating" precision={1} />
            <DetailRatingEvidence evaluationCount={course.reviewCount} writtenCount={course.commentCount} hasOverallRating={course.courseOverall !== null}>Across {formatCount(instructors.length)} instructor{instructors.length === 1 ? "" : "s"}</DetailRatingEvidence>
          </div>
        </header>

        <div className={styles.body}>
          <DetailReviews comments={comments} context="course" instructors={instructors} reviewHref={`/review?course=${course.id}`} archiveHref={`/comments?q=${encodeURIComponent(course.code)}`} />
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
              <DetailDisclosure id="description" title="About this course"><p className={styles.detailText}>{course.description || "No course description is currently available."}</p>
                {course.catalogSource === "historical_archive" && course.catalogEvidence?.length ? <ul className={styles.detailText}>{course.catalogEvidence.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul> : null}
              </DetailDisclosure>
              <DetailDisclosure id="metrics" title="All evaluation ratings">
                <p className={styles.ratingsNote}>Averages use numerical 1–5 ratings, including the ratings submitted with new anonymous reviews.</p>
                <DetailMetrics metrics={metrics} />
              </DetailDisclosure>
              <a className={styles.textLink} href="#history">Evaluation history <ChevronIcon direction="down" /></a>
              <Link className={styles.textLink} href={`/evaluations?q=${encodeURIComponent(course.code)}`}>Browse all evaluations <ChevronIcon /></Link>
            </div>
          </aside>
        </div>

        <DetailDisclosure id="history" title={<>Evaluation history <span className={styles.count}>{formatCount(semesters.length)} terms</span></>} className={styles.history}>
          {semesters.length ? <div className={styles.tableWrap}><table className={styles.table}>
            <caption>All available terms for {course.code}. Numerical averages use the five-point scale.</caption>
            <thead><tr><th scope="col">Term</th><th scope="col">Evaluations</th><th scope="col">Course rating</th><th scope="col">Instructor rating</th></tr></thead>
            <tbody>{semesters.map(semester => <tr key={semester.semester}>
              <td data-label="Term">{semester.semester}</td>
              <td data-label="Evaluations" className={styles.numeric}>{formatCount(semester.reviewCount)}</td>
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
