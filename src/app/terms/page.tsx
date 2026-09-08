import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { alternates: { canonical: "/terms" }, title: "Terms", description: "Terms for using EagleEvals course and professor information." };

export default function TermsPage() {
  return (
    <InfoPage eyebrow="Policy" title="Terms of use" intro="These terms explain the limits of this independent course-planning resource for Boston College students.">
      <p><strong>Last updated: August 20, 2026.</strong></p>
      <h2>Informational use</h2>
      <p>EagleEvals is provided for general course-planning information. Ratings and comments describe historical experiences and may be incomplete, outdated, or unrepresentative of a current or future section. You remain responsible for confirming official course requirements, schedules, prerequisites, and faculty assignments.</p>
      <h2>Respectful use</h2>
      <p>Do not use the service to harass, threaten, impersonate, identify anonymous commenters, scrape personal contact information, interfere with the site, or attempt unauthorized access to its systems.</p>
      <h2>Submitting a review</h2>
      <p>Submit only your own honest course experience. Keep comments focused on teaching, course content, workload, assignments, and classroom experience. Do not include harassment, threats, discrimination, links, contact details, private personal information, student names, or claims unrelated to the course. By submitting, you confirm that EagleEvals may display and moderate the review as part of this student resource.</p>
      <h2>Independence</h2>
      <p>EagleEvals is independent and student-run. It is not an official Boston College service and is not endorsed by or affiliated with Boston College.</p>
      <h2>Availability</h2>
      <p>EagleEvals is provided as available. Records may be corrected, withheld, or removed when necessary, and the service may change as its information and features improve.</p>
    </InfoPage>
  );
}
