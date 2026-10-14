import "server-only";
import { readDatabase } from "@/data/database";
import type { ReportTarget } from "@/data/report-validation";

export type ReportReference = { kind: Exclude<ReportTarget, "site">; id: string; label: string; href: string; excerpt?: string };

export async function getReportReference(params: { review?: string; course?: string; professor?: string }): Promise<ReportReference | null> {
  if (!params.review && !params.course && !params.professor) return null;
  const sql = readDatabase("comments");
  if (params.review && /^[A-Za-z0-9:_+=/-]{1,180}$/.test(params.review)) {
    const rows = await sql`SELECT id, professor_name, course_code, message, course_id, professor_id
      FROM public_written_reviews WHERE id = ${params.review} LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    const href = row.course_id ? `/courses/${row.course_id}` : row.professor_id ? `/professors/${row.professor_id}` : "/comments";
    return { kind: "review", id: String(row.id), label: [row.professor_name, row.course_code].filter(Boolean).join(" · "), href, excerpt: String(row.message).slice(0, 260) };
  }
  if (params.course && /^[0-9a-f]{24}$/.test(params.course)) {
    const rows = await sql`SELECT id, code, title FROM courses WHERE id = ${params.course} LIMIT 1`;
    const row = rows[0];
    return row ? { kind: "course", id: String(row.id), label: `${row.code} · ${row.title}`, href: `/courses/${row.id}` } : null;
  }
  if (params.professor && /^[0-9a-f]{24}$/.test(params.professor)) {
    const rows = await sql`SELECT id, name FROM professors WHERE id = ${params.professor} LIMIT 1`;
    const row = rows[0];
    return row ? { kind: "professor", id: String(row.id), label: String(row.name), href: `/professors/${row.id}` } : null;
  }
  return null;
}
