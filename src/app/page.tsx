export default function Home() {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[var(--navy)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(202,167,92,0.22),transparent_34%),radial-gradient(circle_at_84%_82%,rgba(71,112,145,0.28),transparent_38%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/15 pb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full border border-[var(--gold)]/70 bg-white/5 text-lg font-bold text-[var(--gold)]">
              E
            </span>
            <span className="text-xl font-semibold tracking-tight">EagleEvals</span>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium tracking-wide text-white/70">
            Built for BC students
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20 sm:py-28">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">
            The student resource is returning
          </p>
          <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl">
            Find the right course. Learn from students who took it.
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-white/68 sm:text-xl">
            We are restoring EagleEval&apos;s course and professor evaluations in
            a new, reliable home. The historical data is being preserved now,
            and search will return as soon as the migration is complete.
          </p>

          <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/[0.065] p-6 backdrop-blur-sm">
              <p className="text-sm font-semibold text-[var(--gold)]">Courses</p>
              <p className="mt-2 text-lg font-medium">Compare classes and sections</p>
              <p className="mt-2 text-sm leading-6 text-white/58">
                Review workload, overall experience, and instructor options.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.065] p-6 backdrop-blur-sm">
              <p className="text-sm font-semibold text-[var(--gold)]">Professors</p>
              <p className="mt-2 text-lg font-medium">See the complete picture</p>
              <p className="mt-2 text-sm leading-6 text-white/58">
                Browse historical evaluations across courses and semesters.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/15 pt-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Independent and student-run.</p>
          <p>Not officially affiliated with Boston College.</p>
        </footer>
      </div>
    </main>
  );
}
