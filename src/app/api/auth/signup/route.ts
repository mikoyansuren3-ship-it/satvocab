import { NextResponse, type NextRequest } from "next/server";
import { hashPin, newUser, progressKey, setSession, userKey } from "@/server/auth";
import { NO_STORE, jsonError, notConfigured, readJson } from "@/server/http";
import { getStorage } from "@/server/storage";
import { USERNAME_RULE, isPin, normalizeUsername } from "@/lib/username";

const MAX_BODY = 1_500_000;

export async function POST(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const body = await readJson(request, MAX_BODY);
  if (body instanceof NextResponse) return body;

  const username = normalizeUsername(String(body.username ?? ""));
  if (!username) return jsonError(400, `Usernames need ${USERNAME_RULE}, starting with a letter or number.`);
  const pin = String(body.pin ?? "");
  if (!isPin(pin)) return jsonError(400, "Your PIN needs to be exactly 6 digits.");

  const user = newUser(username, await hashPin(pin));
  if (!(await storage.create(userKey(username), user))) return jsonError(409, "That username is taken. Try another one.");

  // Progress made as a guest on this device can start the new account.
  const progress = body.progress;
  if (progress && typeof progress === "object" && !Array.isArray(progress)) {
    await storage.write(progressKey(user.id), { data: progress, updatedAt: new Date().toISOString() });
  }

  const session = { id: user.id, username: user.username };
  const response = NextResponse.json({ user: session }, { status: 201, headers: NO_STORE });
  await setSession(response, storage, session);
  return response;
}
