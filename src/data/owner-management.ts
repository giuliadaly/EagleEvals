import 'server-only';

import { headers } from 'next/headers';
import { database } from '@/data/database';
import { ownerSession } from '@/data/owner-auth';

export type OwnerActor = { githubId: string; name?: string };
export type OwnerReportStatus = 'open' | 'resolved' | 'dismissed';
export type OwnerReport = {
  id: string; targetKind: 'review' | 'course' | 'professor' | 'site'; targetId: string | null;
  reason: string; message: string; status: OwnerReportStatus; createdAt: string;
  resolvedAt: string | null; version: number; updatedAt: string;
};
export type OwnerReview = {
  id: string; message: string; source: string; professorId: string | null; professorName: string;
  courseId: string | null; courseCode: string | null; courseTitle: string | null; contextNote: string | null;
  createdAt: string; reviewSemester: string | null; sourceUrl: string | null; sourceProfessorId: string | null;
  fingerprint: string; overrideVersion: number; pairedRatingId: string | null;
};
export type OwnerCatalogCandidate = { id: string; label: string; detail: string; catalogSource: string };
export type OwnerAction = {
  actionId: string; kind: 'report-status' | 'review-association'; targetId: string;
  actorGithubId: string; reason: string; evidenceUrl: string | null; createdAt: string;
};
export type OwnerGrowthBaseline = {
  id: string; measuredAt: string;
  traffic: {
    period: { start: string; end: string };
    current: { visitors: number; pageViews: number };
    previous: { start: string; end: string; visitors: number; pageViews: number };
    last28Days: { start: string; end: string; visitors: number; pageViews: number };
    notes: string[];
    [key: string]: unknown;
  };
  speedInsights: {
    available: boolean; period: { start: string; end: string }; aggregation: string; sampleRate: number;
    metrics: Record<string, { p75: number | null; dataPoints: number; unit: string }>;
    notes: string[]; [key: string]: unknown;
  };
  searchConsole: { available: boolean; reason: string; [key: string]: unknown };
  sources: string[];
  [key: string]: unknown;
};
export type OwnerOverview = {
  reportCounts: Record<OwnerReportStatus, number>; unmatchedReviews: number;
  recentActions: OwnerAction[]; growthBaselines: OwnerGrowthBaseline[];
  reviewHealth: {
    asOf: string; nativeLast7Days: number; nativeLast28Days: number; lastNativeSubmissionAt: string | null;
    writtenReviews: number; courseLinkedWrittenReviews: number; professorLinkedWrittenReviews: number; oldestOpenReportAt: string | null;
  };
};
export type OwnerReportStatusInput = {
  actionId: string; reportId: string; status: OwnerReportStatus; expectedVersion: number; reason: string;
};
export type OwnerAssociationInput = {
  actionId: string; reviewId: string; expectedFingerprint: string; professorId: string; courseId: string | null;
  reason: string; evidenceUrl: string; contextNoteMode?: 'preserve' | 'replace'; contextNote?: string | null;
};
export type OwnerMutationResult = { actionId: string; replayed: boolean; report?: OwnerReport; review?: OwnerReview };

export class OwnerManagementError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'OwnerManagementError'; }
}

async function requireOwnerActor(expected?: OwnerActor): Promise<OwnerActor> {
  const actor = await ownerSession(new Headers(await headers()));
  if (!actor || !/^[0-9]+$/.test(actor.githubId) || (expected && expected.githubId !== actor.githubId)) {
    throw new OwnerManagementError(401, 'Sign in with the owner account to continue.');
  }
  return actor;
}
function boundedText(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new OwnerManagementError(400, `${name} must contain ${min}–${max} characters.`);
  }
  return value.trim();
}
function referenceId(value: unknown, name: string): string {
  const id = boundedText(value, name, 1, 200);
  if (!/^[A-Za-z0-9_+=:/-]+$/.test(id)) throw new OwnerManagementError(400, `${name} is invalid.`);
  return id;
}
function catalogId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/.test(value)) throw new OwnerManagementError(400, `${name} is invalid.`);
  return value;
}
function actionId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new OwnerManagementError(400, 'The action ID is invalid. Reload and try again.');
  }
  return value.toLowerCase();
}
function pageOptions(limit = 50, offset = 0) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    throw new OwnerManagementError(400, 'The page selection is invalid.');
  }
  return { limit, offset };
}
function queryText(value: unknown = ''): string {
  if (typeof value !== 'string' || value.length > 160) throw new OwnerManagementError(400, 'Search must be at most 160 characters.');
  return value.trim();
}
function evidenceUrl(value: unknown): string {
  const text = boundedText(value, 'Evidence URL', 8, 2048);
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || /\s/.test(text)) throw Error();
    return url.href;
  } catch { throw new OwnerManagementError(400, 'Evidence must be a public HTTP or HTTPS URL without login credentials.'); }
}
export function validateOwnerReportStatus(input: OwnerReportStatusInput): OwnerReportStatusInput {
  if (!input || !['open', 'resolved', 'dismissed'].includes(input.status) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new OwnerManagementError(400, 'The report status or version is invalid.');
  }
  return { actionId: actionId(input.actionId), reportId: catalogId(input.reportId, 'Report ID'), status: input.status,
    expectedVersion: input.expectedVersion, reason: boundedText(input.reason, 'Reason', 10, 2000) };
}
export function validateOwnerAssociation(input: OwnerAssociationInput): Required<OwnerAssociationInput> {
  if (!input || typeof input.expectedFingerprint !== 'string' || !/^[0-9a-f]{32}$/.test(input.expectedFingerprint)) {
    throw new OwnerManagementError(400, 'Reload the review before saving a correction.');
  }
  const mode = input.contextNoteMode ?? 'preserve';
  if (!['preserve', 'replace'].includes(mode) || (input.contextNote !== undefined && input.contextNote !== null && typeof input.contextNote !== 'string')) {
    throw new OwnerManagementError(400, 'The context note selection is invalid.');
  }
  const note = input.contextNote?.trim() || null;
  if ((note?.length ?? 0) > 2000) throw new OwnerManagementError(400, 'The context note is too long.');
  return { actionId: actionId(input.actionId), reviewId: referenceId(input.reviewId, 'Review ID'),
    expectedFingerprint: input.expectedFingerprint, professorId: catalogId(input.professorId, 'Professor ID'),
    courseId: input.courseId === null ? null : catalogId(input.courseId, 'Course ID'),
    reason: boundedText(input.reason, 'Reason', 10, 2000), evidenceUrl: evidenceUrl(input.evidenceUrl),
    contextNoteMode: mode, contextNote: mode === 'replace' ? note : null };
}
function mutationError(error: unknown): never {
  const code = (error as { code?: string })?.code;
  if (code === 'P0404') throw new OwnerManagementError(404, 'The selected review, report, course, or professor no longer exists.');
  if (code === 'P0409') throw new OwnerManagementError(409, 'The record changed or this action ID was already used. Reload before saving again.');
  if (code === 'P0400' || code === '23514' || code === '23503') throw new OwnerManagementError(400, 'The correction could not be validated. Check the selected records and evidence.');
  throw error;
}

export async function getOwnerOverview(): Promise<OwnerOverview> {
  await requireOwnerActor();
  const sql = database();
  const [counts, unmatched, actions, baselines, health] = await Promise.all([
    sql`SELECT status,count(*)::integer AS total FROM anonymous_reports GROUP BY status`,
    sql`SELECT count(*)::integer AS total FROM public_written_reviews WHERE professor_id IS NULL OR course_id IS NULL`,
    sql`SELECT action_id AS "actionId",action_kind AS kind,target_id AS "targetId",actor_github_id AS "actorGithubId",
      reason,evidence_url AS "evidenceUrl",created_at::text AS "createdAt" FROM owner_actions ORDER BY created_at DESC,action_id DESC LIMIT 12`,
    sql`SELECT dataset FROM owner_growth_baselines ORDER BY measured_at DESC,id DESC LIMIT 4`,
    sql`SELECT now()::text AS "asOf",
      (SELECT count(*)::integer FROM reviews WHERE source='eagleevals_anonymous' AND published
        AND submitted_at>=now()-interval '7 days') AS "nativeLast7Days",
      (SELECT count(*)::integer FROM reviews WHERE source='eagleevals_anonymous' AND published
        AND submitted_at>=now()-interval '28 days') AS "nativeLast28Days",
      (SELECT max(submitted_at)::text FROM reviews WHERE source='eagleevals_anonymous' AND published) AS "lastNativeSubmissionAt",
      (SELECT count(*)::integer FROM public_written_reviews) AS "writtenReviews",
      (SELECT count(*)::integer FROM public_written_reviews WHERE course_id IS NOT NULL) AS "courseLinkedWrittenReviews",
      (SELECT count(*)::integer FROM public_written_reviews WHERE professor_id IS NOT NULL) AS "professorLinkedWrittenReviews",
      (SELECT min(created_at)::text FROM anonymous_reports WHERE status='open') AS "oldestOpenReportAt"`,
  ]);
  const reportCounts = { open: 0, resolved: 0, dismissed: 0 };
  for (const row of counts) reportCounts[row.status as OwnerReportStatus] = row.total;
  return { reportCounts, unmatchedReviews: unmatched[0].total, recentActions: actions as OwnerAction[],
    growthBaselines: baselines.map(row => row.dataset as OwnerGrowthBaseline), reviewHealth: health[0] as OwnerOverview['reviewHealth'] };
}

export async function getOwnerReports(options: { status?: OwnerReportStatus | 'all'; limit?: number; offset?: number } = {}): Promise<{ reports: OwnerReport[]; total: number }> {
  await requireOwnerActor();
  const { limit, offset } = pageOptions(options.limit, options.offset);
  const status = options.status ?? 'open';
  if (!['open', 'resolved', 'dismissed', 'all'].includes(status)) throw new OwnerManagementError(400, 'The report status is invalid.');
  const sql = database();
  const [rows, count] = await Promise.all([
    sql`SELECT owner_report_state(id) AS report FROM anonymous_reports WHERE (${status}='all' OR status=${status})
      ORDER BY created_at DESC,id DESC LIMIT ${limit} OFFSET ${offset}`,
    sql`SELECT count(*)::integer AS total FROM anonymous_reports WHERE (${status}='all' OR status=${status})`,
  ]);
  return { reports: rows.map(row => row.report as OwnerReport), total: count[0].total };
}

export async function getOwnerReviewLookup(options: { reviewId?: string; query?: string; unmatchedOnly?: boolean; limit?: number; offset?: number } = {}): Promise<{ reviews: OwnerReview[]; total: number }> {
  await requireOwnerActor();
  const { limit, offset } = pageOptions(options.limit, options.offset);
  const id = options.reviewId ? referenceId(options.reviewId, 'Review ID') : null;
  const query = queryText(options.query);
  const unmatched = options.unmatchedOnly ?? false;
  if (typeof unmatched !== 'boolean') throw new OwnerManagementError(400, 'The review filter is invalid.');
  const sql = database();
  const [rows, count] = await Promise.all([
    sql`SELECT owner_review_state(w.id) AS review FROM public_written_reviews w
      WHERE (${id}::text IS NULL OR w.id=${id}) AND (NOT ${unmatched} OR w.professor_id IS NULL OR w.course_id IS NULL)
        AND (${query}='' OR position(lower(${query}) in lower(concat_ws(' ',w.id,w.message,w.professor_name,w.course_code,w.course_title)))>0)
      ORDER BY w.created_at DESC,w.id DESC LIMIT ${limit} OFFSET ${offset}`,
    sql`SELECT count(*)::integer AS total FROM public_written_reviews w
      WHERE (${id}::text IS NULL OR w.id=${id}) AND (NOT ${unmatched} OR w.professor_id IS NULL OR w.course_id IS NULL)
        AND (${query}='' OR position(lower(${query}) in lower(concat_ws(' ',w.id,w.message,w.professor_name,w.course_code,w.course_title)))>0)`,
  ]);
  return { reviews: rows.map(row => row.review as OwnerReview), total: count[0].total };
}

export async function getOwnerCatalogCandidates(options: { kind: 'course' | 'professor'; query: string; limit?: number }): Promise<OwnerCatalogCandidate[]> {
  await requireOwnerActor();
  if (!options || !['course', 'professor'].includes(options.kind)) throw new OwnerManagementError(400, 'The catalog selection is invalid.');
  const query = queryText(options.query);
  const { limit } = pageOptions(options.limit ?? 15);
  if (!query) return [];
  const sql = database();
  const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (options.kind === 'course') {
    return await sql`SELECT id,code || ' — ' || title AS label,subject AS detail,catalog_source AS "catalogSource" FROM courses
      WHERE position(lower(${query}) in lower(code || ' ' || title || ' ' || subject))>0
        OR (${normalized}<>'' AND position(${normalized} in lower(regexp_replace(code,'[^[:alnum:]]','','g')))>0)
      ORDER BY CASE WHEN lower(code)=${normalized} THEN 0 ELSE 1 END,code LIMIT ${limit}` as OwnerCatalogCandidate[];
  }
  return await sql`SELECT p.id,p.name AS label,array_to_string(p.titles,', ') AS detail,p.catalog_source AS "catalogSource" FROM professors p
    WHERE NOT EXISTS(SELECT 1 FROM professor_aliases a WHERE a.alias_id=p.id)
      AND (position(lower(${query}) in lower(p.name || ' ' || array_to_string(p.search_names,' ')))>0 OR p.id=${query})
    ORDER BY p.name,p.id LIMIT ${limit}` as OwnerCatalogCandidate[];
}

export async function changeOwnerReportStatus(input: OwnerReportStatusInput, expectedActor: OwnerActor): Promise<OwnerMutationResult> {
  const actor = await requireOwnerActor(expectedActor);
  const data = validateOwnerReportStatus(input);
  const sql = database();
  try {
    const rows = await sql`SELECT owner_change_report_status(${data.actionId},${actor.githubId},${data.reportId},
      ${data.status},${data.expectedVersion},${data.reason}) AS result`;
    return rows[0].result as OwnerMutationResult;
  } catch (error) { mutationError(error); }
}

export async function correctOwnerReviewAssociation(input: OwnerAssociationInput, expectedActor: OwnerActor): Promise<OwnerMutationResult> {
  const actor = await requireOwnerActor(expectedActor);
  const data = validateOwnerAssociation(input);
  const sql = database();
  try {
    const rows = await sql`SELECT owner_correct_review_association(${data.actionId},${actor.githubId},${data.reviewId},
      ${data.expectedFingerprint},${data.professorId},${data.courseId},${data.reason},${data.evidenceUrl},
      ${data.contextNoteMode === 'replace'},${data.contextNote}) AS result`;
    return rows[0].result as OwnerMutationResult;
  } catch (error) { mutationError(error); }
}

export async function installOwnerGrowthBaseline(dataset: OwnerGrowthBaseline, expectedActor: OwnerActor): Promise<void> {
  const actor = await requireOwnerActor(expectedActor);
  if (!dataset || typeof dataset.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(dataset.id) ||
      typeof dataset.measuredAt !== 'string' || !Number.isFinite(Date.parse(dataset.measuredAt)) ||
      !dataset.traffic || !dataset.speedInsights || !dataset.searchConsole || !Array.isArray(dataset.sources)) {
    throw new OwnerManagementError(400, 'The baseline dataset is invalid.');
  }
  const sql = database();
  const data = JSON.stringify(dataset);
  // A stable baseline ID cannot silently replace an existing measurement.
  const rows = await sql`INSERT INTO owner_growth_baselines(id,measured_at,dataset,installed_by_github_id)
    VALUES(${dataset.id},${dataset.measuredAt},${data}::jsonb,${actor.githubId})
    ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id WHERE owner_growth_baselines.dataset=EXCLUDED.dataset
      AND owner_growth_baselines.measured_at=EXCLUDED.measured_at RETURNING id`;
  if (rows.length !== 1) throw new OwnerManagementError(409, 'A different baseline already uses this ID.');
}
