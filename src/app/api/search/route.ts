import { NextRequest, NextResponse } from "next/server";
import { cleanTitle } from "@/data/format";
import { searchCatalog } from "@/data/queries";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  if (query.trim().length < 2) return NextResponse.json({ courses: [], professors: [] });

  const results = await searchCatalog(query, 6);
  return NextResponse.json(
    {
      courses: results.courses.map(({ id, code, title, subject, commentCount }) => ({ id, code, title, subject, commentCount })),
      professors: results.professors.map(({ id, name, titles, commentCount }) => ({ id, name, title: cleanTitle(titles[0]), commentCount })),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
