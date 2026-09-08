import Link from "next/link";
import { PerchedEagle } from "@/components/perched-eagle";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`page-shell ${styles.inner}`}>
        <div className={styles.brand}>
          <div><span className={styles.wordmark}>eagleevals</span><p className={styles.independent}>Independent of Boston College</p></div>
          <p className={styles.note}>Made for the next<br />person in your seat.</p>
          <div className={styles.eagle}><PerchedEagle /></div>
        </div>
        <nav className={styles.links} aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/review">Write a review <span aria-hidden="true">↗</span></Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
      </div>
    </footer>
  );
}
