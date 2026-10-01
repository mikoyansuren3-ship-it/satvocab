import type { Question } from "./quiz";
import { logSession, type StudyMode } from "./store";

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

/**
 * In-memory only: lets a running session (or its results) survive switching
 * tabs, but not a page reload. Per-word answers are saved as they happen.
 */
export const sessionCache: {
  active: ActiveSession | null;
  progress: SessionProgress | null;
  result: SessionResult | null;
  /** Run id already written to history, so a session is never logged twice. */
  loggedRun: number | null;
} = { active: null, progress: null, result: null, loggedRun: null };

export const sessionMode = (a: ActiveSession): StudyMode => (a.kind === "flashcards" ? "flashcards" : a.mode);
export const sessionIds = (a: ActiveSession): string[] => (a.kind === "flashcards" ? a.ids : a.questions.map((q) => q.id));

/** Adds a session to history once, if anything was answered. */
export function logRun(a: ActiveSession, answered: number, correct: number) {
  if (sessionCache.loggedRun === a.run || answered === 0) return;
  sessionCache.loggedRun = a.run;
  logSession({ mode: sessionMode(a), total: answered, correct });
}

/** Makes the Study tab open on its setup next time (e.g. "Study these"), keeping answers in history. */
export function clearSession() {
  const { active, progress } = sessionCache;
  if (active && progress) logRun(active, progress.right.length + progress.missed.length, progress.right.length);
  sessionCache.active = null;
  sessionCache.progress = null;
  sessionCache.result = null;
}
