import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { formatCount, formatEvaluationCount, formatReviewAvailability } from "@/data/format";
import type { MetricValue } from "@/data/types";
import styles from "./detail-page.module.css";

export function preciseRating(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function DetailScore({ value, label, precision = 2 }: { value: number | null; label: string; precision?: number }) {
  return <div className={styles.score}><strong>{value === null ? "—" : value.toFixed(precision)}{value !== null ? <small> / 5</small> : null}</strong><span>{label}</span>{value === null ? <small>No rating collected</small> : null}</div>;
}

export function DetailRatingEvidence({ evaluationCount, writtenCount, hasOverallRating, children }: { evaluationCount: number; writtenCount: number; hasOverallRating: boolean; children?: ReactNode }) {
  return <>
    <p className={styles.evidence}>{formatEvaluationCount(evaluationCount)}{children ? <><br />{children}</> : null}</p>
    <a className={styles.reviewAvailability} data-empty={writtenCount === 0} href="#comments">{formatReviewAvailability(writtenCount, evaluationCount, hasOverallRating)} <ChevronIcon direction="down" /></a>
    <p className={styles.ratingExplanation}>Scores average answered numerical ratings. Older evaluation records may summarize whole sections and have no written comment. Written reviews are counted separately. <Link href="/about#ratings">How scores work</Link></p>
  </>;
}

export function DetailDisclosure({ title, children, id, open = false, className = "" }: { title: ReactNode; children: ReactNode; id?: string; open?: boolean; className?: string }) {
  return <details id={id} open={open} className={`${styles.disclosure} ${className}`}><summary>{title}</summary><div className={styles.disclosureBody}>{children}</div></details>;
}

export { DetailReviews } from "./detail-reviews";

export function DetailMetrics({ metrics }: { metrics: MetricValue[] }) {
  return <dl className={styles.metrics}>{metrics.map(metric => <div key={metric.label} className={styles.metric}>
    <dt>{metric.label}{metric.description ? <small>{metric.description}</small> : null}{metric.sampleCount !== undefined ? <small>{metric.sampleCount ? `${formatCount(metric.sampleCount)} evaluation${metric.sampleCount === 1 ? "" : "s"}` : "No responses in this record"}</small> : null}</dt>
    <dd data-empty={metric.value === null ? true : undefined}>{metric.value === null ? "Not collected" : `${metric.value.toFixed(2)} / 5`}</dd>
  </div>)}</dl>;
}
