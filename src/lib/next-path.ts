/** Where to go after signing in: a same-site path from ?next=, never back to /login. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || raw.startsWith("/login")) return "/";
  return raw;
}

export function loginPath(current: string): string {
  const next = safeNextPath(current);
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
