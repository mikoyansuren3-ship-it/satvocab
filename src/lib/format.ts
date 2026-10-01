/** Thousands-separated count with a fixed locale, so prerendered and client output match. */
export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
