import type { StudyMode } from "@/lib/store";

export type { SessionProgress, SessionResult } from "@/lib/session";

export const MODE_LABEL: Record<StudyMode, string> = {
  flashcards: "Flashcards",
  "quiz-word": "Quiz: word → definition",
  "quiz-def": "Quiz: definition → word",
  "quiz-mixed": "Mixed quiz",
};

/** True when a key press should be left alone (typing, modifiers, held keys, or activating a focused control). */
export function ignoreKey(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return true;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable], dialog")) return true;
  if ((e.key === " " || e.key === "Enter") && target?.closest("button, a")) return true;
  return false;
}
