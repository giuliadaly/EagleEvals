import Link from "next/link";
import { PerchedEagle } from "@/components/perched-eagle";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`page-shell ${styles.inner}`}>
        <div className={styles.top}>
          <p>Good advice gets passed around.</p>
          <nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/review">Write a review <span aria-hidden="true">↗</span></Link></nav>
        </div>
        <div className={styles.brand}><span>eagleevals</span><PerchedEagle /></div>
        <div className={styles.bottom}>
          <p>Made for the next person in your seat.</p>
          <nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
          <p>Independent of Boston College</p>
        </div>
      </div>
    </footer>
  );
}
