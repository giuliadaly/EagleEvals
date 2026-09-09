"use client";

import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { productEventData, redactTelemetry, type ProductEvent } from "@/data/telemetry";

export function trackProductEvent(event: ProductEvent) {
  try { track(event.name, productEventData(event)); }
  catch { /* Optional analytics must never interrupt search or submission. */ }
}

export function SiteTelemetry() {
  return <>
    <Analytics beforeSend={redactTelemetry} />
    <SpeedInsights beforeSend={redactTelemetry} sampleRate={0.5} />
  </>;
}
