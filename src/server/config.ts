export const SESSION_COOKIE = "satvocab_session";

/**
 * Accounts are on when a Vercel Blob store is connected, and always in local
 * development (which stores accounts in ./.data). Without them the site runs
 * guest-only and nothing requires signing in.
 */
export function accountsEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) || process.env.NODE_ENV !== "production";
}
