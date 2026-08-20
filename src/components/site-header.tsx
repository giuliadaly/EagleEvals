import Link from "next/link";
import { EagleMark } from "@/components/eagle-mark";
import { SearchBox } from "@/components/search-box";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="EagleEvals home">
      <EagleMark className={`size-9 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 ${light ? "text-white" : "text-[var(--maroon-deep)]"}`} />
      <span className={`brand-word font-serif text-lg font-semibold tracking-[-0.03em] ${light ? "text-white" : "text-[var(--ink)]"}`}>
        Eagle<span className={light ? "text-[var(--gold-light)]" : "text-[var(--maroon)]"}>Evals</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line-strong)] bg-[var(--paper-raised)]/96 backdrop-blur-md">
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
          <Link className="nav-link hidden lg:inline-flex" href="/evaluations">Evaluations</Link>
          <Link className="button-gold ml-1 min-h-9 px-3 py-2" href="/review"><span className="sm:hidden">Review</span><span className="hidden sm:inline">Write review</span></Link>
        </nav>
      </div>
    </header>
  );
}
