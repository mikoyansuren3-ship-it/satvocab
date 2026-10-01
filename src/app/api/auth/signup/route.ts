import { NextResponse, type NextRequest } from "next/server";
import { hashPassword, newUser, progressKey, setSession, userKey } from "@/server/auth";
import { NO_STORE, jsonError, notConfigured, readJson } from "@/server/http";
import { getStorage } from "@/server/storage";
import { USERNAME_RULE, normalizeUsername, passwordProblem } from "@/lib/username";

const MAX_BODY = 1_500_000;

export async function POST(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const body = await readJson(request, MAX_BODY);
  if (body instanceof NextResponse) return body;

  const username = normalizeUsername(String(body.username ?? ""));
  if (!username) return jsonError(400, `Usernames need ${USERNAME_RULE}, starting with a letter or number.`);
  const password = String(body.password ?? "");
  const problem = passwordProblem(password);
  if (problem) return jsonError(400, problem);

  const user = newUser(username, await hashPassword(password));
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
