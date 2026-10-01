import { NextResponse, type NextRequest } from "next/server";

export const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export const notConfigured = () =>
  jsonError(503, "Accounts aren't set up on this site yet. You can keep studying as a guest.");

/**
 * Parses a JSON body up to `maxBytes`. Requiring a JSON content type also stops
 * cross-site HTML forms from posting here with the user's cookie.
 */
export async function readJson(request: NextRequest, maxBytes: number): Promise<Record<string, unknown> | NextResponse> {
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonError(415, "Expected JSON.");
  const text = await request.text();
  if (text.length > maxBytes) return jsonError(413, "That's too much data to save at once.");
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body !== "object" || body === null || Array.isArray(body)) return jsonError(400, "Expected a JSON object.");
    return body as Record<string, unknown>;
  } catch {
    return jsonError(400, "Couldn't read that request.");
  }
}
