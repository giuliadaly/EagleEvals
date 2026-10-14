import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { formatCount } from "@/data/format";
import { getSiteStats } from "@/data/queries";

export const metadata: Metadata = { alternates: { canonical: "/about" }, title: "About", description: "About EagleEvals, an independent course-planning resource for Boston College students." };

export default async function AboutPage() {
  const stats = await getSiteStats();
  return (
    <InfoPage eyebrow="About" title="EagleEvals for BC students" intro="EagleEvals (Eagle Evals) helps Boston College students choose classes with course information, professor details, numerical ratings, and written reviews from BC students past and present.">
      <h2>What is on EagleEvals</h2>
      <p>Students can explore {formatCount(stats.courses)} courses, {formatCount(stats.professors)} professors, {formatCount(stats.reviews)} numerical rating records, and {formatCount(stats.comments)} written reviews. The collection combines the original EagleEval archive, recovered Boston College comments from Rate My Professors, and new anonymous submissions. This site is at eagleevals.com; the original eagleeval.com is a separate website.</p>
      <p>Written reviews appear together and count toward the totals shown on course and professor pages. Imported comments retain their original posting date and a link to the original review. A posting date does not establish when someone took a class. Reviews without a verified course or professor match remain searchable in the full review archive.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="info-stat"><strong>Useful</strong><span>Course, professor, rating, workload, and semester details stay connected.</span></div>
        <div className="info-stat"><strong>Anonymous</strong><span>New reviews require no account or identity fields.</span></div>
        <div className="info-stat"><strong>Independent</strong><span>This site is not operated by or affiliated with Boston College.</span></div>
      </div>
      <h2 id="ratings" className="scroll-mt-32">How to read the ratings</h2>
      <p>Historical records contain section-level evaluation summaries. New submissions add individual 1–5 ratings and a written comment. Scores average the available numerical values, treating each record equally; the counts refer to records, not the number of students represented.</p>
      <p>Written comments are counted separately from numerical evaluation records. Imported comment ratings are not mixed into the numerical evaluation averages. A zero written-review count means no published comments have been linked to that course or professor in the current collection.</p>
      <p>Ratings summarize experiences from particular sections and semesters; they are not promises about a future class. Some courses, faculty roles, and teaching formats may have changed since an evaluation was submitted, so use the number, evidence count, term history, and written reviews together.</p>
      <h2>Keep it useful for the next student</h2>
      <p>Every public rating and written review is browsable, and BC students can add new anonymous reviews. Submissions are checked against the course and professor database, reject contact information and links, and do not store account or identity fields.</p>
    </InfoPage>
  );
}
