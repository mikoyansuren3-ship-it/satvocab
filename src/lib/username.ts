/** Shared by the sign-in form and the server so both enforce the same rules. */
export const USERNAME_RULE = "3–24 letters, numbers, dots, dashes or underscores";
export const PASSWORD_MIN = 8;

/** Lowercased username, or null if it breaks the rules. */
export function normalizeUsername(input: string): string | null {
  const name = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,23}$/.test(name) ? name : null;
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > 200) return "That password is too long.";
  return null;
}
