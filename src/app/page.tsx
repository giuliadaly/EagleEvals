import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount, formatRating } from "@/data/format";
import { getFeaturedCourses, getFeaturedProfessors, getSiteStats } from "@/data/queries";
import styles from "./home.module.css";

export const revalidate = 3600;

export default async function Home() {
  const [stats, courses, professors] = await Promise.all([
    getSiteStats(),
    getFeaturedCourses(),
    getFeaturedProfessors(),
  ]);

  return (
    <>
      <SiteHeader showSearch={false} />
      <main className={styles.main}>
        <section className={`page-shell ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1>Choose the class.<br />Know the professor.</h1>
            <p>Explore course and professor evaluations from BC students past and present, understand the tradeoffs behind a rating, and add a fully anonymous review after the semester.</p>
            <div className={styles.searchBlock}>
              <span>What are you considering?</span>
              <SearchBox />
              <small>Start with a course code when you have one. It is the fastest route to comparable instructors.</small>
            </div>
          </div>

          <aside className={styles.archiveLedger} aria-label="EagleEvals data summary">
            <h2>EagleEvals at a glance</h2>
            <div><span>Structured evaluations</span><strong>{formatCount(stats.reviews)}</strong></div>
            <div><span>Courses</span><strong>{formatCount(stats.courses)}</strong></div>
            <div><span>Professors</span><strong>{formatCount(stats.professors)}</strong></div>
            <div><span>Written comments</span><strong>{formatCount(stats.comments)}</strong></div>
            <Link href="/about">About EagleEvals</Link>
          </aside>
        </section>

        <div className={styles.trustLine}>
          <div className="page-shell">
            <strong>Independent and student-run.</strong>
            <span>Read every public evaluation without an account. New reviews are anonymous.</span>
          </div>
        </div>

        <section className={`page-shell ${styles.directorySection}`}>
          <div className={styles.sectionHeading}>
            <h2>Start with a course</h2>
            <p>Popular courses with the deepest historical record.</p>
            <Link href="/courses">Browse and filter all courses</Link>
          </div>
          <div className={styles.recordList}>
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className={styles.recordRow}>
                <div><span className={styles.code}>{course.code}</span><h3>{course.title}</h3><p>{course.subject}</p></div>
                <div className={styles.rowEvidence}><span><strong>{formatRating(course.courseOverall)}</strong> course</span><span><strong>{formatCount(course.reviewCount)}</strong> evaluations</span></div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.paperBand}>
          <div className={`page-shell ${styles.directorySection}`}>
            <div className={styles.sectionHeading}>
              <h2>Then check the professor</h2>
              <p>Open the record, scan the decision, then read the comments.</p>
              <Link href="/professors">Browse and filter all professors</Link>
            </div>
            <div className={styles.recordList}>
              {professors.map((professor) => (
                <Link key={professor.id} href={`/professors/${professor.id}`} className={styles.recordRow}>
                  <div><h3>{professor.name}</h3><p>{professor.titles[0] ?? "Boston College faculty"}</p></div>
                  <div className={styles.rowEvidence}><span><strong>{formatRating(professor.instructorOverall)}</strong> instructor</span><span><strong>{formatCount(professor.reviewCount)}</strong> evaluations</span></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={`page-shell ${styles.reviewCallout}`}>
          <div>
            <h2>Leave the next student something useful.</h2>
            <p>No account, name, email, student ID, IP address, or browser identifier is stored with a review.</p>
          </div>
          <Link className="button-primary" href="/review">Write an anonymous review</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
