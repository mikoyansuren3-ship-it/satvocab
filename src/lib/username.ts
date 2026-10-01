/** Shared by the sign-in form and the server so both enforce the same rules. */
export const USERNAME_RULE = "3–24 letters, numbers, dots, dashes or underscores";
export const PIN_LENGTH = 6;

/** Lowercased username, or null if it breaks the rules. */
export function normalizeUsername(input: string): string | null {
  const name = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,23}$/.test(name) ? name : null;
}

export function isPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}
