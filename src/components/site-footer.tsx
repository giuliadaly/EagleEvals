import Link from "next/link";
import { Brand } from "@/components/site-header";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-[var(--navy)] text-white">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand light />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/58">
            Recovered historical course and professor evaluations, rebuilt as an independent resource for Boston College students.
          </p>
        </div>
        <div>
          <p className="eyebrow text-[var(--gold)]">Explore</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-white/72">
            <Link className="footer-link" href="/courses">Browse courses</Link>
            <Link className="footer-link" href="/professors">Browse professors</Link>
            <Link className="footer-link" href="/evaluations">Browse all evaluations</Link>
            <Link className="footer-link" href="/comments">Browse written reviews</Link>
            <Link className="footer-link" href="/review">Write an anonymous review</Link>
          </div>
        </div>
        <div>
          <p className="eyebrow text-[var(--gold)]">Project</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-white/72">
            <Link className="footer-link" href="/about">About the recovery</Link>
            <Link className="footer-link" href="/privacy">Privacy</Link>
            <Link className="footer-link" href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-2 py-5 text-xs text-white/42 sm:flex-row sm:items-center sm:justify-between">
          <p>Independent and student-run.</p>
          <p>Not officially affiliated with Boston College.</p>
        </div>
      </div>
    </footer>
  );
}
