import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailDisclosure, DetailMetrics, DetailReviews, DetailScore, preciseRating } from "@/components/detail-page";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanTitle, formatCount } from "@/data/format";
import { getProfessorDetail } from "@/data/queries";
import type { ProfessorCourseRow } from "@/data/types";
import styles from "@/components/detail-page.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProfessorDetail(id);
  if (!detail) return { title: "Professor not found" };
  return { title: detail.professor.name, description: `Ratings, courses, evaluation history, and anonymous written reviews for ${detail.professor.name} at Boston College.` };
}

function CoursePairing({ course }: { course: ProfessorCourseRow }) {
  return <div className={styles.related}>
    <Link href={`/courses/${course.id}`}>{course.code}</Link>
    <p>{course.title}</p>
    <p>{formatCount(course.reviewCount)} evaluation{course.reviewCount === 1 ? "" : "s"}</p>
    <dl className={styles.pairRatings} aria-label="Ratings out of 5"><div><dt>Instructor</dt><dd>{preciseRating(course.instructorOverall)}</dd></div><div><dt>Course</dt><dd>{preciseRating(course.courseOverall)}</dd></div></dl>
  </div>;
}

export default async function ProfessorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProfessorDetail(id);
  if (!detail) notFound();
  const { professor, metrics, courses, comments, evaluations } = detail;
  const titles = professor.titles.map(cleanTitle).filter(Boolean);
  const hasFacultyDetails = Boolean(professor.office || professor.email || professor.phone || professor.education.length);

  return <>
    <SiteHeader />
    <main className={styles.main}>
      <div className={styles.shell}>
        <Breadcrumbs items={[{ label: "Professors", href: "/professors" }, { label: professor.name }]} />
        <header className={styles.hero} id="decision">
          <div className={styles.identity}>
            <p className={styles.eyebrow}>Professor profile</p>
            <h1>{professor.name}</h1>
            <p className={styles.subtitle}>{titles.length ? titles.join(" · ") : "Boston College faculty"}</p>
          </div>
          <div>
            <div className={styles.scoreGroup} aria-label="Professor rating summary"><DetailScore value={professor.instructorOverall} label="Instructor" /><DetailScore value={professor.courseOverall} label="Course" /></div>
            <p className={styles.evidence}>From {formatCount(professor.reviewCount)} structured evaluations<br />Latest term: {evaluations[0]?.semester ?? "Unavailable"}</p>
          </div>
        </header>

        <div className={styles.body}>
          <DetailReviews comments={comments} context="professor" reviewHref={`/review?professor=${professor.id}`} />
          <aside className={styles.margin} aria-label="Courses and professor details">
            <section id="courses">
              <div className={styles.marginHeading}><h2>Courses taught <span className={styles.count}>{formatCount(courses.length)}</span></h2></div>
              {courses.length ? <>
                <p className={styles.ratingsNote}>Both ratings are out of 5, for this professor’s sections of each course.</p>
                <div className={styles.relatedList}>{courses.slice(0, 3).map(course => <CoursePairing key={course.id} course={course} />)}</div>
                {courses.length > 3 ? <DetailDisclosure title={`Show ${formatCount(courses.length - 3)} more course${courses.length === 4 ? "" : "s"}`}><div className={styles.relatedList}>{courses.slice(3).map(course => <CoursePairing key={course.id} course={course} />)}</div></DetailDisclosure> : null}
              </> : <p className={styles.detailText}>No course relationships were available in the evaluation record.</p>}
            </section>
            <div className={styles.marginDetails}>
              {hasFacultyDetails ? <DetailDisclosure id="faculty" title="Faculty details">
                <dl className={styles.faculty}>
                  {professor.office ? <div><dt>Office</dt><dd>{professor.office}</dd></div> : null}
                  {professor.email ? <div><dt>Email</dt><dd><a href={`mailto:${professor.email}`}>{professor.email}</a></dd></div> : null}
                  {professor.phone ? <div><dt>Phone</dt><dd><a href={`tel:${professor.phone}`}>{professor.phone}</a></dd></div> : null}
                  {professor.education.map((item, index) => <div key={`${item}-${index}`}><dt>Education</dt><dd>{item}</dd></div>)}
                </dl>
              </DetailDisclosure> : null}
              <DetailDisclosure id="metrics" title="All evaluation ratings">
                <p className={styles.ratingsNote}>Instructor and course ratings answer different questions. Written reviews do not change either average. Missing responses are shown as “Not collected.”</p>
                <DetailMetrics metrics={metrics} />
              </DetailDisclosure>
              <a className={styles.textLink} href="#history">Term and section history <span aria-hidden="true">↓</span></a>
            </div>
          </aside>
        </div>

        <DetailDisclosure id="history" title={<>Term and section history <span className={styles.count}>{formatCount(evaluations.length)} records</span></>} className={styles.history}>
          {evaluations.length ? <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>Every public structured evaluation for {professor.name}. Ratings are out of 5.</caption>
              <thead><tr><th scope="col">Term</th><th scope="col">Course</th><th scope="col">Section</th><th scope="col">Instructor</th><th scope="col">Course rating</th></tr></thead>
              <tbody>{evaluations.map(evaluation => <tr key={evaluation.id}>
                <td data-label="Term">{evaluation.semester}</td>
                <td data-label="Course">{evaluation.courseId ? <Link href={`/courses/${evaluation.courseId}`}>{evaluation.courseCode}</Link> : evaluation.courseCode}</td>
                <td data-label="Section" className={styles.numeric}>{evaluation.section === null ? "Not provided" : String(evaluation.section).padStart(2, "0")}</td>
                <td data-label="Instructor" className={styles.numeric}>{preciseRating(evaluation.instructorOverall)}</td>
                <td data-label="Course rating" className={styles.numeric}>{preciseRating(evaluation.courseOverall)}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className={styles.detailText}>No public evaluation rows were available for this professor.</p>}
        </DetailDisclosure>
      </div>
    </main>
    <SiteFooter />
  </>;
}
