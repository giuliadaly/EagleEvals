import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Privacy", description: "EagleEvals privacy information." };

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Policy" title="Privacy" intro="EagleEvals makes course and professor evaluations publicly readable and accepts new reviews without user accounts or identity fields.">
      <p><strong>Last updated: August 20, 2026.</strong></p>
      <h2>Information on EagleEvals</h2>
      <p>The site displays course information, public faculty details, aggregated evaluation results, and anonymous student comments. Historical comments are not connected to names, accounts, or other user identifiers.</p>
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
