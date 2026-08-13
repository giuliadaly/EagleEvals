"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--navy)] px-6 text-center text-white">
      <div><p className="eyebrow text-[var(--gold)]">Something went wrong</p><h1 className="mt-3 font-serif text-4xl font-bold">The archive could not load this page.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/60">This may be temporary. Try the request again, or return to the homepage.</p><div className="mt-7 flex justify-center gap-3"><button onClick={reset} className="button-gold">Try again</button><Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm font-bold text-white hover:bg-white/10">Home</Link></div></div>
    </main>
  );
}
