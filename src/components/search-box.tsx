"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { BookIcon, PersonIcon, SearchIcon } from "@/components/icons";

type QuickCourse = { id: string; code: string; title: string; subject: string };
type QuickProfessor = { id: string; name: string; title: string | null };
type QuickResults = { courses: QuickCourse[]; professors: QuickProfessor[] };

export function SearchBox({ compact = false, autoFocus = false }: { compact?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickResults>({ courses: [], professors: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="relative w-full">
      <form onSubmit={submit} role="search" className="relative">
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
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${listId}-results`}
          aria-expanded={showPanel}
          placeholder="Search a course, code, subject, or professor"
          className={`w-full border bg-white text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--gold-dark)] focus:ring-4 focus:ring-[var(--gold)]/18 ${compact ? "h-10 rounded-xl pl-11 pr-4 text-sm" : "h-16 rounded-2xl pl-13 pr-28 text-base sm:text-lg"}`}
        />
        {!compact ? (
          <button type="submit" className="absolute right-2 top-2 h-12 rounded-xl bg-[var(--gold)] px-5 text-sm font-bold text-[var(--navy)] transition hover:bg-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Search
          </button>
        ) : null}
      </form>

      {showPanel ? (
        <div id={`${listId}-results`} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-2 text-left shadow-2xl shadow-[var(--navy)]/14">
          {loading && !hasResults ? <p className="px-4 py-5 text-sm text-[var(--muted)]">Searching…</p> : null}
          {!loading && !hasResults ? <p className="px-4 py-5 text-sm text-[var(--muted)]">No matching courses or professors found.</p> : null}
          {results.courses.length > 0 ? (
            <div>
              <p className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Courses</p>
              {results.courses.map((course) => (
                <Link key={course.id} role="option" aria-selected="false" href={`/courses/${course.id}`} className="result-row" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(false)}>
                  <span className="result-icon"><BookIcon className="size-4" /></span>
                  <span className="min-w-0"><strong className="block truncate text-sm text-[var(--ink)]">{course.code} · {course.title}</strong><span className="block truncate text-xs text-[var(--muted)]">{course.subject}</span></span>
                </Link>
              ))}
            </div>
          ) : null}
          {results.professors.length > 0 ? (
            <div className={results.courses.length ? "mt-2 border-t border-[var(--line)] pt-2" : ""}>
              <p className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Professors</p>
              {results.professors.map((professor) => (
                <Link key={professor.id} role="option" aria-selected="false" href={`/professors/${professor.id}`} className="result-row" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(false)}>
                  <span className="result-icon"><PersonIcon className="size-4" /></span>
                  <span className="min-w-0"><strong className="block truncate text-sm text-[var(--ink)]">{professor.name}</strong>{professor.title ? <span className="block truncate text-xs text-[var(--muted)]">{professor.title}</span> : null}</span>
                </Link>
              ))}
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
