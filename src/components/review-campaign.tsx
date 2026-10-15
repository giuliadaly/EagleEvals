import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { reviewCampaignCopy, reviewCampaignCourses } from "@/data/review-campaign";
import styles from "./review-campaign.module.css";

export function ReviewCampaign() {
  return <>
    <section className={styles.intro}><div className="page-shell">
      <p className="eyebrow">{reviewCampaignCopy.eyebrow}</p>
      <h1>{reviewCampaignCopy.title}</h1>
      <p className={styles.lead}>{reviewCampaignCopy.intro}</p>
      <p className={styles.privacy}>{reviewCampaignCopy.privacy}</p>
    </div></section>
    <section className={`page-shell ${styles.classes}`} aria-labelledby="campaign-classes">
      <div className={styles.heading}><h2 id="campaign-classes">{reviewCampaignCopy.courseListHeading}</h2><p>These are a few places to start. Your experience in any class can help.</p></div>
      <div className={styles.courseList}>{reviewCampaignCourses.map(course => <Link key={course.id} href={course.reviewHref} className={styles.course}>
        <span className={styles.subject}>{course.subject}</span><strong>{course.code}</strong><span className={styles.title}>{course.title}</span><span className={styles.action}>Review this class <ChevronIcon /></span>
      </Link>)}</div>
      <Link className="button-primary" href={reviewCampaignCopy.otherCourseHref}>{reviewCampaignCopy.otherCourseLabel} <ChevronIcon /></Link>
    </section>
    <section className={`page-shell ${styles.notes}`} aria-labelledby="campaign-prompts"><div><p className="eyebrow">A few words go a long way</p><h2 id="campaign-prompts">What would you tell a friend?</h2><ul>{reviewCampaignCopy.prompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul></div><p className={styles.semester}>{reviewCampaignCopy.semesterNote}</p></section>
  </>;
}
