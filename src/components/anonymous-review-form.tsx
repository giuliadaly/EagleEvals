"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
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
        className={`form-control ${selected ? "pr-20" : ""}`}
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

function RatingField({ name, label, hint }: { name: string; label: string; hint?: string }) {
  return (
    <label className="rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-4">
      <span className="block text-sm font-bold text-[var(--navy)]">{label}</span>
      {hint ? <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{hint}</span> : null}
      <select name={name} className="form-control mt-3" defaultValue="" required>
        <option value="" disabled>Select 1–5</option>
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
  semesterOptions,
}: {
  initialCourse: ReviewSelection | null;
  initialProfessor: ReviewSelection | null;
  semesterOptions: string[];
}) {
  const [course, setCourse] = useState(initialCourse);
  const [professor, setProfessor] = useState(initialProfessor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SubmissionSuccess | null>(null);

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
    const rating = (name: string) => Number(fields.get(name));
    setPending(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          professorId: professor.id,
          semester: fields.get("semester"),
          section: Number(fields.get("section")),
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
          wouldTakeAgain: fields.get("wouldTakeAgain") === "true",
          firsthandConfirmed: fields.get("firsthandConfirmed") === "on",
          guidelinesAccepted: fields.get("guidelinesAccepted") === "on",
          website: fields.get("website"),
        }),
      });
      const payload = (await response.json()) as SubmissionSuccess & { message: string };
      if (!response.ok) throw new Error(payload.message || "The review could not be saved.");
      setSuccess(payload);
      form.reset();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The review could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-10">
      <div className="rounded-[.75rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-7">
        <h2 className="font-serif text-2xl font-bold text-[var(--navy)]">1. Choose the class</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <CatalogPicker kind="course" label="Course" selected={course} onSelect={setCourse} />
          <CatalogPicker kind="professor" label="Professor" selected={professor} onSelect={setProfessor} />
          <label><span className="form-label">Semester</span><select name="semester" className="form-control" required>{semesterOptions.map((semester) => <option key={semester} value={semester}>{semester}</option>)}</select></label>
          <label><span className="form-label">Section number</span><input name="section" className="form-control" type="number" min="1" max="99" defaultValue="1" required /></label>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl font-bold text-[var(--navy)]">2. Rate the experience</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Use the same five-point scale used throughout EagleEvals.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RatingField name="courseOverall" label="Course overall" />
          <RatingField name="instructorOverall" label="Instructor overall" />
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
      </div>

      <div className="rounded-[.75rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-7">
        <h2 className="font-serif text-2xl font-bold text-[var(--navy)]">3. Share useful context</h2>
        <label className="mt-6 block"><span className="form-label">Anonymous written review</span><textarea name="message" className="form-control min-h-40 resize-y leading-6" minLength={20} maxLength={1000} placeholder="What should another student know about the course, workload, teaching, or assignments?" required /></label>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">20–1,000 characters. Do not include names of students, contact information, links, or private personal details.</p>
        <fieldset className="mt-6">
          <legend className="form-label">Would you take this professor again?</legend>
          <div className="flex gap-6 text-sm"><label className="flex items-center gap-2"><input type="radio" name="wouldTakeAgain" value="true" required /> Yes</label><label className="flex items-center gap-2"><input type="radio" name="wouldTakeAgain" value="false" required /> No</label></div>
        </fieldset>
        <div className="mt-6 space-y-3 text-sm leading-6 text-[var(--ink-soft)]">
          <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" name="firsthandConfirmed" required /><span>This review reflects my own course experience.</span></label>
          <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" name="guidelinesAccepted" required /><span>I kept it truthful and constructive and did not include harassment, private information, or claims unrelated to the course.</span></label>
        </div>
        <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      </div>

      <div aria-live="polite">
        {error ? <p className="rounded-[.375rem] border border-[var(--rose)]/25 bg-[var(--rose-pale)] p-4 text-sm font-semibold text-[var(--rose)]">{error}</p> : null}
        {success ? <div className="rounded-[.375rem] border border-[var(--green)]/25 bg-[var(--green-pale)] p-5 text-sm text-[var(--green)]"><p className="font-bold">{success.message}</p><p className="mt-2">It is now included in the public ratings and anonymous comments.</p><div className="mt-3 flex flex-wrap gap-4 font-bold"><Link href={`/courses/${success.course.id}`}>View {success.course.code}</Link><Link href={`/professors/${success.professor.id}`}>View {success.professor.name}</Link></div></div> : null}
      </div>

      <div className="flex flex-col gap-4 rounded-[.75rem] bg-[var(--maroon-deep)] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-white/68">No account, name, email, student ID, IP address, or browser identifier is saved with your review. Infrastructure providers may still process routine security logs as described in the privacy policy.</p>
        <button className="button-gold shrink-0 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish anonymous review"}</button>
      </div>
    </form>
  );
}
