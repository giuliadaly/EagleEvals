import type { StudentComment } from "./types";

export type ReviewSort = "newest" | "oldest" | "term";

export function reviewCourseKey(comment: StudentComment): string {
  return comment.courseId ?? (comment.courseCode ? `code:${comment.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "")}` : "general");
}

export function reviewProfessorHref(comment: StudentComment): string {
  return comment.professorId.startsWith("rmp:") ? `/comments?q=${encodeURIComponent(comment.professorName)}` : `/professors/${comment.professorId}`;
}

export function browseReviews(comments: StudentComment[], context: "course" | "professor", selected: string, sort: ReviewSort, text = ""): StudentComment[] {
  const words = text.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return comments.filter(comment => (!selected || (context === "course" ? comment.professorId : reviewCourseKey(comment)) === selected)
    && words.every(word => [comment.message, comment.professorName, comment.courseCode, comment.courseTitle, comment.contextNote].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase().includes(word)))
    .sort((a, b) => {
      if (sort === "term") {
        const termValue = (term: string | null) => {
          if (!term) return 0;
          const year = Number(term.match(/\d{4}/)?.[0] ?? 0);
          return year * 10 + (term.startsWith("Fall") ? 3 : term.startsWith("Summer") ? 2 : 1);
        };
        const difference = termValue(b.semester) - termValue(a.semester);
        if (difference) return difference;
      }
      const difference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return (sort === "oldest" ? -difference : difference) || a.id.localeCompare(b.id);
    });
}
