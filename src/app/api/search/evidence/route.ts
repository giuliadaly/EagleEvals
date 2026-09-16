import { NextResponse } from "next/server";
import { getQuickSearchEvidence } from "@/data/queries";

export async function GET() {
  return NextResponse.json(await getQuickSearchEvidence(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
