import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? <Link className="hover:text-[var(--navy)]" href={item.href}>{item.label}</Link> : <span aria-current="page" className="text-[var(--ink)]">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function SectionHeading({ eyebrow, title, description, href, linkLabel }: { eyebrow?: string; title: string; description?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow text-[var(--gold-dark)]">{eyebrow}</p> : null}
        <h2 className="mt-2 font-serif text-3xl font-bold leading-tight tracking-[-0.025em] text-[var(--navy)] sm:text-4xl">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {href && linkLabel ? <Link href={href} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[var(--navy)] hover:text-[var(--blue)]">{linkLabel}<ArrowIcon className="size-4" /></Link> : null}
    </div>
  );
}

export function Pagination({ page, totalPages, basePath, query, params: extraParams }: { page: number; totalPages: number; basePath: string; query?: string; params?: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    Object.entries(extraParams ?? {}).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-6">
      {page > 1 ? <Link className="button-secondary" href={href(page - 1)}>Previous</Link> : <span />}
      <p className="text-sm text-[var(--muted)]">Page <strong className="text-[var(--ink)]">{page}</strong> of {totalPages}</p>
      {page < totalPages ? <Link className="button-secondary" href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}
