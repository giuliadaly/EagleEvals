"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./showcase.module.css";

type Concept = "stack" | "desk" | "guide";
type SortMode = "instructor" | "course" | "evidence" | "name";
type RatingFloor = "any" | "4.5" | "4.8";
type EvidenceFloor = "any" | "5" | "10";
type RecencyMode = "all" | "2023";

type Professor = {
  id: string;
  name: string;
  title: string;
  instructorRating: number;
  courseRating: number;
  evaluationCount: number;
  newestSemester: string;
  newestYear: number;
};

const professors: Professor[] = [
  { id: "65c42b5649939741c67ca65b", name: "Megan Bowman Arndt", title: "Part Time Faculty, English", instructorRating: 4.9, courseRating: 4.8, evaluationCount: 2, newestSemester: "Fall 2024", newestYear: 2024 },
  { id: "65c42b5649939741c67ca739", name: "Robert Stanton", title: "Associate Professor, English", instructorRating: 4.8, courseRating: 4.6, evaluationCount: 2, newestSemester: "Spring 2023", newestYear: 2023 },
  { id: "65c42b5749939741c67caa2b", name: "Lorenzo Puente", title: "Associate Professor of the Practice, English", instructorRating: 4.8, courseRating: 4.5, evaluationCount: 7, newestSemester: "Spring 2025", newestYear: 2025 },
  { id: "65c42b5649939741c67ca71e", name: "Lori Harrison-Kahan", title: "Professor of the Practice, English", instructorRating: 4.8, courseRating: 4.4, evaluationCount: 5, newestSemester: "Spring 2021", newestYear: 2021 },
  { id: "65c42b5649939741c67ca725", name: "Thomas Kaplan-Maxfield", title: "Associate Professor of the Practice, English", instructorRating: 4.4, courseRating: 4.2, evaluationCount: 17, newestSemester: "Spring 2025", newestYear: 2025 },
  { id: "65c42b5749939741c67caa2d", name: "Joseph Nugent", title: "English", instructorRating: 4.3, courseRating: 4.1, evaluationCount: 9, newestSemester: "Spring 2025", newestYear: 2025 },
  { id: "65c42b5649939741c67ca723", name: "Bonnie Rudner", title: "English", instructorRating: 4.4, courseRating: 4.1, evaluationCount: 8, newestSemester: "Spring 2024", newestYear: 2024 },
  { id: "65c42b5649939741c67ca650", name: "Christopher Boucher", title: "English", instructorRating: 4.2, courseRating: 3.8, evaluationCount: 7, newestSemester: "Spring 2025", newestYear: 2025 },
];

const conceptLabels: Record<Concept, { name: string; description: string }> = {
  stack: { name: "Professor Stack", description: "Swipe, scan, and save a short list." },
  desk: { name: "Decision Desk", description: "Filter a dense comparison workspace." },
  guide: { name: "Heights Guide", description: "Read the evidence like a field guide." },
};

function Icon({ name }: { name: "search" | "arrow-left" | "arrow-right" | "compare" | "check" }) {
  if (name === "search") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  }
  if (name === "arrow-left") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 5-7 7 7 7" /></svg>;
  }
  if (name === "arrow-right") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9.5 5 7 7-7 7" /></svg>;
  }
  if (name === "check") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7" /></svg>;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5H4v14h4M16 5h4v14h-4M9 8h6M9 12h6M9 16h6" /></svg>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={styles.brand} aria-label="EagleEvals">
      <span className={styles.brandMark} aria-hidden="true">EE</span>
      {!compact && <span className={styles.brandName}>EagleEvals</span>}
    </div>
  );
}

function SearchField({ query, setQuery, id }: { query: string; setQuery: (value: string) => void; id: string }) {
  return (
    <div className={styles.searchField}>
      <label htmlFor={id}>Find a professor in this course</label>
      <div className={styles.searchControl}>
        <Icon name="search" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try Megan or Stanton"
        />
      </div>
      <span className={styles.fieldHelper}>The prototype filters the verified instructor list below.</span>
    </div>
  );
}

type FilterControlsProps = {
  id: string;
  sortMode: SortMode;
  setSortMode: (value: SortMode) => void;
  ratingFloor: RatingFloor;
  setRatingFloor: (value: RatingFloor) => void;
  evidenceFloor: EvidenceFloor;
  setEvidenceFloor: (value: EvidenceFloor) => void;
  recencyMode: RecencyMode;
  setRecencyMode: (value: RecencyMode) => void;
};

function FilterControls({ id, sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode }: FilterControlsProps) {
  return (
    <div className={styles.filterControls} aria-label="Instructor filters">
      <label htmlFor={`${id}-sort`}><span>Sort by</span><select id={`${id}-sort`} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="instructor">Instructor rating</option><option value="course">Course rating</option><option value="evidence">Most evidence</option><option value="name">Professor name</option></select></label>
      <label htmlFor={`${id}-rating`}><span>Minimum instructor rating</span><select id={`${id}-rating`} value={ratingFloor} onChange={(event) => setRatingFloor(event.target.value as RatingFloor)}><option value="any">Any rating</option><option value="4.5">4.5 or higher</option><option value="4.8">4.8 or higher</option></select></label>
      <label htmlFor={`${id}-evidence`}><span>Evidence</span><select id={`${id}-evidence`} value={evidenceFloor} onChange={(event) => setEvidenceFloor(event.target.value as EvidenceFloor)}><option value="any">Any count</option><option value="5">5+ evaluations</option><option value="10">10+ evaluations</option></select></label>
      <label htmlFor={`${id}-recency`}><span>Recency</span><select id={`${id}-recency`} value={recencyMode} onChange={(event) => setRecencyMode(event.target.value as RecencyMode)}><option value="all">All recovered years</option><option value="2023">Evaluated since 2023</option></select></label>
      <p className={styles.sourceStatus}><span aria-hidden="true" />Source: recovered EagleEval archive · through Spring 2025</p>
    </div>
  );
}

function CourseFacts({ compact = false }: { compact?: boolean }) {
  return (
    <dl className={compact ? styles.courseFactsCompact : styles.courseFacts}>
      <div><dt>Course</dt><dd>4.0<span>/5</span></dd></div>
      <div><dt>Evaluations</dt><dd>275</dd></div>
      <div><dt>Instructors</dt><dd>60</dd></div>
      <div><dt>Comments</dt><dd>15</dd></div>
    </dl>
  );
}

function CompareButton({ professor, selected, disabled, toggle }: { professor: Professor; selected: boolean; disabled: boolean; toggle: (id: string) => void }) {
  return (
    <button
      type="button"
      className={selected ? styles.compareButtonSelected : styles.compareButton}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => toggle(professor.id)}
    >
      <Icon name={selected ? "check" : "compare"} />
      {selected ? "Saved" : disabled ? "Limit reached" : "Compare"}
    </button>
  );
}

function EmptyResult({ clear }: { clear: () => void }) {
  return (
    <div className={styles.emptyResult} role="status">
      <div className={styles.emptyMark} aria-hidden="true"><Icon name="search" /></div>
      <p><strong>No professor matches those filters.</strong> Try a lower threshold or clear the filters.</p>
      <button type="button" onClick={clear}>Clear filters</button>
    </div>
  );
}

function CompareTray({ selected, onClear, onOpen }: { selected: Professor[]; onClear: () => void; onOpen: () => void }) {
  if (selected.length === 0) return null;
  return (
    <aside className={styles.compareTray} aria-live="polite">
      <div>
        <span className={styles.compareCount}>{selected.length}</span>
        <p><strong>{selected.length === 1 ? "Professor saved" : "Professors saved"}</strong><span>{selected.map((item) => item.name.split(" ").at(-1)).join(" · ")}</span></p>
      </div>
      <div className={styles.compareTrayActions}>
        <button type="button" className={styles.clearButton} onClick={onClear}>Clear</button>
        <button type="button" className={styles.primaryButton} onClick={onOpen}>Compare now</button>
      </div>
    </aside>
  );
}

function CompareDialog({ open, selected, onClose }: { open: boolean; selected: Professor[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className={styles.compareDialog} aria-labelledby="compare-dialog-title" onClose={onClose} onCancel={onClose}>
      <div className={styles.dialogHeading}>
        <div><h2 id="compare-dialog-title">Saved professor comparison</h2><p>ENGL1080 · historical scores out of 5</p></div>
        <button type="button" onClick={onClose} aria-label="Close comparison">Close</button>
      </div>
      <div className={styles.dialogRows}>
        {selected.map((professor) => (
          <article key={professor.id}>
            <div><h3>{professor.name}</h3><p>{professor.title}</p></div>
            <dl><div><dt>Instructor</dt><dd>{professor.instructorRating.toFixed(1)}</dd></div><div><dt>Course</dt><dd>{professor.courseRating.toFixed(1)}</dd></div><div><dt>Evidence</dt><dd>{professor.evaluationCount}</dd></div></dl>
          </article>
        ))}
      </div>
    </dialog>
  );
}

function ConceptSwitcher({ active, setActive }: { active: Concept; setActive: (concept: Concept) => void }) {
  return (
    <section className={styles.switcher} aria-labelledby="showcase-title">
      <div className={styles.switcherCopy}>
        <p id="showcase-title">Three responsive directions</p>
        <span>{conceptLabels[active].description}</span>
      </div>
      <nav className={styles.switcherTabs} aria-label="Choose a redesign concept">
        {(Object.keys(conceptLabels) as Concept[]).map((concept) => (
          <button
            key={concept}
            type="button"
            aria-pressed={active === concept}
            className={active === concept ? styles.switcherTabActive : styles.switcherTab}
            onClick={() => setActive(concept)}
          >
            {conceptLabels[concept].name.replace("Professor ", "").replace("Decision ", "").replace("Heights ", "")}
          </button>
        ))}
      </nav>
    </section>
  );
}

function StackConcept({ items, selectedIds, toggle, query, setQuery, clearFilters, sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode }: ConceptProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-professor-card]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left: rail.scrollLeft + direction * ((card?.offsetWidth ?? 304) + 16), behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div className={`${styles.concept} ${styles.stackConcept}`}>
      <header className={styles.stackNav}>
        <Brand />
        <nav aria-label="Primary"><Link href="/courses">Courses</Link><Link href="/professors">Professors</Link></nav>
        <Link className={styles.navReviewLink} href="/review">Write a review</Link>
      </header>
      <main>
        <section className={styles.stackHero}>
          <div className={styles.stackHeroCopy}>
            <p>ENGL1080 · Literature Core</p>
            <h1>Find the professor who fits how you learn.</h1>
            <span>Start with the strongest comparable signal, then save the people you want to examine side by side.</span>
          </div>
          <CourseFacts compact />
        </section>

        <section className={styles.stackBrowse} aria-labelledby="stack-heading">
          <div className={styles.stackTools}>
            <div>
              <h2 id="stack-heading">Browse evaluated instructors</h2>
              <p>{items.length} shown from 60 instructors with historical evaluations.</p>
            </div>
            <div className={styles.arrowControls}>
              <button type="button" onClick={() => move(-1)} aria-label="Previous professor"><Icon name="arrow-left" /></button>
              <button type="button" onClick={() => move(1)} aria-label="Next professor"><Icon name="arrow-right" /></button>
            </div>
          </div>
          <SearchField id="stack-search" query={query} setQuery={setQuery} />
          <FilterControls id="stack" {...filterControlProps({ sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode })} />
          {items.length ? (
            <div className={styles.professorRail} ref={railRef} aria-label="Professor cards">
              {items.map((professor) => (
                <article className={styles.professorCard} key={professor.id} data-professor-card>
                  <div className={styles.cardTopline}><span>ENGL1080</span><span>Historical evaluation</span></div>
                  <div className={styles.avatar} aria-hidden="true">{professor.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                  <h3>{professor.name}</h3>
                  <p className={styles.professorTitle}>{professor.title}</p>
                  <p className={styles.evidenceLine}>{professor.evaluationCount} ENGL1080 evaluations · through {professor.newestSemester}</p>
                  <dl className={styles.cardRatings}>
                    <div><dt>Instructor</dt><dd>{professor.instructorRating.toFixed(1)}</dd></div>
                    <div><dt>Course</dt><dd>{professor.courseRating.toFixed(1)}</dd></div>
                  </dl>
                  <div className={styles.cardFooter}>
                    <Link className={styles.profileLink} href={`/professors/${professor.id}`}>Read reviews</Link>
                    <CompareButton professor={professor} selected={selectedIds.has(professor.id)} disabled={!selectedIds.has(professor.id) && selectedIds.size >= 4} toggle={toggle} />
                  </div>
                </article>
              ))}
              <div className={styles.railEnd} aria-hidden="true"><span>60</span><p>evaluated instructors total</p></div>
            </div>
          ) : <EmptyResult clear={clearFilters} />}
          <p className={styles.swipeHint}>Swipe the cards or use the arrow controls. The next card stays visible as a cue.</p>
        </section>
      </main>
      <footer className={styles.stackFooter}><Brand compact /><p>Independent and student-run. Not affiliated with Boston College.</p></footer>
    </div>
  );
}

type ConceptProps = {
  items: Professor[];
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;
  clearFilters: () => void;
} & Omit<FilterControlsProps, "id">;

function filterControlProps(props: Omit<FilterControlsProps, "id">): Omit<FilterControlsProps, "id"> {
  return props;
}

function DeskConcept({ items, selectedIds, toggle, query, setQuery, clearFilters, sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode }: ConceptProps) {
  return (
    <div className={`${styles.concept} ${styles.deskConcept}`}>
      <header className={styles.deskNav}>
        <Brand />
        <div className={styles.deskNavMeta}><span>Registration workspace</span><Link href="/review">Write a review</Link></div>
      </header>
      <main className={styles.deskShell}>
        <section className={styles.deskIntro}>
          <div><p>ENGL1080</p><h1>Literature Core</h1><span>Compare the historical evidence without opening 60 profiles.</span></div>
          <CourseFacts compact />
        </section>
        <div className={styles.deskWorkspace}>
          <aside className={styles.filterPanel} aria-label="Professor filters">
            <h2>Narrow the list</h2>
            <SearchField id="desk-search" query={query} setQuery={setQuery} />
            <FilterControls id="desk" {...filterControlProps({ sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode })} />
            <div className={styles.filterNote}>
              <strong>What you can trust here</strong>
              <p>Every number in this prototype comes from the recovered historical course record.</p>
            </div>
          </aside>
          <section className={styles.tablePanel} aria-labelledby="desk-heading">
            <div className={styles.tableHeading}><div><h2 id="desk-heading">Instructor comparison</h2><p>{items.length} matching instructors</p></div><span>Use ratings and evidence together</span></div>
            {items.length ? (
              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th scope="col">Professor</th><th scope="col">Instructor</th><th scope="col">Course</th><th scope="col">Evidence</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead>
                  <tbody>
                    {items.map((professor) => (
                      <tr key={professor.id}>
                        <th scope="row" data-label="Professor"><strong>{professor.name}</strong><span>{professor.title}</span></th>
                        <td data-label="Instructor"><strong>{professor.instructorRating.toFixed(1)}</strong><span>out of 5</span></td>
                        <td data-label="Course"><strong>{professor.courseRating.toFixed(1)}</strong><span>out of 5</span></td>
                        <td data-label="Evidence"><strong>{professor.evaluationCount}</strong><span>through {professor.newestSemester}</span></td>
                        <td data-label="Actions"><div className={styles.rowActions}><Link className={styles.profileLink} href={`/professors/${professor.id}`}>Read reviews</Link><CompareButton professor={professor} selected={selectedIds.has(professor.id)} disabled={!selectedIds.has(professor.id) && selectedIds.size >= 4} toggle={toggle} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyResult clear={clearFilters} />}
          </section>
        </div>
      </main>
      <footer className={styles.deskFooter}><span>EagleEvals · independent and student-run</span><span>Recovered evidence. Anonymous new reviews.</span></footer>
    </div>
  );
}

function GuideConcept({ items, selectedIds, toggle, query, setQuery, clearFilters, sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode }: ConceptProps) {
  return (
    <div className={`${styles.concept} ${styles.guideConcept}`}>
      <header className={styles.guideMasthead}>
        <div className={styles.guideRule}><span>Course planning for Boston College students</span><span>Independent · student-run</span></div>
        <Brand />
        <nav aria-label="Primary"><Link href="/courses">Courses</Link><Link href="/professors">Professors</Link><Link href="/review">Write review</Link></nav>
      </header>
      <main className={styles.guideShell}>
        <section className={styles.guideIntro}>
          <div>
            <p>ENGL1080 · Literature Core</p>
            <h1>A clearer read on the class before registration.</h1>
            <span>Use the course pattern for context, then compare professor ratings instead of choosing from a wall of names.</span>
          </div>
          <div className={styles.guideLeadScore}><span>Course average</span><strong>4.0</strong><small>out of 5 · 275 evaluations</small></div>
        </section>
        <section className={styles.evidenceBand} aria-label="Course evidence">
          <div><span>Organization</span><strong>Strong structure</strong><small>4.4 / 5</small></div>
          <div><span>Challenge</span><strong>High challenge</strong><small>4.3 / 5</small></div>
          <div><span>Attendance</span><strong>Usually matters</strong><small>4.4 / 5 necessary</small></div>
          <div><span>Assignments</span><strong>Usually helpful</strong><small>4.3 / 5</small></div>
          <div><span>Weekly effort</span><strong>About 4h</strong><small>per week</small></div>
        </section>
        <section className={styles.guideIndex} aria-labelledby="guide-heading">
          <div className={styles.guideIndexIntro}>
            <h2 id="guide-heading">Professor index</h2>
            <p>Ratings answer one question, not every question. Save a short list, then open the underlying reviews before deciding.</p>
            <SearchField id="guide-search" query={query} setQuery={setQuery} />
            <FilterControls id="guide" {...filterControlProps({ sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode })} />
          </div>
          <div className={styles.guideRows}>
            {items.length ? items.map((professor, index) => (
              <article key={professor.id} className={styles.guideRow}>
                <span className={styles.guidePosition}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.guidePerson}><h3>{professor.name}</h3><p>{professor.title}</p><span>{professor.evaluationCount} evaluations · through {professor.newestSemester}</span></div>
                <dl><div><dt>Instructor</dt><dd>{professor.instructorRating.toFixed(1)}</dd></div><div><dt>Course</dt><dd>{professor.courseRating.toFixed(1)}</dd></div></dl>
                <div className={styles.guideActions}><Link className={styles.profileLink} href={`/professors/${professor.id}`}>Read reviews</Link><CompareButton professor={professor} selected={selectedIds.has(professor.id)} disabled={!selectedIds.has(professor.id) && selectedIds.size >= 4} toggle={toggle} /></div>
              </article>
            )) : <EmptyResult clear={clearFilters} />}
          </div>
        </section>
      </main>
      <footer className={styles.guideFooter}><p>EagleEvals preserves the public evaluation archive and accepts new anonymous reviews.</p><span>Not affiliated with Boston College.</span></footer>
    </div>
  );
}

export default function ShowcaseClient({ initialConcept }: { initialConcept: Concept }) {
  const [activeConcept, setActiveConcept] = useState<Concept>(initialConcept);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("instructor");
  const [ratingFloor, setRatingFloor] = useState<RatingFloor>("any");
  const [evidenceFloor, setEvidenceFloor] = useState<EvidenceFloor>("any");
  const [recencyMode, setRecencyMode] = useState<RecencyMode>("all");
  const [compareOpen, setCompareOpen] = useState(false);

  const filteredProfessors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const searched = normalized
      ? professors.filter((professor) => professor.name.toLowerCase().includes(normalized))
      : professors;
    const ratingMinimum = ratingFloor === "any" ? 0 : Number(ratingFloor);
    const evidenceMinimum = evidenceFloor === "any" ? 0 : Number(evidenceFloor);
    const filtered = searched.filter((professor) => professor.instructorRating >= ratingMinimum && professor.evaluationCount >= evidenceMinimum && (recencyMode === "all" || professor.newestYear >= 2023));
    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "course") return b.courseRating - a.courseRating;
      if (sortMode === "evidence") return b.evaluationCount - a.evaluationCount || b.instructorRating - a.instructorRating;
      return b.instructorRating - a.instructorRating || b.courseRating - a.courseRating;
    });
  }, [query, sortMode, ratingFloor, evidenceFloor, recencyMode]);

  const selected = professors.filter((professor) => selectedIds.has(professor.id));
  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };
  const clearFilters = () => {
    setQuery("");
    setRatingFloor("any");
    setEvidenceFloor("any");
    setRecencyMode("all");
  };
  const props = { items: filteredProfessors, selectedIds, toggle, query, setQuery, clearFilters, sortMode, setSortMode, ratingFloor, setRatingFloor, evidenceFloor, setEvidenceFloor, recencyMode, setRecencyMode };

  return (
    <div className={styles.showcaseRoot}>
      <ConceptSwitcher active={activeConcept} setActive={(concept) => {
        setActiveConcept(concept);
        setQuery("");
        window.history.replaceState(null, "", `/showcase?concept=${concept}`);
      }} />
      <div aria-label={conceptLabels[activeConcept].name}>
        {activeConcept === "stack" && <StackConcept {...props} />}
        {activeConcept === "desk" && <DeskConcept {...props} />}
        {activeConcept === "guide" && <GuideConcept {...props} />}
      </div>
      <CompareTray selected={selected} onClear={() => { setSelectedIds(new Set()); setCompareOpen(false); }} onOpen={() => setCompareOpen(true)} />
      <CompareDialog open={compareOpen} selected={selected} onClose={() => setCompareOpen(false)} />
    </div>
  );
}
