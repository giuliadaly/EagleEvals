import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readAnonymousJson } from "@/data/anonymous-request";
import { database } from "@/data/database";
import { validateAnonymousReport } from "@/data/report-validation";

export async function POST(request: Request) {
  const parsed = await readAnonymousJson(request, 12_000);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: parsed.status });
  const result = validateAnonymousReport(parsed.body);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  const report = result.data;
  try {
    const sql = database();
    const rows = await sql`SELECT submit_anonymous_report(${randomBytes(12).toString("hex")}, ${report.targetKind},
      ${report.targetId}, ${report.reason}, ${report.message}) AS outcome`;
    return NextResponse.json({ saved: true, message: "Thanks. Your report is in the private review queue. Reports do not automatically remove a review." },
      { status: rows[0]?.outcome === "duplicate" ? 200 : 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "P0404") return NextResponse.json({ message: "That review or page is no longer available." }, { status: 404 });
    if (code === "P0429") return NextResponse.json({ message: "The report queue is receiving many submissions. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
    console.error("Anonymous report submission failed", { code: /^[A-Z0-9]{5}$/.test(code) ? code : "unknown" });
    return NextResponse.json({ message: "Your report could not be saved. Please try again." }, { status: 503 });
  }
}
