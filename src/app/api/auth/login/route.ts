import { NextResponse, type NextRequest } from "next/server";
import {
  burnPasswordCheck,
  clearFailures,
  noteFailure,
  setSession,
  tooManyAttempts,
  userKey,
  verifyPassword,
  type UserRecord,
} from "@/server/auth";
import { NO_STORE, jsonError, notConfigured, readJson } from "@/server/http";
import { getStorage } from "@/server/storage";
import { normalizeUsername } from "@/lib/username";

const WRONG = "Wrong username or password.";

export async function POST(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const body = await readJson(request, 10_000);
  if (body instanceof NextResponse) return body;

  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");
  if (!username || !password) return jsonError(401, WRONG);
  if (tooManyAttempts(username)) return jsonError(429, "Too many tries. Wait a few minutes and try again.");

  const user = await storage.read<UserRecord>(userKey(username));
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  if (!user || !ok) {
    noteFailure(username);
    return jsonError(401, WRONG);
  }

  clearFailures(username);
  const session = { id: user.id, username: user.username };
  const response = NextResponse.json({ user: session }, { headers: NO_STORE });
  await setSession(response, storage, session);
  return response;
}
