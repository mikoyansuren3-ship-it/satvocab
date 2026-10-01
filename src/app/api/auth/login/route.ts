import { NextResponse, type NextRequest } from "next/server";
import {
  burnPinCheck,
  lockMessage,
  lockedFor,
  oneAtATime,
  recordFailure,
  resetFailures,
  setSession,
  userKey,
  verifyPin,
  type UserRecord,
} from "@/server/auth";
import { NO_STORE, jsonError, notConfigured, readJson } from "@/server/http";
import { getStorage } from "@/server/storage";
import { isPin, normalizeUsername } from "@/lib/username";

export async function POST(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const body = await readJson(request, 10_000);
  if (body instanceof NextResponse) return body;

  const username = normalizeUsername(String(body.username ?? ""));
  const pin = String(body.pin ?? "");
  if (!username || !isPin(pin)) return jsonError(401, "Enter your username and 6-digit PIN.");

  return oneAtATime(username, async () => {
    const locked = await lockedFor(storage, username);
    if (locked) return jsonError(429, lockMessage(locked));

    const user = await storage.read<UserRecord>(userKey(username));
    if (!user) {
      await burnPinCheck(pin);
      return jsonError(401, "There's no account with that username.");
    }
    if (!(await verifyPin(pin, user.pinHash))) {
      const { remaining, lockedFor: lockMs } = await recordFailure(storage, username);
      if (lockMs) return jsonError(429, lockMessage(lockMs));
      return jsonError(401, `Wrong PIN. ${remaining} ${remaining === 1 ? "try" : "tries"} left before a 15-minute lock.`);
    }

    await resetFailures(storage, username);
    const session = { id: user.id, username: user.username };
    const response = NextResponse.json({ user: session }, { headers: NO_STORE });
    await setSession(response, storage, session);
    return response;
  });
}
