import "server-only";

import { unstable_cache } from "next/cache";
import type { RmpReviewsPage, StudentComment } from "./types";

const SCHOOL_ID = "U2Nob29sLTEyMg=="; // Boston College, school 122.
const ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const PAGE_SIZE = 10;

type Teacher = { id: string; legacyId: number; firstName: string; lastName: string; school: { id: string } };
type Match = { status: "matched"; teacher: Teacher } | { status: "not_found" | "ambiguous" };

// Verified against BC profiles on 2026-10-14. An alias must never apply to a
// different local professor simply because their name happens to be similar.
const VERIFIED_PROFILES: Record<string, { name: string; rmpName: string; id: number }> = {
  "65c42b4a49939741c67c76b3": { name: "Bradford Hudson", rmpName: "Bradford Hudson", id: 2476813 },
  "65c42b4a49939741c67c7693": { name: "Jeffrey Lucas", rmpName: "Jeff Lucas", id: 2712447 },
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nameKey(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function normalizeRmpCourse(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validRmpCursor(value: string): boolean {
  return value.length <= 128 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
    && /^arrayconnection:\d{1,6}$/.test(Buffer.from(value, "base64").toString("utf8"));
}

function parseTeacher(value: unknown): Teacher | null {
  const p = record(value);
  const school = record(p.school);
  if (typeof p.id !== "string" || !Number.isSafeInteger(p.legacyId) || Number(p.legacyId) <= 0
    || typeof p.firstName !== "string" || typeof p.lastName !== "string" || school.id !== SCHOOL_ID
    || Buffer.from(p.id, "base64").toString("utf8") !== `Teacher-${p.legacyId}`) return null;
  return { id: p.id, legacyId: Number(p.legacyId), firstName: p.firstName.trim(), lastName: p.lastName.trim(), school: { id: SCHOOL_ID } };
}

export function matchRmpTeacher(name: string, values: unknown[]): Match {
  // Require a unique exact full name. Nicknames need a verified mapping above;
  // neither the first search result nor fuzzy similarity establishes identity.
  const matches = new Map(values.map(parseTeacher).filter((p): p is Teacher => p !== null)
    .filter(p => nameKey(`${p.firstName} ${p.lastName}`) === nameKey(name)).map(p => [p.id, p]));
  if (matches.size !== 1) return { status: matches.size ? "ambiguous" : "not_found" };
  return { status: "matched", teacher: [...matches.values()][0] };
}

export class RmpUnavailableError extends Error {
  constructor(public code: string) { super("Rate My Professors is temporarily unavailable"); }
}

async function request(query: string, variables: Record<string, unknown>): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Public test:test value used by the legacy integration, not a user secret.
        Authorization: "Basic dGVzdDp0ZXN0",
        "User-Agent": "EagleEvals/1.0 (+https://eagleevals.com)",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch { throw new RmpUnavailableError("transport"); }
  if (!response.ok) throw new RmpUnavailableError(`http_${response.status}`);
  let result: Record<string, unknown>;
  try { result = record(await response.json()); }
  catch { throw new RmpUnavailableError("invalid_json"); }
  if (result.errors || !result.data) throw new RmpUnavailableError("graphql");
  return record(result.data);
}

const SEARCH_QUERY = `query EagleEvalsTeachers($text: String!, $schoolID: ID!) {
  newSearch { teachers(query: {text: $text, schoolID: $schoolID}, first: 20) {
    edges { node { id legacyId firstName lastName school { id } } }
  } }
}`;

const findTeacher = unstable_cache(async (professorId: string, name: string): Promise<Match> => {
  const verified = VERIFIED_PROFILES[professorId];
  if (verified && nameKey(verified.name) === nameKey(name)) {
    const [firstName, ...rest] = verified.rmpName.split(" ");
    return { status: "matched", teacher: { id: Buffer.from(`Teacher-${verified.id}`).toString("base64"), legacyId: verified.id,
      firstName, lastName: rest.join(" "), school: { id: SCHOOL_ID } } };
  }
  const data = await request(SEARCH_QUERY, { text: name, schoolID: SCHOOL_ID });
  const search = record(data.newSearch);
  if (search.teachers === null) return { status: "not_found" };
  const teachers = record(search.teachers);
  if (!Array.isArray(teachers.edges)) throw new RmpUnavailableError("invalid_search");
  return matchRmpTeacher(name, teachers.edges.map(edge => record(edge).node));
}, ["rmp-teacher-v1"], { revalidate: 86_400 });

const REVIEWS_QUERY = `query EagleEvalsReviews($id: ID!, $after: String, $course: String) {
  node(id: $id) { ... on Teacher {
    id legacyId firstName lastName school { id } numRatings
    ratings(first: ${PAGE_SIZE}, after: $after, courseFilter: $course) {
      edges { node { id class comment date wouldTakeAgain } }
      pageInfo { hasNextPage endCursor }
    }
  } }
}`;

function rmpDate(value: unknown): string | null {
  // RMP returns e.g. "2025-01-13 04:14:50 +0000 UTC". Do not infer a semester.
  const match = typeof value === "string" ? value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \+0000 UTC$/) : null;
  const date = match ? Date.parse(`${match[1]}T${match[2]}Z`) : NaN;
  return Number.isFinite(date) ? new Date(date).toISOString() : null;
}

const readPage = unstable_cache(async (teacher: Teacher, cursor: string | null, courseCode: string | null) => {
  const data = await request(REVIEWS_QUERY, { id: teacher.id, after: cursor, course: courseCode });
  const node = record(data.node);
  const currentTeacher = parseTeacher(node);
  if (!currentTeacher || currentTeacher.id !== teacher.id
    || nameKey(`${currentTeacher.firstName} ${currentTeacher.lastName}`) !== nameKey(`${teacher.firstName} ${teacher.lastName}`)) {
    throw new RmpUnavailableError("identity_changed");
  }
  const ratings = record(node.ratings);
  const pageInfo = record(ratings.pageInfo);
  if (!Array.isArray(ratings.edges) || ratings.edges.length > PAGE_SIZE || typeof pageInfo.hasNextPage !== "boolean"
    || !Number.isSafeInteger(node.numRatings) || Number(node.numRatings) < 0) throw new RmpUnavailableError("invalid_page");
  const hasNextPage = pageInfo.hasNextPage;
  const endCursor = typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null;
  if (hasNextPage && (!endCursor || !validRmpCursor(endCursor) || endCursor === cursor || !ratings.edges.length)) {
    throw new RmpUnavailableError("invalid_cursor");
  }
  const ids = new Set<string>();
  const comments: Pick<StudentComment, "id" | "message" | "createdAt" | "wouldTakeAgain" | "courseCode">[] = [];
  for (const edge of ratings.edges) {
    const review = record(record(edge).node);
    const date = rmpDate(review.date);
    if (typeof review.id !== "string" || !/^Rating-\d+$/.test(Buffer.from(review.id, "base64").toString("utf8"))
      || typeof review.comment !== "string" || !date || ids.has(review.id)) throw new RmpUnavailableError("invalid_review");
    ids.add(review.id);
    const rawCourse = typeof review.class === "string" ? review.class : null;
    if (courseCode && normalizeRmpCourse(rawCourse ?? "") !== normalizeRmpCourse(courseCode)) throw new RmpUnavailableError("wrong_course");
    if (!review.comment.trim()) continue; // A numerical rating need not contain text.
    comments.push({ id: `rmp:${review.id}`, message: review.comment, createdAt: date, courseCode: rawCourse,
      wouldTakeAgain: review.wouldTakeAgain === "Yes" ? true : review.wouldTakeAgain === "No" ? false : null });
  }
  return { comments, hasNextPage, endCursor: hasNextPage ? endCursor : null, ratingCount: Number(node.numRatings) };
}, ["rmp-reviews-v1"], { revalidate: 900 });

export async function getRmpReviews(professorId: string, professorName: string, course: { id: string; code: string } | null, cursor: string | null): Promise<RmpReviewsPage> {
  const match = await findTeacher(professorId, professorName);
  if (match.status !== "matched") return { status: match.status, profile: null, comments: [], hasNextPage: false, endCursor: null, courseCode: course?.code ?? null };
  const page = await readPage(match.teacher, cursor, course?.code ?? null);
  const profile = { name: `${match.teacher.firstName} ${match.teacher.lastName}`, url: `https://www.ratemyprofessors.com/professor/${match.teacher.legacyId}`, ratingCount: page.ratingCount };
  return { status: "matched", profile, hasNextPage: page.hasNextPage, endCursor: page.endCursor, courseCode: course?.code ?? null,
    comments: page.comments.map(comment => ({ ...comment, semester: null, professorId, professorName,
      courseId: course && normalizeRmpCourse(comment.courseCode ?? "") === normalizeRmpCourse(course.code) ? course.id : null,
      courseTitle: null, source: "ratemyprofessors", sourceUrl: profile.url })) };
}
