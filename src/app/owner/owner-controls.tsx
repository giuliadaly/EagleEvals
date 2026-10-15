"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { OwnerCatalogCandidate, OwnerReport, OwnerReview } from "@/data/owner-management";
import styles from "./owner.module.css";

function useOwnerMutation() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const router = useRouter();
  async function save(body: Record<string, unknown>) {
    if (inFlight.current) return;
    const key = JSON.stringify(body);
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    inFlight.current = true; setPending(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/owner/manage", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, actionId: attempt.current.id }) }).catch(() => { throw new Error("Could not confirm the change. Your draft is still here. Refresh before trying again."); });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status >= 500 ? "Could not confirm the change. Your draft is still here. Refresh before trying again." : payload?.message ?? "The change could not be saved.");
      if (!payload?.actionId) throw new Error("Could not confirm the change. Refresh before trying again.");
      setMessage(payload.message ?? "Saved."); router.refresh();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "Could not confirm the change. Refresh before trying again.");
    } finally { inFlight.current = false; setPending(false); }
  }
  return { save, pending, message, failed };
}

export function OwnerReportControls({ report }: { report: OwnerReport }) {
  const mutation = useOwnerMutation();
  const [status, setStatus] = useState(report.status);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void mutation.save({ action: "report-status", reportId: report.id, status, expectedVersion: report.version, reason: fields.get("reason") });
  }
  return <form onSubmit={submit} className={styles.form}>
    <label><span className="form-label">Report status</span><select className="form-control" value={status} onChange={event => setStatus(event.target.value as OwnerReport["status"])}><option value="open">Open / reopen</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label>
    <label><span className="form-label">Why are you changing it?</span><textarea className="form-control" name="reason" minLength={10} maxLength={2000} required placeholder="Record what you checked or how this was handled." /></label>
    <p className={styles.muted}>This updates the private report. It does not hide or delete a review.</p>
    {mutation.message ? <p role={mutation.failed ? "alert" : "status"} className={mutation.failed ? styles.error : styles.success}>{mutation.message}</p> : null}
    <button className="button-secondary" type="submit" disabled={mutation.pending || status === report.status}>{mutation.pending ? "Saving…" : "Update report"}</button>
  </form>;
}

function CatalogChoice({ kind, selected, onSelect }: { kind: "professor" | "course"; selected: OwnerCatalogCandidate | null; onSelect: (candidate: OwnerCatalogCandidate | null) => void }) {
  const id = useId();
  const [query, setQuery] = useState(selected?.label ?? "");
  const [choices, setChoices] = useState<OwnerCatalogCandidate[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestNumber = useRef(0);
  async function find() {
    const number = ++requestNumber.current;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/owner/manage?view=catalog&kind=${kind}&q=${encodeURIComponent(query)}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.candidates)) throw new Error("Catalog search is unavailable. Try again.");
      if (requestNumber.current === number) setChoices(payload.candidates);
    } catch { if (requestNumber.current === number) setError("Catalog search is unavailable. Try again."); }
    finally { if (requestNumber.current === number) setPending(false); }
  }
  return <div><label htmlFor={id} className="form-label">{kind === "course" ? "Course" : "Professor"}</label><div className="flex gap-2"><input id={id} className="form-control min-w-0" value={query} maxLength={160} onChange={event => { setQuery(event.target.value); setChoices([]); setError(""); requestNumber.current++; setPending(false); onSelect(null); }} placeholder={kind === "course" ? "Course code or title" : "Professor name"} /><button className="button-secondary shrink-0 whitespace-nowrap" type="button" onClick={find} disabled={pending || !query.trim()}>{pending ? "Finding…" : "Find"}</button></div>
    {selected ? <p className={styles.muted}>Selected: {selected.label}</p> : <p className={styles.muted}>{kind === "course" ? "Choose a course, or explicitly confirm below that it should be unmatched." : "Choose a catalog professor before saving."}</p>}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {choices.length ? <div className={styles.choices}>{choices.map(choice => <button className={styles.choice} type="button" key={choice.id} onClick={() => { onSelect(choice); setQuery(choice.label); setChoices([]); }}><strong className="block">{choice.label}</strong><span className={styles.muted}>{choice.detail}</span></button>)}</div> : null}
  </div>;
}

export function OwnerAssociationControls({ review }: { review: OwnerReview }) {
  const mutation = useOwnerMutation();
  const [professor, setProfessor] = useState<OwnerCatalogCandidate | null>(review.professorId ? { id: review.professorId, label: review.professorName, detail: "Current association", catalogSource: "" } : null);
  const [course, setCourse] = useState<OwnerCatalogCandidate | null>(review.courseId ? { id: review.courseId, label: [review.courseCode, review.courseTitle].filter(Boolean).join(" · "), detail: "Current association", catalogSource: "" } : null);
  const [leaveCourseUnmatched, setLeaveCourseUnmatched] = useState(false);
  const [replaceNote, setReplaceNote] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!professor || (!course && !leaveCourseUnmatched)) return;
    const fields = new FormData(event.currentTarget);
    void mutation.save({ action: "correct-review", reviewId: review.id, expectedFingerprint: review.fingerprint, professorId: professor.id, courseId: course?.id ?? null,
      leaveCourseUnmatched, reason: fields.get("reason"), evidenceUrl: fields.get("evidenceUrl"), contextNoteMode: replaceNote ? "replace" : "preserve", contextNote: replaceNote ? fields.get("contextNote") : null });
  }
  return <details><summary className="mt-4 cursor-pointer font-semibold text-[var(--maroon)]">Review or correct this association</summary><form className={styles.form} onSubmit={submit}>
    <div className={styles.columns}><CatalogChoice kind="professor" selected={professor} onSelect={setProfessor} /><CatalogChoice kind="course" selected={course} onSelect={candidate => { setCourse(candidate); setLeaveCourseUnmatched(false); }} /></div>
    <label className="flex gap-3 items-start"><input type="checkbox" checked={leaveCourseUnmatched} onChange={event => { setLeaveCourseUnmatched(event.target.checked); if (event.target.checked) setCourse(null); }} /><span>Leave this review unmatched to a course. I checked the evidence and cannot confirm a course.</span></label>
    <label><span className="form-label">Reason for this correction</span><textarea className="form-control" name="reason" minLength={10} maxLength={2000} required placeholder="Explain how the evidence identifies this professor and course." /></label>
    <label><span className="form-label">Public evidence link</span><input className="form-control" name="evidenceUrl" type="url" maxLength={2048} required placeholder="https://…" defaultValue={review.sourceUrl ?? ""} /></label>
    <label className="flex gap-3 items-start"><input type="checkbox" checked={replaceNote} onChange={event => setReplaceNote(event.target.checked)} /><span>Replace the public context note with a reviewed correction</span></label>
    {replaceNote ? <label><span className="form-label">Replacement note · leave blank to clear</span><textarea className="form-control" name="contextNote" maxLength={2000} defaultValue={review.contextNote ?? ""} /></label> : review.contextNote ? <p className={styles.muted}>Preserving current note: {review.contextNote}</p> : null}
    <p className={styles.muted}>Check the original source before saving. {review.pairedRatingId ? "This changes where the written review and its linked numerical evaluation appear. " : "This changes where this written review appears; historical unpaired numerical evaluations keep their associations. "}The review’s text, rating values, and raw source data stay intact. Every correction is recorded.</p>
    {mutation.message ? <p role={mutation.failed ? "alert" : "status"} className={mutation.failed ? styles.error : styles.success}>{mutation.message}</p> : null}
    <button className="button-primary" type="submit" disabled={mutation.pending || !professor || (!course && !leaveCourseUnmatched)}>{mutation.pending ? "Saving…" : "Save reviewed correction"}</button>
  </form></details>;
}
