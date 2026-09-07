import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="page-intro">
          <div className="page-shell max-w-4xl">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
            <p className="eyebrow mt-8 text-[var(--gold-dark)]">{eyebrow}</p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">{intro}</p>
          </div>
        </section>
        <article className="info-prose page-shell max-w-4xl py-12 sm:py-16">{children}</article>
      </main>
      <SiteFooter />
    </>
  );
}
