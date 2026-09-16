import { NextResponse } from "next/server";
import { getQuickSearchCatalog, getQuickSearchEvidence } from "@/data/queries";

import { withQuickEvidence } from "@/data/quick-search";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(withQuickEvidence(await getQuickSearchCatalog(), await getQuickSearchEvidence()), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
