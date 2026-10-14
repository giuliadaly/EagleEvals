"use client";

import { useEffect, useRef, useState } from "react";
import { DetailReview } from "@/components/detail-review";
import { formatCount } from "@/data/format";
import type { RmpReviewsPage, StudentComment } from "@/data/types";
import styles from "./detail-page.module.css";

type Props = {
  professor: { id: string; name: string } | null;
  course?: { id: string; code: string };
  context: "professor" | "course";
};

async function readPage(professorId: string, courseId: string | undefined, cursor: string | null, signal: AbortSignal): Promise<RmpReviewsPage> {
  const query = new URLSearchParams();
  if (courseId) query.set("course", courseId);
  if (cursor) query.set("after", cursor);
  const response = await fetch(`/api/professors/${professorId}/rmp-reviews?${query}`, { signal });
  if (!response.ok) throw new Error("Rate My Professors is temporarily unavailable. Try again in a moment.");
  return response.json();
}

function RmpReviewFeed({ professor, course, context }: Props & { professor: NonNullable<Props["professor"]> }) {
  const [data, setData] = useState<{ page: RmpReviewsPage; comments: StudentComment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const courseId = course?.id;

  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    readPage(professor.id, courseId, null, controller.signal).then(page => {
      if (!controller.signal.aborted) { setData({ page, comments: page.comments }); setLoading(false); }
    }).catch(() => {
      if (!controller.signal.aborted) { setError("Rate My Professors is temporarily unavailable. Try again in a moment."); setLoading(false); }
    });
    return () => { pending.current?.abort(); };
  }, [professor.id, courseId]);

  async function loadMore() {
    if (loading) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    try {
      const page = await readPage(professor.id, courseId, data?.page.endCursor ?? null, controller.signal);
      if (!controller.signal.aborted) {
        setData(previous => ({ page, comments: [...new Map([...(previous?.comments ?? []), ...page.comments].map(comment => [comment.id, comment])).values()] }));
      }
    } catch {
      if (!controller.signal.aborted) setError("Rate My Professors is temporarily unavailable. Try again in a moment.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const searchUrl = `https://www.ratemyprofessors.com/search/professors/122?q=${encodeURIComponent(professor.name)}`;
  return <section className={styles.externalReviews} aria-label="Rate My Professors reviews" aria-busy={loading}>
    <div className={styles.externalHeading}>
      <h3>From Rate My Professors</h3>
      <a href={data?.page.profile?.url ?? searchUrl} target="_blank" rel="noopener noreferrer">View source</a>
    </div>
    <p className={styles.caption}>A separate source of student feedback. These reviews don’t change EagleEvals scores.</p>
    {data?.page.status === "matched" ? <>
      <p className={styles.filterStatus}>{formatCount(data.comments.length)} written review{data.comments.length === 1 ? "" : "s"} loaded{course ? ` for ${course.code}` : ""} · {formatCount(data.page.profile?.ratingCount ?? 0)} RMP ratings across all courses</p>
      <div className={styles.reviewList}>{data.comments.map(comment => <DetailReview key={comment.id} comment={comment} context={context} />)}</div>
      {!data.comments.length && !data.page.hasNextPage ? <p className={styles.detailText}>No written RMP reviews{course ? ` for ${course.code}` : ""} were returned for this professor.</p> : null}
      {data.page.hasNextPage && !error ? <button className={styles.loadExternal} type="button" onClick={loadMore} disabled={loading}>{loading ? "Loading reviews…" : "Load more RMP reviews"}</button> : null}
    </> : data ? <p className={styles.detailText}>{data.page.status === "ambiguous" ? "More than one RMP profile matches this name." : "We couldn’t verify an RMP profile for this professor."} <a href={searchUrl} target="_blank" rel="noopener noreferrer">Search Rate My Professors</a>.</p> : null}
    {loading && !data ? <p className={styles.filterStatus} role="status">Loading reviews for {professor.name}…</p> : null}
    {error ? <div role="status"><p className={styles.detailText}>{error}</p><button className={styles.loadExternal} type="button" onClick={loadMore} disabled={loading}>{loading ? "Trying again…" : "Try again"}</button></div> : null}
  </section>;
}

export function RmpReviews(props: Props) {
  if (!props.professor) return <section className={styles.externalReviews} aria-label="Rate My Professors reviews"><h3>From Rate My Professors</h3><p className={styles.detailText}>Choose a professor above to load their RMP reviews for this course.</p></section>;
  return <RmpReviewFeed key={`${props.professor.id}-${props.course?.id ?? "all"}`} {...props} professor={props.professor} />;
}
