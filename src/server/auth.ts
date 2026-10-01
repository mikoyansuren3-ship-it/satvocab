import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./config";
import type { Storage } from "./storage";

export interface UserRecord {
  id: string;
  username: string;
  /** scrypt hash of the 6-digit PIN. */
  pinHash: string;
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

// ---- PINs (hashed with scrypt, built into Node) -------------------------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

function scryptAsync(pin: string, salt: Buffer, params = SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, KEY_LENGTH, params, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(pin, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Same work as a real check, so a missing username takes as long as a wrong PIN. */
let dummyHash: Promise<string> | null = null;
export async function burnPinCheck(pin: string) {
  dummyHash ??= hashPin("000000");
  await verifyPin(pin, await dummyHash);
}

export function newUser(username: string, pinHash: string): UserRecord {
  return { id: randomUUID(), username, pinHash, createdAt: new Date().toISOString() };
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

// ---- brute-force protection -------------------------------------------------

/**
 * Failed sign-ins are counted in storage (not memory), so the limit holds across
 * server instances: 5 wrong tries lock the username for 15 minutes. A 6-digit
 * PIN then takes years to guess.
 */
interface Attempts {
  count: number;
  first: number;
  lockedUntil: number;
}

export const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const attemptsKey = (username: string) => `attempts/${username}.json`;
const EMPTY: Attempts = { count: 0, first: 0, lockedUntil: 0 };

async function readAttempts(storage: Storage, username: string): Promise<Attempts> {
  const a = await storage.read<Attempts>(attemptsKey(username));
  if (!a) return EMPTY;
  // Old failures stop counting after an hour without a lockout.
  if (a.lockedUntil < Date.now() && Date.now() - a.first > WINDOW_MS) return EMPTY;
  return a;
}

/** Milliseconds until the username unlocks; 0 when it isn't locked. */
export async function lockedFor(storage: Storage, username: string): Promise<number> {
  return Math.max(0, (await readAttempts(storage, username)).lockedUntil - Date.now());
}

export async function recordFailure(storage: Storage, username: string): Promise<{ remaining: number; lockedFor: number }> {
  const prev = await readAttempts(storage, username);
  const expiredLock = prev.lockedUntil > 0 && prev.lockedUntil <= Date.now();
  const base = expiredLock ? EMPTY : prev;
  const count = base.count + 1;
  const next: Attempts = {
    count,
    first: base.count ? base.first : Date.now(),
    lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
  };
  await storage.write(attemptsKey(username), next);
  return { remaining: Math.max(0, MAX_FAILURES - count), lockedFor: next.lockedUntil ? LOCK_MS : 0 };
}

export async function resetFailures(storage: Storage, username: string) {
  if ((await readAttempts(storage, username)).count > 0) await storage.write(attemptsKey(username), EMPTY);
}

/** Runs sign-in attempts for one username one at a time, so parallel guesses can't skip the counter. */
const queues = new Map<string, Promise<unknown>>();
export function oneAtATime<T>(username: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(username) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(task);
  queues.set(username, run);
  void run.finally(() => {
    if (queues.get(username) === run) queues.delete(username);
  });
  return run;
}

export function lockMessage(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
