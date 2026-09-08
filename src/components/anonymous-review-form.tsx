"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { SemesterPicker } from "./semester-picker";
import type { ReviewSelection } from "@/data/types";

type QuickCourse = { id: string; code: string; title: string; subject: string };
type QuickProfessor = { id: string; name: string; title: string | null };
type QuickResults = { courses: QuickCourse[]; professors: QuickProfessor[] };

type SubmissionSuccess = {
  message: string;
  course: { id: string; code: string; title: string };
  professor: { id: string; name: string };
};

function CatalogPicker({
  kind,
  label,
  selected,
  onSelect,
}: {
  kind: "course" | "professor";
  label: string;
  selected: ReviewSelection | null;
  onSelect: (value: ReviewSelection | null) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(selected ? selected.primary : "");
  const [results, setResults] = useState<QuickResults>({ courses: [], professors: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        setResults((await response.json()) as QuickResults);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults({ courses: [], professors: [] });
        }
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  const choices = kind === "course" ? results.courses : results.professors;

  return (
    <div className="relative">
      <label className="form-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className={`form-control ${selected ? "has-selection" : ""}`}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          if (event.target.value.trim().length < 2) setOpen(false);
        }}
        onFocus={() => !selected && query.trim().length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-choices`}
        placeholder={kind === "course" ? "Search course code or title" : "Search professor name"}
        required
      />
      {selected ? (
        <button
          type="button"
          className="absolute bottom-3 right-3 text-xs font-bold text-[var(--blue)]"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
        >
          Change
        </button>
      ) : null}
      {open ? (
        <div id={`${inputId}-choices`} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-2 shadow-xl">
          {loading && choices.length === 0 ? <p className="p-3 text-sm text-[var(--muted)]">Searching…</p> : null}
          {!loading && choices.length === 0 ? <p className="p-3 text-sm text-[var(--muted)]">No matches found.</p> : null}
          {kind === "course" ? (choices as QuickCourse[]).map((course) => (
            <button
              key={course.id}
              type="button"
              role="option"
              aria-selected="false"
              className="result-row w-full text-left"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const value = { id: course.id, primary: course.code, secondary: course.title };
                onSelect(value);
                setQuery(value.primary);
                setOpen(false);
              }}
            >
              <span><strong className="block text-sm text-[var(--ink)]">{course.code} · {course.title}</strong><span className="text-xs text-[var(--muted)]">{course.subject}</span></span>
            </button>
          )) : (choices as QuickProfessor[]).map((professor) => (
            <button
              key={professor.id}
              type="button"
              role="option"
              aria-selected="false"
              className="result-row w-full text-left"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const value = { id: professor.id, primary: professor.name, secondary: professor.title ?? "Boston College faculty" };
                onSelect(value);
                setQuery(value.primary);
                setOpen(false);
              }}
            >
              <span><strong className="block text-sm text-[var(--ink)]">{professor.name}</strong>{professor.title ? <span className="text-xs text-[var(--muted)]">{professor.title}</span> : null}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
  const [success, setSuccess] = useState<SubmissionSuccess | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(null);
    if (!course || !professor) {
      setError("Choose a course and professor from the search results.");
      return;
    }
    const form = event.currentTarget;
    const fields = new FormData(form);
    const rating = (name: string) => fields.get(name);
    const takeAgain = fields.get("wouldTakeAgain");
    const confirmed = fields.get("reviewConfirmed") === "on";
    setPending(true);
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
      const payload = (await response.json()) as SubmissionSuccess & { message: string };
      if (!response.ok) throw new Error(payload.message || "The review could not be saved.");
      setSuccess(payload);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The review could not be saved.");
    } finally {
      setPending(false);
    }
  }

  if (success) return <section className="review-form space-y-6" aria-labelledby="review-success-heading">
    <p className="eyebrow">A little advice, passed on.</p>
    <h2 id="review-success-heading" ref={successHeading} tabIndex={-1} className="text-3xl font-bold text-[var(--maroon-deep)]">Your anonymous review is live.</h2>
    <p className="text-base leading-7 text-[var(--ink-soft)]">Thanks for helping the next student. Your ratings and written review are now included for {success.course.code} with {success.professor.name}.</p>
    <div className="flex flex-wrap gap-4"><Link className="button-primary" href={`/courses/${success.course.id}#comments`}>View your course’s reviews</Link><Link className="button-secondary" href={`/professors/${success.professor.id}#comments`}>View professor reviews</Link></div>
    <div className="pt-4"><h3 className="text-xl font-semibold">Have another class in mind?</h3><p className="mt-2 text-sm text-[var(--muted)]">An older class counts, too.</p><button className="button-secondary mt-4" type="button" onClick={() => { setSuccess(null); setCourse(null); setProfessor(null); setError(""); }}>Review another class</button></div>
  </section>;

  return (
    <form onSubmit={submit} className="review-form space-y-8">
      <div className="review-form-section">
        <h2 className="font-serif text-2xl font-bold text-[var(--navy)]">Which class did you take?</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <CatalogPicker kind="course" label="Course" selected={course} onSelect={setCourse} />
          <div>
            {course && suggestions?.courseId === course.id && suggestions.professors.length > 0 && !professor ? <label className="mb-4 block"><span className="form-label">Known professors for {course.primary}</span><select className="form-control" value="" onChange={event => setProfessor(suggestions.professors.find(item => item.id === event.target.value) ?? null)}><option value="">Choose one, or search below</option>{suggestions.professors.map(item => <option key={item.id} value={item.id}>{item.primary}</option>)}</select></label> : null}
            <CatalogPicker key={professor?.id ?? "professor-search"} kind="professor" label="Professor" selected={professor} onSelect={setProfessor} />
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
