"use client";

import { useSyncExternalStore } from "react";
import { clearSession } from "./session";
import {
  LAST_USER_KEY,
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
export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "expired";

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
  const history = [...remote.history, ...local.history]
    .filter((h, i, all) => all.findIndex((x) => x.t === h.t && x.mode === h.mode) === i)
    .sort((a, b) => a.t - b.t)
    .slice(-100);
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
  };
}

// ---- syncing ----------------------------------------------------------------

/** Saves wait until the user's server copy has been loaded once, so a new device can't overwrite it. */
let pulled = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let saving = false;
let version = 0;

function stopTimers() {
  if (saveTimer) clearTimeout(saveTimer);
  if (retryTimer) clearTimeout(retryTimer);
  saveTimer = retryTimer = null;
}

function scheduleSave(delay = 1200) {
  if (!pulled || !account.user) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void save(), delay);
}

async function save(): Promise<boolean> {
  const user = account.user;
  if (!user || !pulled) return false;
  if (saving) {
    scheduleSave();
    return false;
  }
  saving = true;
  const sentVersion = version;
  setAccount({ sync: "saving" });
  try {
    const res = await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: getState() }),
    });
    if (account.user?.id !== user.id) return false;
    if (res.status === 401) {
      setAccount({ sync: "expired" });
      return false;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (version === sentVersion) setDirty(user.id, false);
    else scheduleSave();
    setAccount({ sync: "saved" });
    return true;
  } catch {
    if (account.user?.id === user.id) {
      setAccount({ sync: "offline" });
      retryTimer = setTimeout(() => void save(), 15_000);
    }
    return false;
  } finally {
    saving = false;
  }
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
  // A study session in progress belongs to whoever started it.
  clearSession();
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
  clearSession();
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
    scheduleSave();
  });
  // Push unsaved changes when the tab is hidden or closed.
  const flush = () => {
    if (document.visibilityState === "hidden" && account.user && pulled && isDirty(account.user.id)) void save();
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
  if (account.user && pulled && isDirty(account.user.id)) await save();
  await post("/api/auth/logout", {});
  becomeGuest();
}
