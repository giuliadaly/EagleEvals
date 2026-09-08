import type { StudentComment } from "./types";

export type ReviewSort = "newest" | "oldest" | "term";

export function browseReviews(comments: StudentComment[], context: "course" | "professor", selected: string, sort: ReviewSort): StudentComment[] {
  return comments.filter(comment => !selected || (context === "course" ? comment.professorId : comment.courseId ?? "general") === selected)
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
