import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page-shell flex min-h-[34rem] flex-1 items-center justify-center py-16 text-center">
        <div><p className="eyebrow text-[var(--gold-dark)]">404 · Not found</p><h1 className="mt-3 font-serif text-5xl font-bold tracking-[-0.04em] text-[var(--navy)]">That page is not in the archive.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--muted)]">The record may not have been recovered, or the address may be incorrect. Search the archive or return home.</p><div className="mt-7 flex justify-center gap-3"><Link className="button-primary" href="/search">Search</Link><Link className="button-secondary" href="/">Home</Link></div></div>
      </main>
      <SiteFooter />
    </>
  );
}
