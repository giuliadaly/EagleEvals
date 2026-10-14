"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { SemesterPicker } from "./semester-picker";
import type { ReviewSelection } from "@/data/types";
import { refreshSearchEvidence } from "./use-catalog-search";
import { CatalogPicker } from "./catalog-picker";
import { readReviewSubmissionResponse, uncertainSubmissionMessage, type SubmissionSuccess } from "@/data/review-submission-response";
import { trackProductEvent } from "./site-telemetry";
import { reviewDuration, type ProductEvent } from "@/data/telemetry";

function RatingField({ name, label, hint, required = false }: { name: string; label: string; hint?: string; required?: boolean }) {
  return (
    <label className="review-rating-field">
      <span className="block text-sm font-bold text-[var(--navy)]">{label}</span>
      {hint ? <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{hint}</span> : null}
      <select name={name} className="form-control mt-3" defaultValue="" required={required}>
        <option value="" disabled={required}>{required ? "Select 1–5" : "Skip / don’t remember"}</option>
        <option value="1">1 · Very low</option>
        <option value="2">2 · Low</option>
        <option value="3">3 · Moderate</option>
        <option value="4">4 · High</option>
        <option value="5">5 · Very high</option>
      </select>
    </label>
  );
}

export function AnonymousReviewForm({
  initialCourse,
  initialProfessor,
  currentYear,
}: {
  initialCourse: ReviewSelection | null;
  initialProfessor: ReviewSelection | null;
  currentYear: number;
}) {
  const [course, setCourse] = useState(initialCourse);
  const [professor, setProfessor] = useState(initialProfessor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [success, setSuccess] = useState<SubmissionSuccess | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const startedAt = useRef<number | null>(null);
  const validationReported = useRef(false);
  const [suggestions, setSuggestions] = useState<{ courseId: string; professors: ReviewSelection[] } | null>(null);

  useEffect(() => { if (success) successHeading.current?.focus(); }, [success]);
  useEffect(() => {
    if (!course) return;
    const controller = new AbortController();
    fetch(`/api/courses/${course.id}/professors`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Suggestions unavailable"); return response.json(); })
      .then(payload => { if (!controller.signal.aborted) setSuggestions({ courseId: course.id, professors: payload.professors }); })
      .catch(() => { /* The unrestricted professor search remains available. */ });
    return () => controller.abort();
  }, [course]);

  function startReview() {
    if (startedAt.current !== null) return;
    startedAt.current = performance.now();
    trackProductEvent({ name: "review_started" });
  }

  function reportValidation() {
    startReview();
    if (validationReported.current) return;
    validationReported.current = true;
    trackProductEvent({ name: "review_error", reason: "validation" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startReview();
    setError("");
    setSuccess(null);
    if (!course || !professor) {
      setError("Choose a course and professor from the search results.");
      trackProductEvent({ name: "review_error", reason: "selection" });
      return;
    }
    const form = event.currentTarget;
    const fields = new FormData(form);
    const rating = (name: string) => fields.get(name);
    const takeAgain = fields.get("wouldTakeAgain");
    const confirmed = fields.get("reviewConfirmed") === "on";
    setPending(true);
    let failureReason: Extract<ProductEvent, { name: "review_error" }>["reason"] = "network";
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          professorId: professor.id,
          semester: fields.get("semester") === "older" ? `${fields.get("semesterTerm")} ${fields.get("semesterYear")}` : fields.get("semester"),
          section: fields.get("section"),
          courseOverall: rating("courseOverall"),
          instructorOverall: rating("instructorOverall"),
          attendanceNecessary: rating("attendanceNecessary"),
          availableForHelp: rating("availableForHelp"),
          courseChallenge: rating("courseChallenge"),
          courseOrganization: rating("courseOrganization"),
          clearExplanations: rating("clearExplanations"),
          instructorPrepared: rating("instructorPrepared"),
          stimulatedInterest: rating("stimulatedInterest"),
          assignmentsHelpful: rating("assignmentsHelpful"),
          weeklyEffort: rating("weeklyEffort"),
          message: fields.get("message"),
          wouldTakeAgain: takeAgain === "true" ? true : takeAgain === "false" ? false : null,
          firsthandConfirmed: confirmed,
          guidelinesAccepted: confirmed,
          website: fields.get("website"),
        }),
      });
      failureReason = response.status === 409 ? "duplicate" : response.status === 400 || response.status === 413 ? "validation" : response.status === 404 ? "selection" : "server";
      const payload = await readReviewSubmissionResponse(response);
      refreshSearchEvidence();
      router.refresh();
      setSuccess(payload);
      trackProductEvent({ name: "review_submitted", duration: reviewDuration(performance.now() - (startedAt.current ?? performance.now())) });
    } catch (submissionError) {
      trackProductEvent({ name: "review_error", reason: failureReason });
      setError(failureReason === "network" ? uncertainSubmissionMessage : submissionError instanceof Error ? submissionError.message : "Publishing is temporarily unavailable. Your review is still here. Please try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  if (success) return <section className="review-form space-y-6" aria-labelledby="review-success-heading">
    <p className="eyebrow">A little advice, passed on.</p>
    <h2 id="review-success-heading" ref={successHeading} tabIndex={-1} className="text-3xl font-bold text-[var(--maroon-deep)]">Your anonymous review is live.</h2>
    <p className="text-base leading-7 text-[var(--ink-soft)]">Thanks for helping the next student. Your ratings and written review are now included for {success.course.code} with {success.professor.name}.</p>
    <div className="flex flex-wrap gap-4"><a className="button-primary" href={`/courses/${success.course.id}#comments`}>View your course’s reviews</a><a className="button-secondary" href={`/professors/${success.professor.id}#comments`}>View professor reviews</a></div>
    <div className="pt-4"><h3 className="text-xl font-semibold">Have another class in mind?</h3><p className="mt-2 text-sm text-[var(--muted)]">An older class counts, too.</p><button className="button-secondary mt-4" type="button" onClick={() => { setSuccess(null); setCourse(null); setProfessor(null); setError(""); startedAt.current = null; validationReported.current = false; }}>Review another class</button></div>
  </section>;

  return (
    <form onSubmit={submit} onChangeCapture={() => { startReview(); validationReported.current = false; }} onInvalidCapture={reportValidation} className="review-form space-y-8">
      <div className="review-form-section">
        <h2 className="font-serif text-2xl font-bold text-[var(--navy)]">Which class did you take?</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <CatalogPicker kind="course" label="Course" selected={course} onSelect={setCourse} />
          <div>
            {course && suggestions?.courseId === course.id && suggestions.professors.length > 0 && !professor ? <label className="mb-4 block"><span className="form-label">Known professors for {course.primary}</span><select className="form-control" value="" onChange={event => setProfessor(suggestions.professors.find(item => item.id === event.target.value) ?? null)}><option value="">Choose one, or search below</option>{suggestions.professors.map(item => <option key={item.id} value={item.id}>{item.primary}</option>)}</select></label> : null}
            <CatalogPicker kind="professor" label="Professor" selected={professor} onSelect={setProfessor} />
            {course && !professor ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Someone else taught you? Search for any professor.</p> : null}
          </div>
          <SemesterPicker currentYear={currentYear} />
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl font-bold text-[var(--navy)]">How was it?</h2>
        <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <RatingField name="courseOverall" label="Course overall" required />
          <RatingField name="instructorOverall" label="Professor overall" required />
        </div>
      </div>

      <div className="review-form-section">
        <label className="block"><span className="form-label">What would you tell a friend?</span><textarea name="message" className="form-control min-h-32 resize-y leading-6" minLength={20} maxLength={1000} placeholder="A few words about the teaching, workload, or what helped you in this class." required aria-describedby="review-message-hint" /></label>
        <p id="review-message-hint" className="mt-2 text-xs leading-5 text-[var(--muted)]">20–1,000 characters. Keep it about the class; leave out private information and links.</p>
      </div>

      <details className="review-extra">
        <summary>Add a few details <span>Optional</span></summary>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Answer anything you remember. It’s fine to leave the rest blank.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label><span className="form-label">Section number</span><input name="section" className="form-control" type="number" min="1" max="99" placeholder="If you remember" /></label>
          <label><span className="form-label">Would you take this professor again?</span><select name="wouldTakeAgain" className="form-control" defaultValue=""><option value="">Skip / not sure</option><option value="true">Yes</option><option value="false">No</option></select></label>
        </div>
        <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <RatingField name="courseOrganization" label="Course organization" />
          <RatingField name="courseChallenge" label="Intellectual challenge" />
          <RatingField name="attendanceNecessary" label="Attendance necessary" />
          <RatingField name="assignmentsHelpful" label="Assignments helpful" />
          <RatingField name="instructorPrepared" label="Instructor prepared" />
          <RatingField name="clearExplanations" label="Clear explanations" />
          <RatingField name="availableForHelp" label="Available for help" />
          <RatingField name="stimulatedInterest" label="Stimulated interest" />
          <RatingField name="weeklyEffort" label="Weekly effort" hint="1 is very light; 5 is very heavy." />
        </div>
      </details>

      <label className="flex items-start gap-3 text-sm leading-6 text-[var(--ink-soft)]"><input className="mt-1 shrink-0" type="checkbox" name="reviewConfirmed" required /><span>This is my own class experience. I’ve kept it truthful, constructive, and free of harassment or private information.</span></label>
      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <div aria-live="polite">
        {error ? <p className="rounded-[.375rem] border border-[var(--rose)]/25 bg-[var(--rose-pale)] p-4 text-sm font-semibold text-[var(--rose)]">{error}</p> : null}

      </div>

      <div className="flex flex-col items-start gap-4">
        <button className="button-primary disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish anonymous review"}</button>
        <p className="text-xs leading-5 text-[var(--muted)]">No account or identifying details are saved with your review. Hosting providers may process routine security logs. <Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link></p>
      </div>
    </form>
  );
}
