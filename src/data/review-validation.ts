export const reviewRatingFields = [
  "courseOverall",
  "instructorOverall",
  "attendanceNecessary",
  "availableForHelp",
  "courseChallenge",
  "courseOrganization",
  "clearExplanations",
  "instructorPrepared",
  "stimulatedInterest",
  "assignmentsHelpful",
  "weeklyEffort",
] as const;

export type ReviewRatingField = (typeof reviewRatingFields)[number];

export type AnonymousReviewSubmission = Record<ReviewRatingField, number> & {
  courseId: string;
  professorId: string;
  semester: string;
  section: number;
  message: string;
  wouldTakeAgain: boolean;
  firsthandConfirmed: true;
  guidelinesAccepted: true;
};

type ValidationResult =
  | { ok: true; data: AnonymousReviewSubmission }
  | { ok: false; message: string };

const objectIdPattern = /^[0-9a-f]{24}$/;
const semesterPattern = /^(Spring|Summer|Fall) (20\d{2})$/;
const contactOrLinkPattern = /(?:https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeReviewMessage(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function validateReviewSubmission(value: unknown, currentYear = new Date().getUTCFullYear()): ValidationResult {
  if (!isObject(value)) return { ok: false, message: "The review could not be read." };
  if (String(value.website ?? "").trim()) return { ok: false, message: "The review could not be submitted." };

  const courseId = String(value.courseId ?? "");
  const professorId = String(value.professorId ?? "");
  if (!objectIdPattern.test(courseId) || !objectIdPattern.test(professorId)) {
    return { ok: false, message: "Choose a course and professor from the search results." };
  }

  const semester = String(value.semester ?? "").trim();
  const semesterMatch = semester.match(semesterPattern);
  const semesterYear = semesterMatch ? Number(semesterMatch[2]) : 0;
  if (!semesterMatch || semesterYear < 2000 || semesterYear > currentYear + 1) {
    return { ok: false, message: "Choose a valid semester." };
  }

  const section = Number(value.section);
  if (!Number.isInteger(section) || section < 1 || section > 99) {
    return { ok: false, message: "Section must be a whole number from 1 to 99." };
  }

  const ratings = {} as Record<ReviewRatingField, number>;
  for (const field of reviewRatingFields) {
    const rating = Number(value[field]);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, message: "Complete every rating using the 1–5 scale." };
    }
    ratings[field] = rating;
  }

  const message = normalizeReviewMessage(String(value.message ?? ""));
  if (message.length < 20 || message.length > 1000) {
    return { ok: false, message: "Write a comment between 20 and 1,000 characters." };
  }
  if (contactOrLinkPattern.test(message)) {
    return { ok: false, message: "Remove links, email addresses, and phone numbers before submitting." };
  }
  if (typeof value.wouldTakeAgain !== "boolean") {
    return { ok: false, message: "Choose whether you would take this professor again." };
  }
  if (value.firsthandConfirmed !== true || value.guidelinesAccepted !== true) {
    return { ok: false, message: "Confirm that this is your experience and that it follows the review guidelines." };
  }

  return {
    ok: true,
    data: {
      ...ratings,
      courseId,
      professorId,
      semester,
      section,
      message,
      wouldTakeAgain: value.wouldTakeAgain,
      firsthandConfirmed: true,
      guidelinesAccepted: true,
    },
  };
}
