import Image from "next/image";
import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount, formatRating, formatWrittenReviewCount } from "@/data/format";
import { getFeaturedCourses, getSiteStats } from "@/data/queries";
import styles from "./home.module.css";

export const revalidate = 3600;
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [stats, courses] = await Promise.all([getSiteStats(), getFeaturedCourses()]);
  return (
    <>
      <SiteHeader showSearch={false} />
      <main className={styles.main}>
        <section className={styles.heroBand}>
          <div className={`page-shell ${styles.hero}`}>
            <div className={styles.heroCopy}>
              <p className={styles.overline}>For BC students, by BC students.</p>
              <h1>A little advice<br /><span>before you register.</span></h1>
              <p className={styles.intro}>Course reviews from people who’ve<br className={styles.desktopBreak} /> actually taken the class.</p>
              <div className={styles.search}><SearchBox hero /></div>
              <div className={styles.searchCaption}><span>{formatCount(stats.courses)} courses to explore</span><span>No account needed</span></div>
            </div>
            <figure className={styles.heroArt}>
              <Image src="/brand/wing-sculptural.webp" alt="" width={640} height={640} sizes="(max-width: 600px) 110px, (max-width: 1100px) 35vw, 430px" preload />
              <figcaption>notes from the other<br />side of the syllabus.</figcaption>
            </figure>
          </div>
        </section>
        <section className={`page-shell ${styles.start}`}>
          <h2>A few places to start</h2>
          <div className={styles.spread}>
            <div>
              <div className={styles.listLabels}><span>Course</span><span>Overall rating</span></div>
              {courses.slice(0,3).map(course => (
                <Link key={course.id} href={`/courses/${course.id}`} className={styles.course}>
                  <div><span className={styles.code}>{course.code}</span><h3>{course.title}</h3><p>{formatCount(course.reviewCount)} ratings <span>·</span> {formatWrittenReviewCount(course.commentCount)}</p></div>
                  <div className={styles.rating}><strong>{formatRating(course.courseOverall)}</strong><span>{course.courseOverall === null ? "No rating" : "/ 5"}</span></div>
                  <span className={styles.arrow} aria-hidden="true">↗</span>
                </Link>
              ))}
              <Link className={styles.browse} href="/courses">Browse all courses <span aria-hidden="true">↗</span></Link>
            </div>
            <aside className={styles.note} aria-label="A note for you">
              <Image className={styles.paperclip} src="/brand/paperclip.webp" alt="" width={240} height={320} sizes="55px" />
              <span className={styles.noteLabel}>a note for you</span>
              <p className={styles.hand}>Someone’s about<br />to take that class<br />you just finished.</p>
              <p className={styles.noteBody}>What do you wish<br />you’d known?</p>
              <Link href="/review">Pass it on <span aria-hidden="true">↗</span></Link>
              <small>Your review is anonymous.</small>
            </aside>
          </div>
        </section>
        <div className={`page-shell ${styles.professorLine}`}><p>Have a professor in mind?</p><Link href="/professors">Find their reviews <span aria-hidden="true">↗</span></Link></div>
      </main>
      <SiteFooter />
    </>
  );
}
