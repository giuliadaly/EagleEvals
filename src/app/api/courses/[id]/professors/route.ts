import { NextResponse } from "next/server";
import { getCourseProfessors } from "@/data/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{24}$/.test(id)) return NextResponse.json({ professors: [] }, { status: 400 });
  return NextResponse.json({ professors: await getCourseProfessors(id) }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}
