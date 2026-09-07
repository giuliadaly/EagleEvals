import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return (
    <>
      <SiteHeader showSearch={false} />
      <main className="min-h-screen bg-[var(--paper)]" aria-label="Loading page" aria-busy="true">
        <div className="page-shell animate-pulse py-14"><div className="h-3 w-32 bg-[var(--line)]" /><div className="mt-5 h-12 max-w-2xl bg-[var(--line)]" /><div className="mt-10 grid gap-x-10 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="border-b border-[var(--line)] py-8"><div className="h-5 w-2/3 bg-[var(--line)]/70" /><div className="mt-3 h-3 w-1/2 bg-[var(--line)]/50" /></div>)}</div></div>
      </main>
    </>
  );
}
