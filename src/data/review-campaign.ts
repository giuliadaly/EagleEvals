export type ReviewCampaignCourse = {
  id: string;
  code: string;
  title: string;
  subject: string;
  reviewHref: string;
};

// Selection checked against the recovered catalog on October 14, 2026.
// Keep changing review counts in database queries, not this static copy.
const courses = [
  { id: "65c4299249939741c6777dbf", code: "ACCT1021", title: "Financial Accounting", subject: "Accounting" },
  { id: "65c4299249939741c6777da0", code: "MFIN1021", title: "Fundamentals of Finance", subject: "Finance" },
  { id: "65c4299249939741c6777d9c", code: "MKTG1021", title: "Marketing Principles", subject: "Marketing" },
  { id: "65c4299349939741c6778180", code: "CSCI1101", title: "Computer Science I", subject: "Computer Science" },
  { id: "65c4299249939741c6778168", code: "MATH1100", title: "Calculus I", subject: "Mathematics" },
  { id: "65c4299449939741c67788fe", code: "BIOL2040", title: "Investigations in Molecular Cell Biology Lab", subject: "Biology" },
  { id: "65c429aa49939741c677d9e2", code: "CHEM1110", title: "General Chemistry II", subject: "Chemistry" },
  { id: "65c4299649939741c677904c", code: "ECON2228", title: "Econometric Methods", subject: "Economics" },
  { id: "65c4299149939741c6777cc2", code: "ENGL1010", title: "First Year Writing Seminar", subject: "English" },
  { id: "65c4299249939741c67780f7", code: "PHIL1071", title: "Philosophy of the Person II", subject: "Philosophy" },
  { id: "65c4299149939741c6777c20", code: "HIST1001", title: "Europe in the World 1", subject: "History" },
  { id: "65c429ad49939741c677e634", code: "NURS2231", title: "Adult Health Nursing I Clinical Laboratory", subject: "Nursing" },
] as const;

export const reviewCampaignCourses: readonly ReviewCampaignCourse[] = courses.map(course => ({
  ...course,
  reviewHref: `/review?course=${course.id}`,
}));

export const reviewCampaignCopy = {
  eyebrow: "A little advice, passed on.",
  title: "Help the next person choose a class.",
  intro: "Choose a class you’ve taken. Select your professor and semester, add two overall ratings, and write a short review. Detailed ratings are optional.",
  privacy: "No account needed. Reviews appear without a name.",
  courseListHeading: "Start with a class you know",
  otherCourseLabel: "Find another class",
  otherCourseHref: "/review",
  prompts: [
    "What did the workload actually look like?",
    "What helped you prepare for exams or assignments?",
    "What would you tell a friend before they register?",
  ],
  semesterNote: "An older class counts, too. Choose the semester you took it so the next student has that context.",
} as const;
