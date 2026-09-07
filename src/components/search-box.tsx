"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { BookIcon, PersonIcon, SearchIcon } from "@/components/icons";
import { formatWrittenReviewCount } from "@/data/format";
import styles from "./search-box.module.css";

type QuickCourse = { id: string; code: string; title: string; subject: string; commentCount: number };
type QuickProfessor = { id: string; name: string; title: string | null; commentCount: number };
type QuickResults = { courses: QuickCourse[]; professors: QuickProfessor[] };

export function SearchBox({ compact = false, autoFocus = false, hero = false }: { compact?: boolean; autoFocus?: boolean; hero?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickResults>({ courses: [], professors: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = (await response.json()) as QuickResults;
        setResults(payload);
        setActiveIndex(-1);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults({ courses: [], professors: [] });
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  const hasResults = results.courses.length > 0 || results.professors.length > 0;
  const showPanel = open && query.trim().length >= 2;
  const flatResults = [
    ...results.courses.map((course) => ({ href: `/courses/${course.id}` })),
    ...results.professors.map((professor) => ({ href: `/professors/${professor.id}` })),
  ];

  function moveActive(direction: 1 | -1) {
    if (!flatResults.length) return;
    setOpen(true);
    setActiveIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : flatResults.length - 1;
      return (current + direction + flatResults.length) % flatResults.length;
    });
  }

  return (
    <div className="relative w-full">
      <form onSubmit={submit} role="search" className={`relative ${hero ? styles.hero : ""}`}>
        <SearchIcon className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${compact ? "size-4" : "size-5"} text-[var(--muted)]`} />
        <label className="sr-only" htmlFor={listId}>Search courses and professors</label>
        <input
          id={listId}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              setOpen(false);
              setResults({ courses: [], professors: [] });
            }
            setActiveIndex(-1);
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActive(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActive(-1);
            } else if (event.key === "Enter" && showPanel && activeIndex >= 0) {
              event.preventDefault();
              const active = flatResults[activeIndex];
              if (active) {
                setOpen(false);
                router.push(active.href);
              }
            } else if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${listId}-results`}
          aria-expanded={showPanel}
          aria-activedescendant={showPanel && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          placeholder={hero ? "Course or professor" : compact ? "Course or professor" : "Search a course, code, subject, or professor"}
          className={`w-full border border-[var(--line-strong)] bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--maroon)] focus:ring-4 focus:ring-[var(--gold)]/18 ${compact ? "h-10 rounded-[.375rem] pl-11 pr-4 text-sm" : "h-16 rounded-[.375rem] pl-13 pr-28 text-base sm:text-lg"}`}
        />
        {!compact ? (
          <button type="submit" className="absolute right-2 top-2 h-12 rounded-[.375rem] bg-[var(--maroon-deep)] px-5 text-sm font-bold text-[var(--on-maroon)] transition hover:bg-[var(--maroon)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
            {hero ? <>Find out <span aria-hidden="true">↗</span></> : "Search"}
          </button>
        ) : null}
      </form>

      {showPanel ? (
        <div id={`${listId}-results`} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-2 text-left shadow-xl shadow-black/10">
          {loading && !hasResults ? <p className="px-4 py-5 text-sm text-[var(--muted)]">Searching…</p> : null}
          {!loading && !hasResults ? <p className="px-4 py-5 text-sm text-[var(--muted)]">No matching courses or professors found.</p> : null}
          {results.courses.length > 0 ? (
            <div>
              <p className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Courses</p>
              {results.courses.map((course, index) => (
                <Link key={course.id} id={`${listId}-option-${index}`} role="option" aria-selected={activeIndex === index} tabIndex={-1} href={`/courses/${course.id}`} className={`result-row ${activeIndex === index ? "bg-[var(--paper-ledger)]" : ""}`} onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(false)}>
                  <span className="result-icon"><BookIcon className="size-4" /></span>
                  <span className="min-w-0"><strong className="block truncate text-sm text-[var(--ink)]">{course.code} · {course.title}</strong><span className="block truncate text-xs text-[var(--muted)]">{course.subject} · {formatWrittenReviewCount(course.commentCount)}</span></span>
                </Link>
              ))}
            </div>
          ) : null}
          {results.professors.length > 0 ? (
            <div className={results.courses.length ? "mt-2 border-t border-[var(--line)] pt-2" : ""}>
              <p className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Professors</p>
              {results.professors.map((professor, index) => {
                const optionIndex = results.courses.length + index;
                return (
                <Link key={professor.id} id={`${listId}-option-${optionIndex}`} role="option" aria-selected={activeIndex === optionIndex} tabIndex={-1} href={`/professors/${professor.id}`} className={`result-row ${activeIndex === optionIndex ? "bg-[var(--paper-ledger)]" : ""}`} onMouseEnter={() => setActiveIndex(optionIndex)} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(false)}>
                  <span className="result-icon"><PersonIcon className="size-4" /></span>
                  <span className="min-w-0"><strong className="block truncate text-sm text-[var(--ink)]">{professor.name}</strong><span className="block truncate text-xs text-[var(--muted)]">{professor.title ?? "Boston College faculty"} · {formatWrittenReviewCount(professor.commentCount)}</span></span>
                </Link>
                );
              })}
            </div>
          ) : null}
          {hasResults ? (
            <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center rounded-xl bg-[var(--wash)] px-4 py-3 text-xs font-bold text-[var(--navy)] hover:bg-[var(--gold-pale)]">
              View all results
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="sr-only" aria-live="polite">{loading ? "Searching" : hasResults ? `${results.courses.length + results.professors.length} suggestions available` : ""}</div>
    </div>
  );
}
