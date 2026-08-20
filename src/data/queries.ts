import "server-only";

import { cache } from "react";
import { database } from "@/data/database";
import { semesterSortValue } from "@/data/format";
import type {
  CourseDetail,
  CourseSummary,
  EvaluationRecord,
  InstructorCourseRow,
  MetricValue,
  PaginatedResult,
  ProfessorCourseRow,
  ProfessorDetail,
  ProfessorSummary,
  ReviewSelection,
  SearchResults,
  SemesterSummary,
  SiteStats,
  StudentComment,
} from "@/data/types";

const PAGE_SIZE = 24;
const EVALUATION_PAGE_SIZE = 30;

type DbRow = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asCount(value: unknown): number {
  return asNumber(value) ?? 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function mapCourse(row: DbRow): CourseSummary {
  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    subject: String(row.subject),
    college: row.college ? String(row.college) : null,
    description: String(row.description ?? ""),
    reviewCount: asCount(row.review_count),
    courseOverall: asNumber(row.course_overall),
    instructorOverall: asNumber(row.instructor_overall),
    commentCount: asCount(row.comment_count),
  };
}

function mapProfessor(row: DbRow): ProfessorSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    titles: asStringArray(row.titles),
    education: asStringArray(row.education),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    office: row.office ? String(row.office) : null,
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    reviewCount: asCount(row.review_count),
    courseOverall: asNumber(row.course_overall),
    instructorOverall: asNumber(row.instructor_overall),
    commentCount: asCount(row.comment_count),
  };
}

function normalizeQuery(query: string): string {
  return query.replace(/[\\%_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export const getSiteStats = cache(async (): Promise<SiteStats> => {
  const sql = database();
  const rows = (await sql`
    SELECT
      (SELECT count(*)::integer FROM courses) AS courses,
      (SELECT count(*)::integer FROM professors) AS professors,
      (SELECT count(*)::integer FROM reviews WHERE published) AS reviews,
      (SELECT count(*)::integer FROM student_comments WHERE published) AS comments
  `) as DbRow[];
  const row = rows[0] ?? {};
  return {
    courses: asCount(row.courses),
    professors: asCount(row.professors),
    reviews: asCount(row.reviews),
    comments: asCount(row.comments),
  };
});

export const getFeaturedCourses = cache(async (): Promise<CourseSummary[]> => {
  const sql = database();
  const rows = (await sql`
    SELECT * FROM course_summaries
    WHERE review_count >= 20
    ORDER BY review_count DESC, code ASC
    LIMIT 4
  `) as DbRow[];
  return rows.map(mapCourse);
});

export const getFeaturedProfessors = cache(async (): Promise<ProfessorSummary[]> => {
  const sql = database();
  const rows = (await sql`
    SELECT * FROM professor_summaries
    WHERE review_count >= 15
    ORDER BY review_count DESC, name ASC
    LIMIT 4
  `) as DbRow[];
  return rows.map(mapProfessor);
});

export async function searchCatalog(rawQuery: string, limit = 12): Promise<SearchResults> {
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) return { courses: [], professors: [] };

  const sql = database();
  const pattern = `%${query}%`;
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 30));
  const [courseRows, professorRows] = await Promise.all([
    sql`
      SELECT * FROM course_summaries
      WHERE (code || ' ' || title || ' ' || subject) ILIKE ${pattern}
      ORDER BY
        CASE WHEN lower(code) = lower(${query}) THEN 0 WHEN code ILIKE ${`${query}%`} THEN 1 ELSE 2 END,
        greatest(similarity(lower(code), lower(${query})), similarity(lower(title), lower(${query}))) DESC,
        review_count DESC,
        code ASC
      LIMIT ${safeLimit}
    `,
    sql`
      SELECT * FROM professor_summaries
      WHERE name ILIKE ${pattern}
      ORDER BY
        CASE WHEN lower(name) = lower(${query}) THEN 0 WHEN name ILIKE ${`${query}%`} THEN 1 ELSE 2 END,
        similarity(lower(name), lower(${query})) DESC,
        review_count DESC,
        name ASC
      LIMIT ${safeLimit}
    `,
  ]);

  return {
    courses: (courseRows as DbRow[]).map(mapCourse),
    professors: (professorRows as DbRow[]).map(mapProfessor),
  };
}

export async function getCoursesPage(rawQuery: string, rawPage: number): Promise<PaginatedResult<CourseSummary>> {
  const query = normalizeQuery(rawQuery);
  const page = normalizePage(rawPage);
  const offset = (page - 1) * PAGE_SIZE;
  const sql = database();
  let rows: DbRow[];
  let countRows: DbRow[];

  if (query) {
    const pattern = `%${query}%`;
    [rows, countRows] = (await Promise.all([
      sql`
        SELECT * FROM course_summaries
        WHERE (code || ' ' || title || ' ' || subject) ILIKE ${pattern}
        ORDER BY review_count DESC, code ASC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
      sql`SELECT count(*)::integer AS total FROM courses WHERE (code || ' ' || title || ' ' || subject) ILIKE ${pattern}`,
    ])) as [DbRow[], DbRow[]];
  } else {
    [rows, countRows] = (await Promise.all([
      sql`SELECT * FROM course_summaries ORDER BY review_count DESC, code ASC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      sql`SELECT count(*)::integer AS total FROM courses`,
    ])) as [DbRow[], DbRow[]];
  }

  const total = asCount(countRows[0]?.total);
  return { items: rows.map(mapCourse), page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), query };
}

export async function getProfessorsPage(rawQuery: string, rawPage: number): Promise<PaginatedResult<ProfessorSummary>> {
  const query = normalizeQuery(rawQuery);
  const page = normalizePage(rawPage);
  const offset = (page - 1) * PAGE_SIZE;
  const sql = database();
  let rows: DbRow[];
  let countRows: DbRow[];

  if (query) {
    const pattern = `%${query}%`;
    [rows, countRows] = (await Promise.all([
      sql`
        SELECT * FROM professor_summaries
        WHERE name ILIKE ${pattern}
        ORDER BY review_count DESC, name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
      sql`SELECT count(*)::integer AS total FROM professors WHERE name ILIKE ${pattern}`,
    ])) as [DbRow[], DbRow[]];
  } else {
    [rows, countRows] = (await Promise.all([
      sql`SELECT * FROM professor_summaries ORDER BY review_count DESC, name ASC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      sql`SELECT count(*)::integer AS total FROM professors`,
    ])) as [DbRow[], DbRow[]];
  }

  const total = asCount(countRows[0]?.total);
  return { items: rows.map(mapProfessor), page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), query };
}

function mapComment(row: DbRow): StudentComment {
  return {
    id: String(row.id),
    message: String(row.message),
    wouldTakeAgain: Boolean(row.would_take_again),
    createdAt: new Date(String(row.created_at)).toISOString(),
    professorId: String(row.professor_id),
    professorName: String(row.professor_name),
    courseId: row.course_id ? String(row.course_id) : null,
    courseCode: row.course_code ? String(row.course_code) : null,
    courseTitle: row.course_title ? String(row.course_title) : null,
    source: String(row.source ?? "legacy_eagleeval"),
  };
}

function mapEvaluation(row: DbRow): EvaluationRecord {
  return {
    id: String(row.id),
    semester: String(row.semester),
    section: asCount(row.section),
    sectionCode: String(row.section_code),
    courseOverall: asNumber(row.course_overall),
    instructorOverall: asNumber(row.instructor_overall),
    courseId: row.course_id ? String(row.course_id) : null,
    courseCode: String(row.course_code),
    courseTitle: row.course_title ? String(row.course_title) : null,
    professorId: row.professor_id ? String(row.professor_id) : null,
    professorName: String(row.professor_name),
    source: String(row.source ?? "legacy_eagleeval"),
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : null,
    metrics: [
      { label: "Organization", value: asNumber(row.course_well_organized) },
      { label: "Challenge", value: asNumber(row.course_intellectually_challenging) },
      { label: "Attendance", value: asNumber(row.attendance_necessary) },
      { label: "Assignments", value: asNumber(row.assignments_helpful) },
      { label: "Prepared", value: asNumber(row.instructor_prepared) },
      { label: "Clear explanations", value: asNumber(row.instructor_clear_explanations) },
      { label: "Available for help", value: asNumber(row.available_for_help_outside_class) },
      { label: "Stimulated interest", value: asNumber(row.stimulated_interest) },
      { label: "Weekly effort", value: asNumber(row.effort_average_hours_weekly) },
    ],
  };
}

const evaluationSelect = `
  SELECT r.id, r.semester, r.section, r.section_code,
    r.course_overall, r.instructor_overall, r.course_id, r.course_code,
    c.title AS course_title, r.professor_id, r.professor_name,
    r.source, r.submitted_at,
    m.attendance_necessary, m.available_for_help_outside_class,
    m.course_intellectually_challenging, m.course_well_organized,
    m.instructor_clear_explanations, m.instructor_prepared,
    m.stimulated_interest, m.assignments_helpful,
    m.effort_average_hours_weekly
  FROM reviews r
  LEFT JOIN courses c ON c.id = r.course_id
  LEFT JOIN review_metrics m ON m.review_id = r.id
`;

export async function getEvaluationsPage(rawQuery: string, rawPage: number): Promise<PaginatedResult<EvaluationRecord>> {
  const query = normalizeQuery(rawQuery);
  const page = normalizePage(rawPage);
  const offset = (page - 1) * EVALUATION_PAGE_SIZE;
  const sql = database();
  let rows: DbRow[];
  let countRows: DbRow[];
  const order = `
    ORDER BY
      CASE WHEN r.source = 'eagleevals_anonymous' THEN 0 ELSE 1 END,
      r.submitted_at DESC NULLS LAST,
      NULLIF(substring(r.semester from '([0-9]{4})'), '')::integer DESC NULLS LAST,
      CASE
        WHEN r.semester ILIKE 'Fall%' THEN 3
        WHEN r.semester ILIKE 'Summer%' THEN 2
        WHEN r.semester ILIKE 'Spring%' THEN 1
        ELSE 0
      END DESC,
      r.course_code ASC,
      r.section ASC
  `;

  if (query) {
    const pattern = `%${query}%`;
    [rows, countRows] = (await Promise.all([
      sql.query(`${evaluationSelect}
        WHERE r.published AND (
          r.course_code ILIKE $1 OR c.title ILIKE $1 OR
          r.professor_name ILIKE $1 OR r.semester ILIKE $1
        )
        ${order}
        LIMIT $2 OFFSET $3`, [pattern, EVALUATION_PAGE_SIZE, offset]),
      sql.query(`SELECT count(*)::integer AS total
        FROM reviews r
        LEFT JOIN courses c ON c.id = r.course_id
        WHERE r.published AND (
          r.course_code ILIKE $1 OR c.title ILIKE $1 OR
          r.professor_name ILIKE $1 OR r.semester ILIKE $1
        )`, [pattern]),
    ])) as [DbRow[], DbRow[]];
  } else {
    [rows, countRows] = (await Promise.all([
      sql.query(`${evaluationSelect} WHERE r.published ${order} LIMIT $1 OFFSET $2`, [EVALUATION_PAGE_SIZE, offset]),
      sql`SELECT count(*)::integer AS total FROM reviews WHERE published`,
    ])) as [DbRow[], DbRow[]];
  }

  const total = asCount(countRows[0]?.total);
  return {
    items: rows.map(mapEvaluation),
    page,
    pageSize: EVALUATION_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / EVALUATION_PAGE_SIZE)),
    query,
  };
}

export async function getCommentsPage(rawQuery: string, rawPage: number): Promise<PaginatedResult<StudentComment>> {
  const query = normalizeQuery(rawQuery);
  const page = normalizePage(rawPage);
  const offset = (page - 1) * EVALUATION_PAGE_SIZE;
  const sql = database();
  const select = `
    SELECT sc.id, sc.message, sc.would_take_again, sc.created_at, sc.source,
      sc.professor_id, p.name AS professor_name,
      sc.course_id, c.code AS course_code, c.title AS course_title
    FROM student_comments sc
    JOIN professors p ON p.id = sc.professor_id
    LEFT JOIN courses c ON c.id = sc.course_id
  `;
  let rows: DbRow[];
  let countRows: DbRow[];

  if (query) {
    const pattern = `%${query}%`;
    [rows, countRows] = (await Promise.all([
      sql.query(`${select}
        WHERE sc.published AND (
          sc.message ILIKE $1 OR p.name ILIKE $1 OR
          c.code ILIKE $1 OR c.title ILIKE $1
        )
        ORDER BY sc.created_at DESC, sc.id DESC
        LIMIT $2 OFFSET $3`, [pattern, EVALUATION_PAGE_SIZE, offset]),
      sql.query(`SELECT count(*)::integer AS total
        FROM student_comments sc
        JOIN professors p ON p.id = sc.professor_id
        LEFT JOIN courses c ON c.id = sc.course_id
        WHERE sc.published AND (
          sc.message ILIKE $1 OR p.name ILIKE $1 OR
          c.code ILIKE $1 OR c.title ILIKE $1
        )`, [pattern]),
    ])) as [DbRow[], DbRow[]];
  } else {
    [rows, countRows] = (await Promise.all([
      sql.query(`${select} WHERE sc.published ORDER BY sc.created_at DESC, sc.id DESC LIMIT $1 OFFSET $2`, [EVALUATION_PAGE_SIZE, offset]),
      sql`SELECT count(*)::integer AS total FROM student_comments WHERE published`,
    ])) as [DbRow[], DbRow[]];
  }

  const total = asCount(countRows[0]?.total);
  return {
    items: rows.map(mapComment),
    page,
    pageSize: EVALUATION_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / EVALUATION_PAGE_SIZE)),
    query,
  };
}

export async function getReviewSelections(courseId?: string, professorId?: string): Promise<{ course: ReviewSelection | null; professor: ReviewSelection | null }> {
  const validCourseId = courseId && /^[0-9a-f]{24}$/.test(courseId) ? courseId : null;
  const validProfessorId = professorId && /^[0-9a-f]{24}$/.test(professorId) ? professorId : null;
  const sql = database();
  const [courseRows, professorRows] = (await Promise.all([
    validCourseId ? sql`SELECT id, code, title FROM courses WHERE id = ${validCourseId} LIMIT 1` : Promise.resolve([]),
    validProfessorId ? sql`SELECT id, name, titles FROM professors WHERE id = ${validProfessorId} LIMIT 1` : Promise.resolve([]),
  ])) as [DbRow[], DbRow[]];

  return {
    course: courseRows[0]
      ? { id: String(courseRows[0].id), primary: String(courseRows[0].code), secondary: String(courseRows[0].title) }
      : null,
    professor: professorRows[0]
      ? { id: String(professorRows[0].id), primary: String(professorRows[0].name), secondary: asStringArray(professorRows[0].titles)[0] ?? "Boston College faculty" }
      : null,
  };
}

export const getCourseDetail = cache(async (id: string): Promise<CourseDetail | null> => {
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  const sql = database();
  const [courseRows, metricRows, instructorRows, commentRows, semesterRows] = (await Promise.all([
    sql`SELECT * FROM course_summaries WHERE id = ${id} LIMIT 1`,
    sql`
      SELECT
        avg(m.course_well_organized) AS organized,
        avg(m.course_intellectually_challenging) AS challenging,
        avg(m.attendance_necessary) AS attendance,
        avg(m.assignments_helpful) AS assignments,
        avg(m.effort_average_hours_weekly) AS effort
      FROM reviews r
      JOIN review_metrics m ON m.review_id = r.id
      WHERE r.published AND r.course_id = ${id}
    `,
    sql`
      SELECT p.id, p.name, p.titles, count(r.id)::integer AS review_count,
        avg(r.course_overall) AS course_overall,
        avg(r.instructor_overall) AS instructor_overall
      FROM reviews r
      JOIN professors p ON p.id = r.professor_id
      WHERE r.published AND r.course_id = ${id}
      GROUP BY p.id, p.name, p.titles
      ORDER BY review_count DESC, p.name ASC
      LIMIT 60
    `,
    sql`
      SELECT sc.id, sc.message, sc.would_take_again, sc.created_at, sc.source,
        sc.professor_id, p.name AS professor_name,
        sc.course_id, c.code AS course_code, c.title AS course_title
      FROM student_comments sc
      JOIN professors p ON p.id = sc.professor_id
      LEFT JOIN courses c ON c.id = sc.course_id
      WHERE sc.published AND sc.course_id = ${id}
      ORDER BY sc.created_at DESC
      LIMIT 30
    `,
    sql`
      SELECT semester, count(*)::integer AS review_count,
        avg(course_overall) AS course_overall,
        avg(instructor_overall) AS instructor_overall
      FROM reviews
      WHERE published AND course_id = ${id}
      GROUP BY semester
    `,
  ])) as [DbRow[], DbRow[], DbRow[], DbRow[], DbRow[]];

  if (!courseRows[0]) return null;
  const metric = metricRows[0] ?? {};
  const metrics: MetricValue[] = [
    { label: "Organization", value: asNumber(metric.organized), description: "How well the course was organized" },
    { label: "Challenge", value: asNumber(metric.challenging), description: "How intellectually challenging students found it" },
    { label: "Attendance", value: asNumber(metric.attendance), description: "How necessary attendance was" },
    { label: "Assignments", value: asNumber(metric.assignments), description: "How helpful assignments were" },
  ];
  const effort = asNumber(metric.effort);

  const instructors: InstructorCourseRow[] = instructorRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    titles: asStringArray(row.titles),
    reviewCount: asCount(row.review_count),
    courseOverall: asNumber(row.course_overall),
    instructorOverall: asNumber(row.instructor_overall),
  }));
  const semesters: SemesterSummary[] = semesterRows
    .map((row) => ({ semester: String(row.semester), reviewCount: asCount(row.review_count), courseOverall: asNumber(row.course_overall), instructorOverall: asNumber(row.instructor_overall) }))
    .sort((a, b) => semesterSortValue(b.semester) - semesterSortValue(a.semester));

  return {
    course: mapCourse(courseRows[0]),
    metrics,
    estimatedWeeklyHours: effort === null ? null : Math.max(1, Math.round(effort * 4) / 2 - 1),
    instructors,
    comments: commentRows.map(mapComment),
    semesters,
  };
});

export const getProfessorDetail = cache(async (id: string): Promise<ProfessorDetail | null> => {
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  const sql = database();
  const [professorRows, metricRows, courseRows, commentRows] = (await Promise.all([
    sql`SELECT * FROM professor_summaries WHERE id = ${id} LIMIT 1`,
    sql`
      SELECT
        avg(m.instructor_prepared) AS prepared,
        avg(m.instructor_clear_explanations) AS clear_explanations,
        avg(m.available_for_help_outside_class) AS available,
        avg(m.stimulated_interest) AS stimulated_interest
      FROM reviews r
      JOIN review_metrics m ON m.review_id = r.id
      WHERE r.published AND r.professor_id = ${id}
    `,
    sql`
      SELECT c.id, c.code, c.title, c.subject, count(r.id)::integer AS review_count,
        avg(r.course_overall) AS course_overall,
        avg(r.instructor_overall) AS instructor_overall
      FROM reviews r
      JOIN courses c ON c.id = r.course_id
      WHERE r.published AND r.professor_id = ${id}
      GROUP BY c.id, c.code, c.title, c.subject
      ORDER BY review_count DESC, c.code ASC
      LIMIT 60
    `,
    sql`
      SELECT sc.id, sc.message, sc.would_take_again, sc.created_at, sc.source,
        sc.professor_id, p.name AS professor_name,
        sc.course_id, c.code AS course_code, c.title AS course_title
      FROM student_comments sc
      JOIN professors p ON p.id = sc.professor_id
      LEFT JOIN courses c ON c.id = sc.course_id
      WHERE sc.published AND sc.professor_id = ${id}
      ORDER BY sc.created_at DESC
      LIMIT 40
    `,
  ])) as [DbRow[], DbRow[], DbRow[], DbRow[]];

  if (!professorRows[0]) return null;
  const metric = metricRows[0] ?? {};
  const metrics: MetricValue[] = [
    { label: "Prepared", value: asNumber(metric.prepared), description: "Came prepared for class" },
    { label: "Clear", value: asNumber(metric.clear_explanations), description: "Gave clear explanations" },
    { label: "Available", value: asNumber(metric.available), description: "Available for help outside class" },
    { label: "Engaging", value: asNumber(metric.stimulated_interest), description: "Stimulated interest in the subject" },
  ];
  const courses: ProfessorCourseRow[] = courseRows.map((row) => ({
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    subject: String(row.subject),
    reviewCount: asCount(row.review_count),
    courseOverall: asNumber(row.course_overall),
    instructorOverall: asNumber(row.instructor_overall),
  }));

  return { professor: mapProfessor(professorRows[0]), metrics, courses, comments: commentRows.map(mapComment) };
});
