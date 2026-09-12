import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { HeroWing } from "@/components/hero-wing";
import { SearchBox } from "@/components/search-box";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getSiteStats } from "@/data/queries";
import { browseSubjectGroups, serializeJsonLd } from "@/data/seo";
import styles from "./home.module.css";

export const revalidate = 3600;
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const stats = await getSiteStats();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": "https://eagleevals.com/#website",
        name: "EagleEvals",
        alternateName: "Eagle Evals",
        url: "https://eagleevals.com/",
        description: "Independent Boston College course and professor ratings and anonymous student reviews.",
        inLanguage: "en",
      }) }} />
      <SiteHeader showSearch={false} />
      <main className={styles.main}>
        <section className={styles.heroBand} data-plane-scene>
          <div className={`page-shell ${styles.hero}`}>
            <div className={styles.heroCopy}>
              <p className={styles.overline}>For BC students, by BC students.</p>
              <h1>A little advice<br /><span>before you register.</span></h1>
              <p className={styles.intro}>Course reviews from people who’ve<br className={styles.desktopBreak} /> actually taken the class.</p>
              <div className={styles.search}><SearchBox hero /></div>
              <div className={styles.searchCaption}><span>{formatCount(stats.courses)} courses to explore</span><span>No account needed</span></div>
            </div>
            <figure className={styles.heroArt}>
              <HeroWing />
              <figcaption>notes from the other<br />side of the syllabus.</figcaption>
            </figure>
          </div>
        </section>
        <section className={`page-shell ${styles.start}`} aria-labelledby="browse-heading">
          <div className={styles.browseHeading}>
            <div>
              <p className={styles.sectionLabel}>Find your next class</p>
              <h2 id="browse-heading">Start with a subject.</h2>
            </div>
            <Link href="/courses" className={styles.allCourses}>Browse all courses<ChevronIcon /></Link>
          </div>
          <nav className={styles.subjects} aria-label="Browse courses by subject">
            {browseSubjectGroups.map(group => <div className={styles.subjectGroup} key={group.name}>
              <h3>{group.name}</h3>
              <ul>
                {group.subjects.map(subject => <li key={subject}>
                  <Link href={`/courses?subject=${encodeURIComponent(subject)}`} prefetch={false}>
                    <span>{subject}</span><ChevronIcon />
                  </Link>
                </li>)}
              </ul>
            </div>)}
          </nav>
          <div className={styles.browseLinks}>
            <span>Have a professor in mind?</span>
            <Link href="/professors">Find a professor</Link>
          </div>
          <aside className={styles.note} aria-label="Pass on a little advice">
            <p>Someone’s about to take that class.</p>
            <div><Link href="/review">Pass on a little advice</Link><small>Your review is anonymous.</small></div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
