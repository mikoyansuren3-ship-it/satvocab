import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, accountsEnabled } from "@/server/config";

/**
 * Sends signed-out visitors to the sign-in page before any page is served.
 * This only checks that a session cookie exists; the API verifies its
 * signature, and the page sends you back here if it turns out to be invalid.
 */
export function proxy(request: NextRequest) {
  if (!accountsEnabled() || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Pages only: not the API, Next.js assets, or files like the icon.
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
