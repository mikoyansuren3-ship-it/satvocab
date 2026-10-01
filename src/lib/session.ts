import type { Question } from "./quiz";
import type { StudyMode } from "./store";

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
} = { active: null, progress: null, result: null };
