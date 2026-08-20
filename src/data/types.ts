export type SiteStats = {
  courses: number;
  professors: number;
  reviews: number;
  comments: number;
};

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  subject: string;
  college: string | null;
  description: string;
  reviewCount: number;
  courseOverall: number | null;
  instructorOverall: number | null;
  commentCount: number;
};

export type ProfessorSummary = {
  id: string;
  name: string;
  titles: string[];
  education: string[];
  phone: string | null;
  email: string | null;
  office: string | null;
  photoUrl: string | null;
  reviewCount: number;
  courseOverall: number | null;
  instructorOverall: number | null;
  commentCount: number;
};

export type SearchResults = {
  courses: CourseSummary[];
  professors: ProfessorSummary[];
};

export type MetricValue = {
  label: string;
  value: number | null;
  description?: string;
};

export type InstructorCourseRow = {
  id: string;
  name: string;
  titles: string[];
  reviewCount: number;
  courseOverall: number | null;
  instructorOverall: number | null;
};

export type ProfessorCourseRow = {
  id: string;
  code: string;
  title: string;
  subject: string;
  reviewCount: number;
  courseOverall: number | null;
  instructorOverall: number | null;
};

export type StudentComment = {
  id: string;
  message: string;
  wouldTakeAgain: boolean;
  createdAt: string;
  professorId: string;
  professorName: string;
  courseId: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  source: string;
};

export type EvaluationRecord = {
  id: string;
  semester: string;
  section: number;
  sectionCode: string;
  courseOverall: number | null;
  instructorOverall: number | null;
  courseId: string | null;
  courseCode: string;
  courseTitle: string | null;
  professorId: string | null;
  professorName: string;
  source: string;
  submittedAt: string | null;
  metrics: MetricValue[];
};

export type ReviewSelection = {
  id: string;
  primary: string;
  secondary: string;
};

export type SemesterSummary = {
  semester: string;
  reviewCount: number;
  courseOverall: number | null;
  instructorOverall: number | null;
};

export type CourseDetail = {
  course: CourseSummary;
  metrics: MetricValue[];
  estimatedWeeklyHours: number | null;
  instructors: InstructorCourseRow[];
  comments: StudentComment[];
  semesters: SemesterSummary[];
};

export type ProfessorDetail = {
  professor: ProfessorSummary;
  metrics: MetricValue[];
  courses: ProfessorCourseRow[];
  comments: StudentComment[];
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  query: string;
};
