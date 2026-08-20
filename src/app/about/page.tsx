import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { formatCount } from "@/data/format";
import { getSiteStats } from "@/data/queries";

export const metadata: Metadata = { title: "About the recovery", description: "How EagleEvals recovered and preserved the useful historical EagleEval archive." };

export default async function AboutPage() {
  const stats = await getSiteStats();
  return (
    <InfoPage eyebrow="The project" title="Why EagleEvals is back" intro="The original EagleEval became a showcase instead of the course-planning resource students relied on. This independent rebuild preserves what was useful and gives it a durable new home.">
      <h2>What was recovered</h2>
      <p>The public legacy application still exposed enough structured information to reconstruct most of its useful archive. We preserved and verified {formatCount(stats.courses)} courses, {formatCount(stats.professors)} professors, {formatCount(stats.reviews)} historical section evaluations, and {formatCount(stats.comments)} anonymized student comments before moving them into a new managed database.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="info-stat"><strong>Verified</strong><span>Counts and relationships were reconciled after migration.</span></div>
        <div className="info-stat"><strong>Anonymous</strong><span>New reviews require no account or identity fields.</span></div>
        <div className="info-stat"><strong>Independent</strong><span>This site is not operated by or affiliated with Boston College.</span></div>
      </div>
      <h2>How to read the ratings</h2>
      <p>The numerical ratings are historical averages from available Boston College course-evaluation records. They describe particular sections and semesters; they are not promises about a future class. Some courses, faculty roles, and teaching formats may have changed since the data was collected.</p>
      <h2>Keeping it useful</h2>
      <p>The complete recovered evaluation archive is now publicly browsable, not just summarized. Students can also add new anonymous ratings and comments. Submissions are validated against the course and professor database, reject contact information and links, and do not store account or identity fields.</p>
    </InfoPage>
  );
}
