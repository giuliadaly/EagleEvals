import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ownerAuth, ownerSession, ownerResponseHeaders } from "@/data/owner-auth";
import { readAnonymousJson } from "@/data/anonymous-request";
import { expireReviewData } from "@/data/public-cache";
import { OwnerManagementError, getOwnerOverview, getOwnerReports, getOwnerReviewLookup, getOwnerCatalogCandidates, changeOwnerReportStatus, correctOwnerReviewAssociation } from "@/data/owner-management";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: ownerResponseHeaders });
const text = (value: unknown) => typeof value === "string" ? value : "";
const integer = (value: string | null, fallback: number, max: number) => value && /^\d+$/.test(value) ? Math.min(max, Number(value)) : fallback;

async function identity(request: Request) {
  if (!ownerAuth()) return { response: json({ message: "Owner access is not available yet. Please finish setting up owner sign-in." }, 503) };
  const actor = await ownerSession(request.headers);
  return actor ? { actor } : { response: json({ message: "Sign in with the owner’s GitHub account to continue." }, 401) };
}

function failure(error: unknown) {
  if (error instanceof OwnerManagementError) return json({ message: error.message }, error.status);
  // Neither private reports, SQL, session details nor submitted evidence enter logs.
  return json({ message: "The owner workspace is temporarily unavailable. Please refresh before trying again." }, 503);
}

export async function GET(request: Request) {
  try {
    const auth = await identity(request);
    if (auth.response) return auth.response;
    const params = new URL(request.url).searchParams;
    const limit = integer(params.get("limit"), 20, 50);
    const offset = integer(params.get("offset"), 0, 10_000);
    switch (params.get("view") ?? "overview") {
      case "overview": return json(await getOwnerOverview());
      case "reports": {
        const status = params.get("status") ?? "open";
        if (!["open", "resolved", "dismissed", "all"].includes(status)) return json({ message: "Choose a valid report status." }, 400);
        return json(await getOwnerReports({ status: status as "open" | "resolved" | "dismissed" | "all", limit, offset }));
      }
      case "reviews": return json(await getOwnerReviewLookup({ reviewId: params.get("review") ?? undefined, query: params.get("q") ?? undefined, unmatchedOnly: params.get("unmatched") !== "false", limit, offset }));
      case "catalog": {
        const kind = params.get("kind");
        if (kind !== "course" && kind !== "professor") return json({ message: "Choose a course or professor search." }, 400);
        return json({ candidates: await getOwnerCatalogCandidates({ kind, query: params.get("q") ?? "", limit: 10 }) });
      }
      default: return json({ message: "That owner view is unavailable." }, 400);
    }
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await identity(request);
    if (auth.response) return auth.response;
    if (!request.headers.get("origin")) return json({ message: "Submit changes from the owner workspace." }, 403);
    const parsed = await readAnonymousJson(request, 16_000);
    if (!parsed.ok) return json({ message: parsed.message }, parsed.status);
    if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) return json({ message: "The change could not be read." }, 400);
    const body = parsed.body as Record<string, unknown>;
    if (body.action === "report-status") {
      if ((body.status !== "open" && body.status !== "resolved" && body.status !== "dismissed") || typeof body.expectedVersion !== "number") return json({ message: "Choose a valid report status and reload its current version." }, 400);
      const result = await changeOwnerReportStatus({ actionId: text(body.actionId), reportId: text(body.reportId), status: body.status, expectedVersion: body.expectedVersion, reason: text(body.reason) }, auth.actor!);
      return json({ ...result, message: "Report status updated. The review’s publication status has not changed." });
    }
    if (body.action === "correct-review") {
      if (body.courseId === null && body.leaveCourseUnmatched !== true) return json({ message: "Confirm that this review should remain unmatched to a course." }, 400);
      if (body.contextNoteMode !== undefined && body.contextNoteMode !== "preserve" && body.contextNoteMode !== "replace") return json({ message: "Choose whether to preserve or replace the context note." }, 400);
      const result = await correctOwnerReviewAssociation({ actionId: text(body.actionId), reviewId: text(body.reviewId), expectedFingerprint: text(body.expectedFingerprint), professorId: text(body.professorId), courseId: body.courseId === null ? null : text(body.courseId), reason: text(body.reason), evidenceUrl: text(body.evidenceUrl), contextNoteMode: body.contextNoteMode, contextNote: body.contextNote === null ? null : text(body.contextNote) }, auth.actor!);
      expireReviewData();
      revalidateTag("eagleevals-catalog", { expire: 0 });
      revalidatePath("/", "layout");
      return json({ ...result, message: "Association corrected. The original review text and source record are preserved." });
    }
    return json({ message: "Choose a report update or review correction." }, 400);
  } catch (error) { return failure(error); }
}
