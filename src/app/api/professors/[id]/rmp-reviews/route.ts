import { NextResponse } from "next/server";
import { getReviewSelections } from "@/data/queries";
import { getRmpReviews, RmpUnavailableError, validRmpCursor } from "@/data/rmp";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const cursor = query.get("after");
  const courseId = query.get("course");
  const headers = { "Cache-Control": "no-store" };
  if (!/^[0-9a-f]{24}$/.test(id) || (courseId !== null && !/^[0-9a-f]{24}$/.test(courseId))
    || (cursor !== null && !validRmpCursor(cursor))) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400, headers });
  }
  try {
    const selections = await getReviewSelections(courseId ?? undefined, id);
    if (!selections.professor || (courseId && !selections.course)) return NextResponse.json({ error: "Professor or course not found." }, { status: 404, headers });
    const page = await getRmpReviews(id, selections.professor.primary,
      selections.course ? { id: selections.course.id, code: selections.course.primary } : null, cursor);
    return NextResponse.json(page, { headers });
  } catch (error) {
    console.warn(JSON.stringify({ event: "rmp_reviews_failed", code: error instanceof RmpUnavailableError ? error.code : "internal" }));
    return NextResponse.json({ error: "Rate My Professors reviews are temporarily unavailable. Your EagleEvals reviews are still here." }, { status: 503, headers });
  }
}
