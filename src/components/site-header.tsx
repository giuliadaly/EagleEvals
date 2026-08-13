import Link from "next/link";
import { SearchBox } from "@/components/search-box";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="EagleEvals home">
      <span className={`grid size-9 place-items-center rounded-full border-2 font-serif text-lg font-bold transition-transform group-hover:-rotate-6 ${light ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--navy)] text-[var(--navy)]"}`}>
        E
      </span>
      <span className={`brand-word text-lg font-bold tracking-[-0.025em] ${light ? "text-white" : "text-[var(--navy)]"}`}>
        Eagle<span className="text-[var(--gold-dark)]">Evals</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--cream)]/95 backdrop-blur-md">
      <div className="page-shell flex h-16 items-center gap-5">
        <Brand />
        {showSearch ? (
          <div className="hidden max-w-md flex-1 md:block">
            <SearchBox compact />
          </div>
        ) : null}
        <nav className="ml-auto flex items-center gap-1 text-sm font-semibold text-[var(--muted)]" aria-label="Primary navigation">
          <Link className="nav-link inline-flex" href="/courses">Courses</Link>
          <Link className="nav-link inline-flex" href="/professors">Professors</Link>
          <Link className="nav-link hidden sm:inline-flex" href="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}
