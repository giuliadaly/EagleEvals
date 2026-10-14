export type SubmissionSuccess = {
  message: string;
  course: { id: string; code: string; title: string };
  professor: { id: string; name: string };
};

export const uncertainSubmissionMessage = "We couldn’t confirm whether your review was published. Your text is still here. Check the course’s reviews before trying again.";
const unavailableMessage = "Publishing is temporarily unavailable. Your review is still here. Please try again in a moment.";

export async function readReviewSubmissionResponse(response: Response): Promise<SubmissionSuccess> {
  // Proxies and database outages can return HTML or an empty body, not JSON.
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) throw new Error(unavailableMessage);
    const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string" ? payload.message : null;
    throw new Error(message || (response.status === 429
      ? "Too many submissions right now. Your review is still here. Please wait a few minutes before trying again."
      : "Your review could not be published. Your text is still here. Please check the form and try again."));
  }
  if (typeof payload !== "object" || payload === null || !("course" in payload) || !("professor" in payload)) throw new Error(uncertainSubmissionMessage);
  const { course, professor } = payload;
  if (typeof course !== "object" || course === null || !("id" in course) || typeof course.id !== "string" || !("code" in course) || typeof course.code !== "string" || !("title" in course) || typeof course.title !== "string"
    || typeof professor !== "object" || professor === null || !("id" in professor) || typeof professor.id !== "string" || !("name" in professor) || typeof professor.name !== "string") throw new Error(uncertainSubmissionMessage);
  return { message: "Your anonymous review is live.", course: { id: course.id, code: course.code, title: course.title }, professor: { id: professor.id, name: professor.name } };
}
