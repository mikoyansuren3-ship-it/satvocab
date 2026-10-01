export type Level = "new" | "learning" | "almost" | "mastered";

export const LEVELS: Level[] = ["new", "learning", "almost", "mastered"];

export const LEVEL_LABEL: Record<Level, string> = {
  new: "Never seen",
  learning: "Learning",
  almost: "Almost there",
  mastered: "Mastered",
};

// Learning / almost / mastered hues validated (light + dark) with the dataviz
// palette checker; "never seen" is the neutral track, not a series color.
export const LEVEL_STYLE: Record<Level, { badge: string; dot: string; border: string; bar: string }> = {
  new: {
    badge: "bg-stone-200/80 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
    dot: "bg-stone-300 dark:bg-stone-600",
    border: "border-stone-300 dark:border-stone-700",
    bar: "bg-surface-3",
  },
  learning: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-600",
    border: "border-amber-600",
    bar: "bg-amber-600",
  },
  almost: {
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    dot: "bg-sky-600",
    border: "border-sky-600",
    bar: "bg-sky-600",
  },
  mastered: {
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    dot: "bg-green-700 dark:bg-green-600",
    border: "border-green-700 dark:border-green-600",
    bar: "bg-green-700 dark:bg-green-600",
  },
};

export interface WordProgress {
  /** Leitner-style box: 0-1 learning, 2-3 almost there, 4-5 mastered. */
  box: number;
  seen: number;
  correct: number;
  wrong: number;
  /** Timestamp (ms) of the last review. */
  last: number;
}

export const MAX_BOX = 5;

export function levelOf(p: WordProgress | undefined): Level {
  if (!p || p.seen === 0) return "new";
  if (p.box >= 4) return "mastered";
  if (p.box >= 2) return "almost";
  return "learning";
}

/** One correct answer moves a word up a box; a miss drops it two. */
export function nextProgress(p: WordProgress | undefined, correct: boolean, now: number): WordProgress {
  const prev = p ?? { box: 0, seen: 0, correct: 0, wrong: 0, last: 0 };
  return {
    box: correct ? Math.min(MAX_BOX, prev.box + 1) : Math.max(0, prev.box - 2),
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    last: now,
  };
}
