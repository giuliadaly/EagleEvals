type JsonResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; message: string };

// Request metadata is checked in memory only. It is never attached to a submission.
export async function readAnonymousJson(request: Request, maxBytes = 20_000): Promise<JsonResult> {
  const origin = request.headers.get("origin");
  let validOrigin = true;
  if (origin !== null) {
    try {
      const parsed = new URL(origin);
      // Match Next's forwarded-host precedence. request.url can contain the
      // internal server hostname rather than the browser's public domain.
      const publicHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        request.headers.get("host") || new URL(request.url).host;
      validOrigin = ["http:", "https:"].includes(parsed.protocol) && origin === parsed.origin &&
        parsed.host.toLowerCase() === publicHost.toLowerCase();
    } catch {
      validOrigin = false;
    }
  }
  if (request.headers.get("sec-fetch-site") === "cross-site" || !validOrigin) {
    return { ok: false, status: 403, message: "Open the form on EagleEvals to submit it." };
  }
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    return { ok: false, status: 415, message: "The submission must use the EagleEvals form." };
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    return { ok: false, status: 413, message: "The submission is too large." };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400, message: "The submission could not be read." };
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let json = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, message: "The submission is too large." };
      }
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
    return { ok: true, body: JSON.parse(json) };
  } catch {
    return { ok: false, status: 400, message: "The submission could not be read." };
  } finally {
    reader.releaseLock();
  }
}
