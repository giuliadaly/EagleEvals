import { ownerAuth, ownerResponseHeaders } from "@/data/owner-auth";
import { readAnonymousJson } from "@/data/anonymous-request";

async function handle(request: Request) {
  const auth = ownerAuth();
  if (!auth) return Response.json({ message: "Owner sign-in has not been configured." }, { status: 503, headers: ownerResponseHeaders });
  if (request.method === "POST") {
    const parsed = await readAnonymousJson(request, 12_000);
    if (!parsed.ok) return Response.json({ message: parsed.message }, { status: parsed.status, headers: ownerResponseHeaders });
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    request = new Request(request.url, { method: "POST", headers, body: JSON.stringify(parsed.body) });
  }
  try {
    const response = await auth.handler(request);
    for (const [name, value] of Object.entries(ownerResponseHeaders)) response.headers.set(name, value);
    return response;
  } catch {
    return Response.json({ message: "Owner sign-in could not be completed. Please try again." }, { status: 503, headers: ownerResponseHeaders });
  }
}

export const GET = handle;
export const POST = handle;
