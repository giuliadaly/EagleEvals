import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SearchBox } from "@/components/search-box";
import styles from "./site-header.module.css";

export function Brand() {
  return (
    <div className={styles.brand}>
      <Link href="/" className={styles.wordmark} aria-label="EagleEvals home">
        <BrandMark className={styles.mark} /><span>eagleevals</span>
      </Link>
      <small className={styles.independence}>Independent of Boston College</small>
    </div>
  );
}

export function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className={styles.header}>
      <div className={`page-shell ${styles.inner}`}>
        <Brand />
        {showSearch ? <div className={styles.search}><SearchBox compact /></div> : null}
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link href="/courses">Courses</Link><Link href="/professors">Professors</Link>
          <Link href="/comments">Reviews</Link><Link href="/evaluations">Ratings</Link>
        </nav>
        <Link className={styles.review} href="/review">Write a review <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
  );
}
