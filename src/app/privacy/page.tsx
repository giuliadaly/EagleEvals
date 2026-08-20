import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Privacy", description: "EagleEvals privacy information." };

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Policy" title="Privacy" intro="EagleEvals provides a recovered public archive and accepts new reviews without user accounts or identity fields.">
      <p><strong>Last updated: August 19, 2026.</strong></p>
      <h2>Information in the archive</h2>
      <p>The site displays course catalog information, public faculty-directory details, aggregated historical evaluation results, and anonymized historical comments recovered from the prior EagleEval service. Legacy user identifiers were excluded from the migration.</p>
      <h2>Information collected when you visit</h2>
      <p>EagleEvals does not ask for your name, email address, password, or student credentials. The hosting and database providers may process ordinary technical information needed to serve and protect the site, such as an IP address, browser type, request path, timestamp, and security logs.</p>
      <h2>Anonymous review submissions</h2>
      <p>New reviews store the selected course and professor, semester, section, ratings, written comment, and whether the student would take the professor again. The application does not save a name, account, email address, student ID, IP address, user agent, cookie identifier, or browser fingerprint with a review. Hosting providers may still retain ordinary infrastructure and security logs under their own policies.</p>
      <h2>Searches and cookies</h2>
      <p>Search terms are used to return matching database records. The application does not set an advertising profile and does not include third-party advertising. Essential hosting or security cookies may be used by infrastructure providers.</p>
      <h2>Corrections and future changes</h2>
      <p>Records and submissions may be corrected, unpublished, or removed when necessary. This policy will be updated if EagleEvals later adds accounts, new analytics, or additional data collection.</p>
    </InfoPage>
  );
}
