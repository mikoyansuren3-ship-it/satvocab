import { buildQuiz, type Question } from "./quiz";
import { getOwner, pauseSession, recordSession, type PausedSession, type StudyMode } from "./store";
import { WORD_BY_ID } from "./words";

export type ActiveSession =
  | { kind: "flashcards"; run: number; ids: string[]; front: "word" | "definition" }
  | { kind: "quiz"; run: number; mode: StudyMode; questions: Question[] };

export interface SessionProgress {
  index: number;
  right: string[];
  missed: string[];
}

export interface SessionResult {
  mode: StudyMode;
  /** Every word in the session, in the order it was shown. */
  ids: string[];
  /** Words answered (or graded); less than ids.length if the session ended early. */
  answered: number;
  correct: number;
  missed: string[];
}

interface SessionCache {
  active: ActiveSession | null;
  progress: SessionProgress | null;
  result: SessionResult | null;
}

/**
 * The session on screen (or its results). It survives switching tabs and, kept in
 * this tab's sessionStorage, reloading the page. Per-word answers and the session's
 * history entry are saved to progress as each answer is given (see recordRun).
 */
export const sessionCache: SessionCache = { active: null, progress: null, result: null };

const STORAGE_KEY = "sat-vocab:v1:session";
let restored = false;

const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.every((id) => typeof id === "string" && WORD_BY_ID.has(id));

function isQuestion(q: unknown): q is Question {
  if (typeof q !== "object" || q === null) return false;
  const { id, direction, options, answer } = q as Record<string, unknown>;
  return (
    typeof id === "string" &&
    WORD_BY_ID.has(id) &&
    (direction === "word-to-def" || direction === "def-to-word") &&
    isIds(options) &&
    Number.isInteger(answer) &&
    (answer as number) >= 0 &&
    (answer as number) < options.length
  );
}

function isActive(a: unknown): a is ActiveSession {
  if (typeof a !== "object" || a === null) return false;
  const s = a as Record<string, unknown>;
  if (typeof s.run !== "number") return false;
  if (s.kind === "flashcards") return isIds(s.ids) && s.ids.length > 0 && (s.front === "word" || s.front === "definition");
  return s.kind === "quiz" && typeof s.mode === "string" && Array.isArray(s.questions) && s.questions.length > 0 && s.questions.every(isQuestion);
}

const isProgress = (p: unknown): p is SessionProgress =>
  typeof p === "object" && p !== null && Number.isInteger((p as SessionProgress).index) && isIds((p as SessionProgress).right) && isIds((p as SessionProgress).missed);

const isResult = (r: unknown): r is SessionResult =>
  typeof r === "object" && r !== null && typeof (r as SessionResult).mode === "string" && isIds((r as SessionResult).ids) && isIds((r as SessionResult).missed);

/** Picks up the session this tab had open before a reload (only for the same account). */
export function restoreSession() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || saved.owner !== getOwner()) return;
    if (isActive(saved.active)) {
      sessionCache.active = saved.active;
      sessionCache.progress = isProgress(saved.progress) ? saved.progress : null;
    } else if (isResult(saved.result)) {
      sessionCache.result = saved.result;
    }
  } catch {
    // Unreadable or blocked: start fresh.
  }
}

function persistSession() {
  try {
    const { active, progress, result } = sessionCache;
    if (active || result) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ owner: getOwner(), active, progress, result }));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage full or blocked: the session still works until the page is reloaded.
  }
}

export function setSessionCache(next: SessionCache) {
  restored = true;
  Object.assign(sessionCache, next);
  persistSession();
}

export const sessionMode = (a: ActiveSession): StudyMode => (a.kind === "flashcards" ? "flashcards" : a.mode);
export const sessionIds = (a: ActiveSession): string[] => (a.kind === "flashcards" ? a.ids : a.questions.map((q) => q.id));

/** Writes the session to history (or updates its entry) as soon as anything is answered. */
export function recordRun(a: ActiveSession, answered: number, correct: number) {
  recordSession({ t: a.run, mode: sessionMode(a), total: answered, correct });
}

/** The record that saves a session in progress for later. */
export function toPaused(a: ActiveSession, p: SessionProgress | null): PausedSession {
  return {
    run: a.run,
    pausedAt: Date.now(),
    mode: sessionMode(a),
    ids: sessionIds(a),
    front: a.kind === "flashcards" ? a.front : "word",
    index: p?.index ?? 0,
    right: p?.right ?? [],
    missed: p?.missed ?? [],
  };
}

/** Rebuilds a paused session to carry on with it (quiz choices are drawn fresh). */
export function fromPaused(p: PausedSession): { active: ActiveSession; progress: SessionProgress } {
  const active: ActiveSession =
    p.mode === "flashcards"
      ? { kind: "flashcards", run: p.run, ids: p.ids, front: p.front }
      : { kind: "quiz", run: p.run, mode: p.mode, questions: buildQuiz(p.ids, p.mode) };
  return { active, progress: { index: p.index, right: p.right, missed: p.missed } };
}

/** Sets aside the session on screen, if it's partway through (e.g. before "Study these" starts another). */
export function pauseCurrentSession() {
  const { active, progress } = sessionCache;
  if (active && progress && progress.index > 0 && progress.index < sessionIds(active).length) pauseSession(toPaused(active, progress));
  clearSession();
}

/** Makes the Study tab open on its setup next time (e.g. "Study these"). Answers are already in history. */
export function clearSession() {
  setSessionCache({ active: null, progress: null, result: null });
}
