import { NextResponse } from "next/server";
import { getQuickSearchCatalog } from "@/data/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getQuickSearchCatalog(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=900" },
  });
}
