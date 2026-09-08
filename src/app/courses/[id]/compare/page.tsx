import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailReview } from "@/components/detail-reviews";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCourseDetail } from "@/data/queries";
import { comparisonSelection } from "@/data/comparison";
import { formatCount } from "@/data/format";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Compare professors", robots: { index: false, follow: true } };

export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ professor?: string | string[] }> }) {
  const { id } = await params;
  const detail = await getCourseDetail(id);
  if (!detail) notFound();
  const { course, instructors, comments } = detail;
  const selection = comparisonSelection((await searchParams).professor, instructors.map(item => item.id));
  const selected = selection.ids.map(id => instructors.find(item => item.id === id)!);
  const options = [...instructors].sort((a, b) => a.name.localeCompare(b.name));
  const rating = (value: number | null) => value === null ? "Not collected" : `${value.toFixed(2)} / 5`;
  return <><SiteHeader /><main className={styles.main}><div className="page-shell">
    <Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: course.code, href: `/courses/${id}` }, { label: "Compare professors" }]} />
    <header className={styles.heading}><p className="eyebrow">{course.code} · {course.title}</p><h1>Same class.<br />Different professors.</h1><p>Compare two or three professors using evaluations for this course. These are historical records, not this semester’s teaching schedule.</p></header>
    {options.length >= 2 ? <form className={styles.picker} action={`/courses/${id}/compare#comparison`}>
      {[0, 1, 2].map(index => <label key={index}><span className="form-label">Professor {index + 1}{index === 2 ? " · Optional" : ""}</span><select className="form-control" name="professor" required={index < 2} defaultValue={selection.ids[index] ?? ""}><option value="">{index === 2 ? "No third professor" : "Choose a professor"}</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
      <button className="button-primary">Compare professors</button>
    </form> : <p className={styles.note}>This course needs evaluations from at least two professors before they can be compared.</p>}
    {selection.error ? <p role="alert" className={styles.error}>{selection.error}</p> : null}
    {selected.length ? <section id="comparison" className={styles.results} aria-label={`Professor comparison for ${course.code}`}>
      <p className={styles.note}>Both ratings are out of 5 and use only {course.code} evaluations. Consider how many evaluations each average includes and when the class was taught.</p>
      <h2 className={styles.tableHeading}>Professor comparison for {course.code}</h2>
      <p className={styles.scrollHint}>Swipe across the table to see each professor →</p>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Comparison table; scroll horizontally on smaller screens"><table className={styles.table}>
        <caption className="sr-only">Professor comparison for {course.code}</caption>
        <thead><tr><th scope="col">For {course.code}</th>{selected.map(item => <th scope="col" key={item.id}><Link href={`/professors/${item.id}`}>{item.name}</Link></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Instructor rating</th>{selected.map(item => <td key={item.id}>{rating(item.instructorOverall)}</td>)}</tr>
          <tr><th scope="row">Course rating</th>{selected.map(item => <td key={item.id}>{rating(item.courseOverall)}</td>)}</tr>
          <tr><th scope="row">Evaluations</th>{selected.map(item => <td key={item.id}>{formatCount(item.reviewCount)}</td>)}</tr>
          <tr><th scope="row">Latest recorded term</th>{selected.map(item => <td key={item.id}>{item.latestSemester ?? "Not recorded"}</td>)}</tr>
          <tr><th scope="row">Written reviews</th>{selected.map(item => <td key={item.id}><a href={`#reviews-${item.id}`}>{comments.filter(comment => comment.professorId === item.id).length} reviews ↓</a></td>)}</tr>
        </tbody>
      </table></div>
      <div className={styles.reviewColumns} data-count={selected.length}>{selected.map(item => {
        const reviews = comments.filter(comment => comment.professorId === item.id);
        return <section key={item.id} id={`reviews-${item.id}`} className={styles.professorReviews}><h2>{item.name}</h2><p className={styles.note}>{course.code} · Newest posts first</p>
          {reviews.length ? <>{reviews.slice(0, 2).map(comment => <DetailReview key={comment.id} comment={comment} context="professor" />)}{reviews.length > 2 ? <details><summary>Read {reviews.length - 2} more reviews</summary>{reviews.slice(2).map(comment => <DetailReview key={comment.id} comment={comment} context="professor" />)}</details> : null}</> : <p className={styles.note}>No written reviews for this pairing yet.</p>}
          <Link className={styles.reviewLink} href={`/review?course=${id}&professor=${item.id}`}>Review this class ↗</Link>
        </section>;
      })}</div>
    </section> : options.length >= 2 && !selection.error ? <p className={styles.note}>Choose the professors you’re considering to see their ratings and reviews together.</p> : null}
    <Link className={styles.reviewLink} href={`/courses/${id}`}>← Back to {course.code}</Link>
  </div></main><SiteFooter /></>;
}
