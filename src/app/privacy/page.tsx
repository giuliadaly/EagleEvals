import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Privacy", description: "EagleEvals privacy information." };

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Policy" title="Privacy" intro="EagleEvals currently provides read-only access to a recovered public archive and does not offer user accounts or review submission.">
      <p><strong>Last updated: August 13, 2026.</strong></p>
      <h2>Information in the archive</h2>
      <p>The site displays course catalog information, public faculty-directory details, aggregated historical evaluation results, and anonymized historical comments recovered from the prior EagleEval service. Legacy user identifiers were excluded from the migration.</p>
      <h2>Information collected when you visit</h2>
      <p>EagleEvals does not ask for your name, email address, password, or student credentials. The hosting and database providers may process ordinary technical information needed to serve and protect the site, such as an IP address, browser type, request path, timestamp, and security logs.</p>
      <h2>Searches and cookies</h2>
      <p>Search terms are used to return matching database records. The application does not set an advertising profile and does not include third-party advertising. Essential hosting or security cookies may be used by infrastructure providers.</p>
      <h2>Corrections and future changes</h2>
      <p>A public correction and removal channel will be documented before the site is promoted broadly. If accounts or new submissions are added later, this policy will be updated before those features launch.</p>
    </InfoPage>
  );
}
