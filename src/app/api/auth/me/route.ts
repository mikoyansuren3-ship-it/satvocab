import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clearSession, readSession } from "@/server/auth";
import { NO_STORE } from "@/server/http";
import { getStorage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return NextResponse.json({ configured: false, user: null }, { headers: NO_STORE });
  const user = await readSession(request, storage);
  const response = NextResponse.json({ configured: true, user }, { headers: NO_STORE });
  // A cookie that no longer verifies is dropped, so the next page load goes straight to sign-in.
  if (!user && request.cookies.has(SESSION_COOKIE)) clearSession(response);
  return response;
}
