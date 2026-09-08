import type { Metadata } from "next";
import { AnonymousReviewForm } from "@/components/anonymous-review-form";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getReviewSelections } from "@/data/queries";

export const metadata: Metadata = { alternates: { canonical: "/review" },
  title: "Write an anonymous review",
  description: "Share a fully anonymous Boston College course and professor review.",
};

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ course?: string; professor?: string }> }) {
  const params = await searchParams;
  const selections = await getReviewSelections(params.course, params.professor);
  const year = new Date().getUTCFullYear();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="page-intro">
          <div className="page-shell">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Write a review" }]} />
            <p className="eyebrow mt-7 text-[var(--gold-dark)]">No account required</p>
            <h1 className="mt-3 max-w-4xl font-serif text-4xl font-bold tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">Leave a little advice.</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)]">Two ratings and a few words for the next student. Extra details are optional. Your review is anonymous, and you don’t need an account.</p>
          </div>
        </section>
        <div className="page-shell py-10 sm:py-14">
          <AnonymousReviewForm initialCourse={selections.course} initialProfessor={selections.professor} currentYear={year} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
