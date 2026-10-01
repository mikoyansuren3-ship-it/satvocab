import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./config";
import type { Storage } from "./storage";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
}

export { SESSION_COOKIE };
const SESSION_DAYS = 60;

export const userKey = (username: string) => `users/${username}.json`;
export const progressKey = (userId: string) => `progress/${userId}.json`;

// ---- passwords (scrypt, built into Node) ------------------------------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: Buffer, params = SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, params, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(password, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Same work as a real check, so a missing username takes as long as a wrong password. */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomUUID());
  await verifyPassword(password, await dummyHash);
}

export function newUser(username: string, passwordHash: string): UserRecord {
  return { id: randomUUID(), username, passwordHash, createdAt: new Date().toISOString() };
}

// ---- sessions (signed, HTTP-only cookie) ------------------------------------

let secretPromise: Promise<string> | null = null;

/**
 * Signing secret: AUTH_SECRET if set, otherwise a random one generated once and
 * kept in storage, so no extra environment variable is needed.
 */
function sessionSecret(storage: Storage): Promise<string> {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) return Promise.resolve(fromEnv);
  secretPromise ??= (async () => {
    const key = "system/session-secret.json";
    const existing = await storage.read<{ secret: string }>(key);
    if (existing?.secret) return existing.secret;
    const secret = randomBytes(32).toString("hex");
    if (await storage.create(key, { secret })) return secret;
    const winner = await storage.read<{ secret: string }>(key); // another request created it first
    if (!winner?.secret) throw new Error("Session secret unavailable");
    return winner.secret;
  })().catch((error) => {
    secretPromise = null;
    throw error;
  });
  return secretPromise;
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export async function setSession(response: NextResponse, storage: Storage, user: SessionUser) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: user.id, u: user.username, exp })).toString("base64url");
  const token = `${payload}.${sign(payload, await sessionSecret(storage))}`;
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function readSession(request: NextRequest, storage: Storage): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, await sessionSecret(storage)));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.uid !== "string" || typeof data.u !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { id: data.uid, username: data.u };
  } catch {
    return null;
  }
}

// ---- light brute-force protection -------------------------------------------

/** Per-instance limiter: after 8 failures in 15 minutes a username is paused briefly. */
const failures = new Map<string, { count: number; first: number }>();
const WINDOW = 15 * 60 * 1000;

export function tooManyAttempts(username: string): boolean {
  const entry = failures.get(username);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW) {
    failures.delete(username);
    return false;
  }
  return entry.count >= 8;
}

export function noteFailure(username: string) {
  const entry = failures.get(username);
  if (!entry || Date.now() - entry.first > WINDOW) failures.set(username, { count: 1, first: Date.now() });
  else entry.count++;
}

export function clearFailures(username: string) {
  failures.delete(username);
}
