"use client";

import { useSyncExternalStore } from "react";
import { clearSession } from "./session";
import {
  LAST_USER_KEY,
  MAX_PAUSED,
  getOwner,
  getState,
  onLocalChange,
  replaceState,
  sanitize,
  switchOwner,
  type AppState,
} from "./store";

export interface AccountUser {
  id: string;
  username: string;
}

/** "unavailable": the site has no account storage set up, so everyone studies as a guest. */
export type AccountStatus = "loading" | "guest" | "user" | "unavailable";
/** "pending": saved in this browser, waiting for the next batched save to the account. */
export type SyncStatus = "idle" | "saving" | "saved" | "pending" | "offline" | "expired";

export interface AccountState {
  status: AccountStatus;
  user: AccountUser | null;
  sync: SyncStatus;
}

const SERVER_ACCOUNT: AccountState = { status: "loading", user: null, sync: "idle" };
let account: AccountState = SERVER_ACCOUNT;
const listeners = new Set<() => void>();
let started = false;

function setAccount(patch: Partial<AccountState>) {
  account = { ...account, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void init();
  }
  return () => listeners.delete(listener);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribe,
    () => account,
    () => SERVER_ACCOUNT,
  );
}

// ---- local bookkeeping ------------------------------------------------------

const dirtyKey = (id: string) => `${LAST_USER_KEY}:dirty:${id}`;

function readLastUser(): AccountUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    return user && typeof user.id === "string" && typeof user.username === "string" ? user : null;
  } catch {
    return null;
  }
}

function writeLastUser(user: AccountUser | null) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Storage unavailable; the session cookie still works.
  }
}

/** True when this browser has changes the server hasn't confirmed yet. */
function isDirty(id: string): boolean {
  try {
    return localStorage.getItem(dirtyKey(id)) === "1";
  } catch {
    return false;
  }
}

function setDirty(id: string, dirty: boolean) {
  try {
    if (dirty) localStorage.setItem(dirtyKey(id), "1");
    else localStorage.removeItem(dirtyKey(id));
  } catch {
    // Ignore; worst case a later change re-saves everything.
  }
}

/** Combines two copies of a user's progress, keeping the most recent review of each word. */
export function mergeStates(remote: AppState, local: AppState): AppState {
  const progress = { ...remote.progress };
  for (const [id, p] of Object.entries(local.progress)) {
    const r = progress[id];
    if (!r || p.last > r.last || (p.last === r.last && p.seen > r.seen)) progress[id] = p;
  }
  // A session is updated as it's answered, so the copy with more answers is the newer one.
  const sessions = new Map<string, AppState["history"][number]>();
  for (const h of [...remote.history, ...local.history]) {
    const key = `${h.t}:${h.mode}`;
    const other = sessions.get(key);
    if (!other || h.total > other.total) sessions.set(key, h);
  }
  const history = [...sessions.values()].sort((a, b) => a.t - b.t).slice(-100);
  // Paused sessions: keep the latest pause of each, unless it was resumed or discarded after that.
  const closedAt = new Map<number, number>();
  for (const c of [...remote.closed, ...local.closed]) closedAt.set(c.run, Math.max(c.at, closedAt.get(c.run) ?? 0));
  const pausedByRun = new Map<number, AppState["paused"][number]>();
  for (const p of [...remote.paused, ...local.paused]) {
    const other = pausedByRun.get(p.run);
    if (!other || p.pausedAt > other.pausedAt) pausedByRun.set(p.run, p);
  }
  const paused = [...pausedByRun.values()]
    .filter((p) => (closedAt.get(p.run) ?? 0) < p.pausedAt)
    .sort((a, b) => a.pausedAt - b.pausedAt)
    .slice(-MAX_PAUSED);
  const closed = [...closedAt].map(([run, at]) => ({ run, at })).sort((a, b) => a.at - b.at).slice(-50);
  const days = Array.from(new Set([...remote.days, ...local.days]))
    .sort()
    .slice(-730);
  return {
    progress,
    saved: { ...remote.saved, ...local.saved },
    filters: local.filters,
    study: local.study,
    history,
    days,
    paused,
    closed,
  };
}

// ---- syncing ----------------------------------------------------------------

/**
 * Every change is saved in this browser at once (store.ts), so a reload or a closed tab
 * loses nothing: unsynced changes are marked dirty and merged in on the next visit. The
 * server copy, which other devices read, is updated in batches: when a study session
 * ends, when the tab is hidden or closed, and otherwise at most every SYNC_EVERY ms.
 * Batching keeps writes well inside the Blob store's free monthly allowance.
 */
const SYNC_EVERY = 2 * 60_000;
/** Browsers drop keepalive requests (the kind that outlive the page) above 64 KB. */
const KEEPALIVE_LIMIT = 60_000;

/** Saves wait until the user's server copy has been loaded once, so a new device can't overwrite it. */
let pulled = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveDue = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let saving = false;
let saveAgain = false;
let version = 0;

function stopTimers() {
  if (saveTimer) clearTimeout(saveTimer);
  if (retryTimer) clearTimeout(retryTimer);
  saveTimer = retryTimer = null;
}

/** Sends the changes within `delay` ms; an earlier pending save is kept, not pushed back. */
function scheduleSave(delay = SYNC_EVERY) {
  if (!pulled || !account.user) return;
  const due = Date.now() + delay;
  if (saveTimer && saveDue <= due) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveDue = due;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void save();
  }, delay);
}

async function save({ keepalive = false } = {}): Promise<boolean> {
  const user = account.user;
  if (!user || !pulled) return false;
  if (saving) {
    // Send again as soon as the current save finishes.
    saveAgain = true;
    return false;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  saving = true;
  const sentVersion = version;
  setAccount({ sync: "saving" });
  try {
    const body = JSON.stringify({ data: getState() });
    const res = await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      // Lets the save finish even if the page is being reloaded or closed.
      keepalive: keepalive && body.length < KEEPALIVE_LIMIT,
    });
    if (account.user?.id !== user.id) return false;
    if (res.status === 401) {
      setAccount({ sync: "expired" });
      return false;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const current = version === sentVersion;
    if (current) setDirty(user.id, false);
    else scheduleSave();
    setAccount({ sync: current ? "saved" : "pending" });
    return true;
  } catch {
    if (account.user?.id === user.id) {
      setAccount({ sync: "offline" });
      retryTimer = setTimeout(() => void save(), 15_000);
    }
    return false;
  } finally {
    saving = false;
    if (saveAgain) {
      saveAgain = false;
      if (account.user?.id === user.id && isDirty(user.id)) void save();
    }
  }
}

/** Sends unsynced changes to the server now (e.g. when a study session ends). */
export async function flushProgress(): Promise<void> {
  if (account.user && pulled && isDirty(account.user.id)) await save();
}

async function pull(user: AccountUser) {
  try {
    const res = await fetch("/api/progress", { cache: "no-store" });
    if (account.user?.id !== user.id) return;
    if (res.status === 401) {
      setAccount({ sync: "expired" });
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data: unknown };
    if (account.user?.id !== user.id) return;
    pulled = true;
    if (body.data) {
      const remote = sanitize(body.data);
      if (isDirty(user.id)) {
        replaceState(mergeStates(remote, getState()));
        scheduleSave(0);
      } else {
        replaceState(remote);
      }
    } else {
      // Nothing on the server yet: start it from this browser's copy.
      setDirty(user.id, true);
      scheduleSave(0);
    }
    setAccount({ sync: isDirty(user.id) ? "saving" : "saved" });
  } catch {
    if (account.user?.id !== user.id) return;
    setAccount({ sync: "offline" });
    retryTimer = setTimeout(() => void pull(user), 15_000);
  }
}

function activate(user: AccountUser, startFrom?: AppState) {
  stopTimers();
  // A study session in progress belongs to whoever started it (a reload keeps it).
  if (getOwner() !== user.id) clearSession();
  pulled = false;
  writeLastUser(user);
  switchOwner(user.id);
  if (startFrom) {
    replaceState(startFrom);
    setDirty(user.id, true);
  }
  setAccount({ status: "user", user, sync: "idle" });
  void pull(user);
}

function becomeGuest(status: AccountStatus = "guest") {
  stopTimers();
  if (getOwner() !== "guest") clearSession();
  pulled = false;
  writeLastUser(null);
  switchOwner("guest");
  setAccount({ status, user: null, sync: "idle" });
}

async function init() {
  if (typeof window === "undefined") return;
  onLocalChange(() => {
    const user = account.user;
    if (!user) return;
    version++;
    setDirty(user.id, true);
    if (account.sync === "saved") setAccount({ sync: "pending" });
    scheduleSave();
  });
  // Push unsaved changes when the tab is hidden, reloaded or closed.
  const flush = () => {
    if (document.visibilityState === "hidden" && account.user && pulled && isDirty(account.user.id)) void save({ keepalive: true });
  };
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", flush);
  // Another tab signed in or out: reload so this one shows the same account.
  window.addEventListener("storage", (e) => {
    if (e.key === LAST_USER_KEY) window.location.reload();
  });
  await checkSession();
}

/** Asks the server who is signed in. */
async function checkSession() {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const body = (await res.json()) as { configured: boolean; user: AccountUser | null };
    if (!body.configured) return becomeGuest("unavailable");
    if (body.user) activate(body.user);
    else becomeGuest();
  } catch {
    // Offline: keep showing the last account's copy from this browser and retry later.
    const last = readLastUser();
    if (last && getOwner() === last.id) {
      setAccount({ status: "user", user: last, sync: "offline" });
      retryTimer = setTimeout(() => void checkSession(), 30_000);
    } else {
      becomeGuest();
    }
  }
}

// ---- actions ----------------------------------------------------------------

async function post(path: string, body: unknown): Promise<{ user?: AccountUser; error?: string; status: number }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { user?: AccountUser; error?: string };
    return { ...data, status: res.status };
  } catch {
    return { error: "Couldn't reach the server. Check your connection and try again.", status: 0 };
  }
}

/** True if the guest copy on this browser has anything worth carrying into a new account. */
export function guestHasProgress(): boolean {
  if (getOwner() !== "guest") return false;
  const s = getState();
  return Object.keys(s.progress).length > 0 || Object.keys(s.saved).length > 0;
}

export interface UsernameCheck {
  username: string;
  exists: boolean;
  lockedForMs: number;
}

/** Step 1 of signing in: finds out whether the username already has an account. */
export async function checkUsername(username: string): Promise<UsernameCheck | { error: string }> {
  try {
    const res = await fetch("/api/auth/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<UsernameCheck> & { error?: string };
    if (!res.ok || typeof data.exists !== "boolean") return { error: data.error ?? "Something went wrong. Try again." };
    return data as UsernameCheck;
  } catch {
    return { error: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function signUp(username: string, pin: string, keepGuestProgress: boolean): Promise<string | null> {
  const guest = keepGuestProgress && guestHasProgress() ? getState() : undefined;
  const result = await post("/api/auth/signup", { username, pin, progress: guest });
  if (!result.user) return result.error ?? "Couldn't create the account. Try again.";
  activate(result.user, guest);
  return null;
}

export async function signIn(username: string, pin: string): Promise<string | null> {
  const result = await post("/api/auth/login", { username, pin });
  if (!result.user) return result.error ?? "Couldn't sign in. Try again.";
  activate(result.user);
  return null;
}

export async function signOut() {
  // Answers are already in progress and history; just close the session on screen.
  clearSession();
  // Let a save that's already on its way finish, then send whatever is left.
  for (let waited = 0; saving && waited < 5000; waited += 50) await new Promise((r) => setTimeout(r, 50));
  if (account.user && pulled && isDirty(account.user.id)) await save();
  await post("/api/auth/logout", {});
  becomeGuest();
}
