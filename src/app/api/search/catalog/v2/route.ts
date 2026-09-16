import { NextResponse } from "next/server";
import { getQuickSearchCatalog } from "@/data/queries";

export async function GET() {
  return NextResponse.json(await getQuickSearchCatalog(), {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
