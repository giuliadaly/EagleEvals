import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { database } from "@/data/database";
import { expireReviewData } from "@/data/public-cache";
import { validateReviewSubmission } from "@/data/review-validation";
import { readAnonymousJson } from "@/data/anonymous-request";

type DbRow = Record<string, unknown>;

function newObjectId(): string {
  return randomBytes(12).toString("hex");
}

export async function POST(request: Request) {
  const parsed = await readAnonymousJson(request);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: parsed.status });
  const result = validateReviewSubmission(parsed.body);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  const review = result.data;
  let selected: DbRow;
  const reviewId = newObjectId();
  try {
    const sql = database();
    const selections = (await sql`
      SELECT c.id AS course_id, c.code AS course_code, c.title AS course_title,
        p.id AS professor_id, p.name AS professor_name
      FROM courses c
      CROSS JOIN professors requested
      LEFT JOIN professor_aliases a ON a.alias_id=requested.id
      JOIN professors p ON p.id=COALESCE(a.canonical_id,requested.id)
      WHERE c.id = ${review.courseId} AND requested.id = ${review.professorId}
      LIMIT 1
    `) as DbRow[];
    if (!selections[0]) {
      return NextResponse.json({ message: "That course or professor is no longer available." }, { status: 404 });
    }
    selected = selections[0];
    review.professorId = String(selected.professor_id);
    const metricId = newObjectId();
    const courseCode = String(selected.course_code);
    const professorName = String(selected.professor_name);
    const sectionCode = review.section === null ? null : `${courseCode}${String(review.section).padStart(2, "0")}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({
        ...review,
        message: review.message.toLowerCase().replace(/\s+/g, " "),
      }))
      .digest("hex");

    await sql.transaction([
      sql`SELECT guard_anonymous_review_submission(${review.courseId}, ${review.professorId}, ${review.semester}, ${review.message})`,
      sql`
        INSERT INTO reviews (
          id, course_id, professor_id, section_code, course_code, professor_name,
          semester, section, course_overall, instructor_overall,
          legacy_document, source_snapshot, imported_at,
          source, published, submitted_at, submission_fingerprint
        ) VALUES (
          ${reviewId}, ${review.courseId}, ${review.professorId}, ${sectionCode},
          ${courseCode}, ${professorName}, ${review.semester}, ${review.section},
          ${review.courseOverall}, ${review.instructorOverall},
          ${JSON.stringify({ schemaVersion: 1, anonymousSubmission: true })}::jsonb,
          NULL, now(), 'eagleevals_anonymous', true, now(), ${fingerprint}
        )
      `,
      sql`
        INSERT INTO review_metrics (
          id, review_id, attendance_necessary, available_for_help_outside_class,
          course_intellectually_challenging, course_well_organized,
          instructor_clear_explanations, instructor_prepared, stimulated_interest,
          assignments_helpful, effort_average_hours_weekly,
          legacy_document, source_snapshot, imported_at
        ) VALUES (
          ${metricId}, ${reviewId}, ${review.attendanceNecessary}, ${review.availableForHelp},
          ${review.courseChallenge}, ${review.courseOrganization},
          ${review.clearExplanations}, ${review.instructorPrepared},
          ${review.stimulatedInterest}, ${review.assignmentsHelpful}, ${review.weeklyEffort},
          ${JSON.stringify({ schemaVersion: 1, anonymousSubmission: true })}::jsonb,
          NULL, now()
        )
      `,
      sql`
        INSERT INTO student_comments (
          review_id, professor_id, course_id, message, would_take_again, source,
          published, created_at, legacy_document, source_snapshot, imported_at
        ) VALUES (
          ${reviewId}, ${review.professorId}, ${review.courseId}, ${review.message}, ${review.wouldTakeAgain},
          'eagleevals_anonymous', true, now(),
          ${JSON.stringify({ schemaVersion: 1, anonymousSubmission: true })}::jsonb,
          NULL, now()
        )
      `,
    ]);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "P0429") {
      return NextResponse.json({ message: "Several reviews were just submitted for this class. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
    }
    if (code === "23505") {
      return NextResponse.json({ message: "This review or a very similar one has already been submitted. Please do not submit it again." }, { status: 409 });
    }
    // Database errors can contain submitted values. Log only a bounded category.
    console.error("Anonymous review submission failed", { code: /^[A-Z0-9]{5}$/.test(code) ? code : "unknown" });
    return NextResponse.json({ message: "The review could not be saved. Please try again." }, { status: 500 });
  }

  expireReviewData();
  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath("/professors");
  revalidatePath("/search");
  revalidatePath("/evaluations");
  revalidatePath("/comments");
  revalidatePath(`/courses/${review.courseId}/compare`);
  revalidatePath(`/courses/${review.courseId}`);
  revalidatePath(`/professors/${review.professorId}`);

  return NextResponse.json({
    message: "Your anonymous review is live.",
    reviewId,
    course: { id: review.courseId, code: String(selected.course_code), title: String(selected.course_title) },
    professor: { id: review.professorId, name: String(selected.professor_name) },
  }, { status: 201 });
}
