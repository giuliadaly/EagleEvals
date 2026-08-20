import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { formatCount } from "@/data/format";
import { getSiteStats } from "@/data/queries";

export const metadata: Metadata = { title: "About", description: "About EagleEvals, an independent course-planning resource for Boston College students." };

export default async function AboutPage() {
  const stats = await getSiteStats();
  return (
    <InfoPage eyebrow="About" title="EagleEvals for BC students" intro="EagleEvals helps Boston College students choose classes with course information, professor details, numerical evaluations, and written input from BC students past and present.">
      <h2>What is on EagleEvals</h2>
      <p>Students can explore {formatCount(stats.courses)} courses, {formatCount(stats.professors)} professors, {formatCount(stats.reviews)} section evaluations, and {formatCount(stats.comments)} anonymous written comments. The information is organized around the questions that matter during registration: who taught a course, how students rated the experience, how much work it involved, and what former students said.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="info-stat"><strong>Useful</strong><span>Course, professor, rating, workload, and semester details stay connected.</span></div>
        <div className="info-stat"><strong>Anonymous</strong><span>New reviews require no account or identity fields.</span></div>
        <div className="info-stat"><strong>Independent</strong><span>This site is not operated by or affiliated with Boston College.</span></div>
      </div>
      <h2>How to read the ratings</h2>
      <p>Ratings summarize experiences from particular sections and semesters; they are not promises about a future class. Some courses, faculty roles, and teaching formats may have changed since an evaluation was submitted, so use the number, evidence count, term history, and written comments together.</p>
      <h2>Keep it useful for the next student</h2>
      <p>Every public evaluation is browsable, and BC students can add new anonymous ratings and comments. Submissions are checked against the course and professor database, reject contact information and links, and do not store account or identity fields.</p>
    </InfoPage>
  );
}
