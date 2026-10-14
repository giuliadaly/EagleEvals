export const reportReasons = ["incorrect-information", "wrong-association", "private-information", "harassment", "spam", "other"] as const;
export type ReportReason = (typeof reportReasons)[number];
export type ReportTarget = "review" | "course" | "professor" | "site";
export type AnonymousReport = { targetKind: ReportTarget; targetId: string | null; reason: ReportReason; message: string };

const objectId = /^[0-9a-f]{24}$/;
const reviewId = /^[A-Za-z0-9:_+=/-]{1,180}$/;
const contactOrLink = /(?:https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/i;

export function validateAnonymousReport(value: unknown):
  { ok: true; data: AnonymousReport } | { ok: false; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "The report could not be read." };
  const input = value as Record<string, unknown>;
  if (String(input.website ?? "").trim()) return { ok: false, message: "The report could not be submitted." };
  if (!["review", "course", "professor", "site"].includes(String(input.targetKind))) return { ok: false, message: "Choose what the report is about." };
  const targetKind = input.targetKind as ReportTarget;
  const targetId = targetKind === "site" ? null : typeof input.targetId === "string" ? input.targetId.trim() : "";
  if (targetKind !== "site" && !(targetKind === "review" ? reviewId : objectId).test(targetId ?? "")) {
    return { ok: false, message: "Open the report link on the relevant review, course, or professor page." };
  }
  if (!reportReasons.includes(input.reason as ReportReason)) return { ok: false, message: "Choose a reason for the report." };
  const message = typeof input.message === "string" ? input.message.replace(/\r\n/g, "\n").trim() : "";
  if (message.length < 20 || message.length > 2000) return { ok: false, message: "Explain the issue in 20 to 2,000 characters." };
  if (contactOrLink.test(message)) return { ok: false, message: "Remove links, email addresses, and phone numbers. You do not need to identify yourself." };
  if (input.privacyConfirmed !== true) return { ok: false, message: "Confirm that you have left out identifying details." };
  // Explicitly copy only allowed content fields. Never persist extra identity/metadata fields.
  return { ok: true, data: { targetKind, targetId, reason: input.reason as ReportReason, message } };
}

export function reportHref(kind: Exclude<ReportTarget, "site">, id: string): string {
  return `/contact?${new URLSearchParams({ [kind]: id })}`;
}
