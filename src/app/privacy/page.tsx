import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { alternates: { canonical: "/privacy" }, title: "Privacy", description: "EagleEvals privacy information." };

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Policy" title="Privacy" intro="EagleEvals makes course and professor evaluations publicly readable and accepts new reviews without user accounts or identity fields.">
      <p><strong>Last updated: September 8, 2026.</strong></p>
      <h2>Information on EagleEvals</h2>
      <p>The site displays course information, public faculty details, aggregated rating results, and anonymous written student reviews. Reviews recovered from the original EagleEval are not connected to names, accounts, or other user identifiers.</p>
      <h2>Information collected when you visit</h2>
      <p>EagleEvals does not ask for your name, email address, password, or student credentials. The hosting and database providers may process ordinary technical information needed to serve and protect the site, such as an IP address, browser type, request path, timestamp, and security logs.</p>
      <p>EagleEvals uses Vercel Web Analytics to understand aggregate site usage, including page views, daily visitors, popular pages, referral sources, general location, browser, operating system, and device type. Vercel Web Analytics does not use cookies, stores anonymized data, and excludes recognized automated traffic.</p>
      <p>We also measure search result availability, opening a search suggestion, sending a search, starting a review, successful submissions, broad error categories, and completion-time ranges. These events do not include search terms, review text, rating answers, selected course or professor IDs, review IDs, names, or email addresses. Query parameters and fragments are removed from analytics page URLs. Ordinary public course and professor page paths remain visible in page-view reports.</p>
      <p>Vercel Web Analytics uses a temporary visitor hash derived from request information, discarded after 24 hours. It is not attached to a submitted review. EagleEvals does not record browsing sessions or keystrokes. The application uses origin-only referrers to avoid forwarding page paths and query parameters when navigating away.</p>
      <p>Vercel Speed Insights measures loading and responsiveness from a sample of visits. Performance reports may include public page paths, browser and device information, general location, and performance measurements. Search and review-prefill parameters are removed from reported URLs.</p>
      <h2>Anonymous review submissions</h2>
      <p>New reviews store the selected course and professor, semester, section, ratings, written review, and whether the student would take the professor again. The application does not save a name, account, email address, student ID, IP address, user agent, cookie identifier, or browser fingerprint with a review. Hosting providers may still retain ordinary infrastructure and security logs under their own policies.</p>
      <h2>Searches and cookies</h2>
      <p>Search terms are used to return matching database records. The application does not set an advertising profile and does not include third-party advertising. Essential hosting or security cookies may be used by infrastructure providers.</p>
      <h2>Corrections and future changes</h2>
      <p>Records and submissions may be corrected, unpublished, or removed when necessary. This policy will be updated if EagleEvals later adds accounts or additional data collection.</p>
    </InfoPage>
  );
}
