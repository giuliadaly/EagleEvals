"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import type { ReportReference } from "@/data/report-target";
import type { ReportReason } from "@/data/report-validation";

export function AnonymousReportForm({ reference }: { reference: ReportReference | null }) {
  const [reason, setReason] = useState<ReportReason>(reference?.kind === "review" ? "other" : "incorrect-information");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const pendingRef = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let failure = "Your report could not be saved. Your text is still here; please try again.";
    try {
      const response = await fetch("/api/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKind: reference?.kind ?? "site", targetId: reference?.id ?? null,
          reason, message, privacyConfirmed: confirmed, website: form.get("website") }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "";
        if (response.status === 429) failure = "The report queue is receiving many submissions. Please wait a minute and try again.";
        if (response.status < 500 && detail) failure = detail;
        throw new Error("Report was not confirmed");
      }
      if (!body || typeof body !== "object" || !("saved" in body) || body.saved !== true) throw new Error("Report was not confirmed");
      setComplete(true);
    } catch {
      setError(failure);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (complete) return <div role="status" className="max-w-2xl rounded border border-[var(--line)] bg-[var(--wash)] p-6">
    <h2 className="text-xl font-bold">Thanks for letting us know.</h2>
    <p className="mt-3 leading-7 text-[var(--ink-soft)]">Your report is saved in the private review queue. Reports are reviewed by the site owner and do not automatically remove content. We do not collect contact details, so we cannot send a personal reply.</p>
    <Link className="mt-5 inline-block font-bold text-[var(--maroon)] underline underline-offset-4" href={reference?.href ?? "/"}>Back to {reference ? "the page" : "EagleEvals"}</Link>
  </div>;

  return <form onSubmit={submit} className="max-w-2xl space-y-6">
    {reference ? <div className="rounded border border-[var(--line)] bg-[var(--wash)] p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">About this {reference.kind}</p>
      <Link className="mt-2 inline-block font-bold text-[var(--maroon)] underline underline-offset-4" href={reference.href}>{reference.label}</Link>
      {reference.excerpt ? <blockquote className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">“{reference.excerpt}{reference.excerpt.length === 260 ? "…" : ""}”</blockquote> : null}
    </div> : <p className="leading-7 text-[var(--ink-soft)]">For a specific review, use its “Report review” link. Course and professor pages also have correction links. You can use this form for a general site issue or suggestion.</p>}
    <div>
      <label className="form-label" htmlFor="report-reason">What needs attention?</label>
      <select id="report-reason" className="form-control" value={reason} onChange={event => setReason(event.target.value as ReportReason)}>
        <option value="incorrect-information">Incorrect information</option><option value="wrong-association">Wrong course or professor</option>
        <option value="private-information">Personal or private information</option><option value="harassment">Harassment or threats</option>
        <option value="spam">Spam or duplicate content</option><option value="other">Something else</option>
      </select>
    </div>
    <div>
      <label className="form-label" htmlFor="report-message">Tell us what should change</label>
      <textarea id="report-message" className="form-control" value={message} onChange={event => setMessage(event.target.value)} minLength={20} maxLength={2000} required aria-describedby="report-guidelines" />
      <p id="report-guidelines" className="mt-2 text-xs leading-6 text-[var(--muted)]">20–2,000 characters. Please leave out your name, email, student ID, phone number, links, and any details that identify a student.</p>
    </div>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--maroon)]" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />I have left out identifying details.</label>
    <div className="sr-only" aria-hidden="true"><label htmlFor="report-website">Website</label><input id="report-website" name="website" tabIndex={-1} autoComplete="off" /></div>
    {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="rounded bg-[var(--rose-pale)] p-4 text-sm leading-6 text-[var(--rose)]">{error}</p> : null}
    <button className="button-primary" type="submit" disabled={pending}>{pending ? "Saving report…" : "Send anonymously"}</button>
    <p className="text-xs leading-6 text-[var(--muted)]">Reports are private and reviewed manually. No account or contact information is required.</p>
  </form>;
}
