import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { database } from "@/data/database";
import { validateReviewSubmission } from "@/data/review-validation";

type DbRow = Record<string, unknown>;

function newObjectId(): string {
  return randomBytes(12).toString("hex");
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 20_000) {
    return NextResponse.json({ message: "The review is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "The review could not be read." }, { status: 400 });
  }

  const result = validateReviewSubmission(body);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  const review = result.data;
  const sql = database();
  const selections = (await sql`
    SELECT c.id AS course_id, c.code AS course_code, c.title AS course_title,
      p.id AS professor_id, p.name AS professor_name
    FROM courses c
    CROSS JOIN professors p
    WHERE c.id = ${review.courseId} AND p.id = ${review.professorId}
    LIMIT 1
  `) as DbRow[];
  const selected = selections[0];
  if (!selected) {
    return NextResponse.json({ message: "That course or professor is no longer available." }, { status: 404 });
  }

  const reviewId = newObjectId();
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

  try {
    await sql.transaction([
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
    if (code === "23505") {
      return NextResponse.json({ message: "This exact review has already been submitted." }, { status: 409 });
    }
    console.error("Anonymous review submission failed", error);
    return NextResponse.json({ message: "The review could not be saved. Please try again." }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/comments");
  revalidatePath(`/courses/${review.courseId}/compare`);
  revalidatePath(`/courses/${review.courseId}`);
  revalidatePath(`/professors/${review.professorId}`);

  return NextResponse.json({
    message: "Your anonymous review is live.",
    reviewId,
    course: { id: review.courseId, code: courseCode, title: String(selected.course_title) },
    professor: { id: review.professorId, name: professorName },
  }, { status: 201 });
}
