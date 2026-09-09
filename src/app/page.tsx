import Link from "next/link";
import { HeroWing } from "@/components/hero-wing";
import { SearchBox } from "@/components/search-box";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getSiteStats } from "@/data/queries";
import { browseSubjects, serializeJsonLd } from "@/data/seo";
import styles from "./home.module.css";

export const revalidate = 3600;
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const stats = await getSiteStats();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: "EagleEvals", alternateName: "EagleEval", url: "https://eagleevals.com/", description: "Independent Boston College course and professor ratings and anonymous student reviews." }) }} />
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
          <p className={styles.sectionLabel}>Find your next class</p>
          <h2 id="browse-heading">Start with what<br />you’re studying.</h2>
          <nav className={styles.subjects} aria-label="Browse courses by subject">
            {browseSubjects.map(subject => <Link key={subject} href={`/courses?subject=${encodeURIComponent(subject)}`}>
              <span>{subject}</span><span aria-hidden="true">↗</span>
            </Link>)}
          </nav>
          <div className={styles.browseLinks}>
            <Link href="/courses">Browse all courses <span aria-hidden="true">↗</span></Link>
            <Link href="/professors">Have a professor in mind? <span aria-hidden="true">↗</span></Link>
          </div>
          <aside className={styles.note} aria-label="Pass on a little advice">
            <p>Someone’s about to take that class.</p>
            <div><Link href="/review">Pass on a little advice <span aria-hidden="true">↗</span></Link><small>Your review is anonymous.</small></div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
