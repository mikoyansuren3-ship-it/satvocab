import raw from "@/data/words.json";

export type Pos = "n." | "v." | "adj." | "adv.";

export const CATEGORIES = [
  "Action",
  "Communication",
  "Mind & Reason",
  "Character",
  "Emotion",
  "Opposition",
  "Change & Growth",
  "Society & Power",
  "Quality & Degree",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Word {
  id: string;
  word: string;
  /** Word bank, e.g. "1.4" (Lesson 1.4 on the source site). */
  lesson: string;
  /** Position in the source list, used for "Lesson order" sorting. */
  order: number;
  synonym: string;
  definition: string;
  pos: Pos;
  category: Category;
  example: string;
}

export const WORDS: Word[] = raw as unknown as Word[];
export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export const LESSONS: string[] = Array.from(new Set(WORDS.map((w) => w.lesson))).sort(
  (a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]),
);

export const POS_OPTIONS: { value: Pos; label: string }[] = [
  { value: "n.", label: "Nouns" },
  { value: "v.", label: "Verbs" },
  { value: "adj.", label: "Adjectives" },
  { value: "adv.", label: "Adverbs" },
];

export const POS_NAME: Record<Pos, string> = {
  "n.": "noun",
  "v.": "verb",
  "adj.": "adjective",
  "adv.": "adverb",
};

export const CATEGORY_STYLE: Record<Category, { pill: string; swatch: string }> = {
  Action: {
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
    swatch: "bg-blue-500",
  },
  Communication: {
    pill: "bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300",
    swatch: "bg-teal-500",
  },
  "Mind & Reason": {
    pill: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
    swatch: "bg-indigo-500",
  },
  Character: {
    pill: "bg-orange-50 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
    swatch: "bg-orange-500",
  },
  Emotion: {
    pill: "bg-pink-50 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300",
    swatch: "bg-pink-500",
  },
  Opposition: {
    pill: "bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300",
    swatch: "bg-red-500",
  },
  "Change & Growth": {
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    swatch: "bg-emerald-500",
  },
  "Society & Power": {
    pill: "bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
    swatch: "bg-amber-500",
  },
  "Quality & Degree": {
    pill: "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300",
    swatch: "bg-purple-500",
  },
};

/**
 * Splits an example sentence around the headword (or an inflection of it,
 * e.g. "fostered" for "foster") so the UI can emphasize it.
 */
export function splitExample(example: string, word: string): [string, string, string] | null {
  const target = word.toLowerCase();
  const threshold = Math.min(target.length, Math.max(3, target.length - 3));
  let best: { index: number; length: number; score: number } | null = null;
  for (const match of example.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)) {
    const token = match[0].toLowerCase();
    let prefix = 0;
    while (prefix < token.length && prefix < target.length && token[prefix] === target[prefix]) prefix++;
    if (prefix < threshold) continue;
    const score = prefix * 10 + (token.length >= target.length - 1 ? 5 : 0);
    if (!best || score > best.score) best = { index: match.index ?? 0, length: match[0].length, score };
  }
  if (!best) return null;
  return [
    example.slice(0, best.index),
    example.slice(best.index, best.index + best.length),
    example.slice(best.index + best.length),
  ];
}
