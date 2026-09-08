import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { formatCount } from "@/data/format";
import { getSiteStats } from "@/data/queries";

export const metadata: Metadata = { alternates: { canonical: "/about" }, title: "About", description: "About EagleEvals, an independent course-planning resource for Boston College students." };

export default async function AboutPage() {
  const stats = await getSiteStats();
  return (
    <InfoPage eyebrow="About" title="EagleEvals for BC students" intro="EagleEvals helps Boston College students choose classes with course information, professor details, structured ratings, and written reviews from BC students past and present.">
      <h2>What is on EagleEvals</h2>
      <p>Students can explore {formatCount(stats.courses)} courses, {formatCount(stats.professors)} professors, {formatCount(stats.reviews)} section ratings, and {formatCount(stats.comments)} anonymous written reviews. The written archive combines reviews recovered from the original EagleEval with new EagleEvals submissions, and each review is labeled by source.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="info-stat"><strong>Useful</strong><span>Course, professor, rating, workload, and semester details stay connected.</span></div>
        <div className="info-stat"><strong>Anonymous</strong><span>New reviews require no account or identity fields.</span></div>
        <div className="info-stat"><strong>Independent</strong><span>This site is not operated by or affiliated with Boston College.</span></div>
      </div>
      <h2>How to read the ratings</h2>
      <p>Ratings summarize experiences from particular sections and semesters; they are not promises about a future class. Some courses, faculty roles, and teaching formats may have changed since an evaluation was submitted, so use the number, evidence count, term history, and written reviews together.</p>
      <h2>Keep it useful for the next student</h2>
      <p>Every public rating and written review is browsable, and BC students can add new anonymous reviews. Submissions are checked against the course and professor database, reject contact information and links, and do not store account or identity fields.</p>
    </InfoPage>
  );
}
