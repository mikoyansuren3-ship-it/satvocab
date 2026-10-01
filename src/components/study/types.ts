import type { StudyMode } from "@/lib/store";

export interface SessionResult {
  mode: StudyMode;
  /** Every word in the session, in the order it was shown. */
  ids: string[];
  /** Words answered (or graded) so far; less than ids.length if ended early. */
  answered: number;
  correct: number;
  missed: string[];
}

export const MODE_LABEL: Record<StudyMode, string> = {
  flashcards: "Flashcards",
  "quiz-word": "Quiz: word → definition",
  "quiz-def": "Quiz: definition → word",
  "quiz-mixed": "Mixed quiz",
};

/** True when a key press should be left alone (typing, modifiers, or activating a focused button). */
export function ignoreKey(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable], dialog")) return true;
  if ((e.key === " " || e.key === "Enter") && target?.closest("button, a")) return true;
  return false;
}
