import { NextResponse, type NextRequest } from "next/server";
import { lockedFor, userKey, type UserRecord } from "@/server/auth";
import { NO_STORE, jsonError, notConfigured, readJson } from "@/server/http";
import { getStorage } from "@/server/storage";
import { USERNAME_RULE, normalizeUsername } from "@/lib/username";

/** Step 1 of signing in: does this username exist (so the next step asks for its PIN or to create one)? */
export async function POST(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const body = await readJson(request, 2_000);
  if (body instanceof NextResponse) return body;
  const username = normalizeUsername(String(body.username ?? ""));
  if (!username) return jsonError(400, `Usernames need ${USERNAME_RULE}, starting with a letter or number.`);
  const user = await storage.read<UserRecord>(userKey(username));
  return NextResponse.json(
    {
      username,
      exists: Boolean(user),
      lockedForMs: user ? await lockedFor(storage, username) : 0,
    },
    { headers: NO_STORE },
  );
}
