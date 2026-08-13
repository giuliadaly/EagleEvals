export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--cream)]">
      <div className="h-16 border-b border-[var(--line)] bg-white" />
      <div className="page-shell animate-pulse py-14"><div className="h-3 w-32 rounded bg-[var(--line)]" /><div className="mt-5 h-12 max-w-2xl rounded-xl bg-[var(--line)]" /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-56 rounded-2xl bg-[var(--line)]/70" />)}</div></div>
    </main>
  );
}
