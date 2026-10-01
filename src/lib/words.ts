import data from "@/data/words.json";

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

/** The three source lists, from most to least common on past SATs. */
export type Tier = "top" | "mid" | "low";
export const TIERS: Tier[] = ["top", "mid", "low"];

export interface Word {
  id: string;
  word: string;
  tier: Tier;
  /** Word bank: "1.4" is Lesson 1.4 (Top), "2.10" Lesson 2.10 (Mid), "3.7" Set 3.7 (Low). */
  lesson: string;
  /** Position in study order (Top lessons, then Mid, then Low sets). */
  order: number;
  synonym: string;
  definition: string;
  pos: Pos;
  category: Category;
  example: string;
}

/** Same rule as scripts/build-words.mjs, which checks ids stay unique. */
export function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function tierOf(lesson: string): Tier {
  return lesson.startsWith("1.") ? "top" : lesson.startsWith("2.") ? "mid" : "low";
}

type Row = [word: string, lesson: string, synonym: string, definition: string, pos: string, category: number, example: string];
const raw = data as unknown as { categories: Category[]; rows: Row[] };

export const WORDS: Word[] = raw.rows.map(([word, lesson, synonym, definition, pos, category, example], order) => ({
  id: slugify(word),
  word,
  tier: tierOf(lesson),
  lesson,
  order,
  synonym,
  definition,
  pos: pos as Pos,
  category: raw.categories[category] ?? "Quality & Degree",
  example,
}));
export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

/** Every word bank in study order. */
export const LESSONS: string[] = Array.from(new Set(WORDS.map((w) => w.lesson)));

export const LESSONS_BY_TIER: Record<Tier, string[]> = {
  top: LESSONS.filter((l) => tierOf(l) === "top"),
  mid: LESSONS.filter((l) => tierOf(l) === "mid"),
  low: LESSONS.filter((l) => tierOf(l) === "low"),
};

/** "Lesson 1.4" for the source's lessons; "Set 3.7" for the unsorted Low list split into sets. */
export function bankLabel(lesson: string): string {
  return `${tierOf(lesson) === "low" ? "Set" : "Lesson"} ${lesson}`;
}

const range = (tier: Tier) => {
  const banks = LESSONS_BY_TIER[tier];
  return banks.length ? `${tier === "low" ? "Sets" : "Lessons"} ${banks[0]}–${banks[banks.length - 1]}` : "";
};

export const TIER_INFO: Record<Tier, { label: string; short: string; banks: string; blurb: string }> = {
  top: { label: "Top frequency", short: "Top", banks: range("top"), blurb: "The most common SAT words" },
  mid: { label: "Mid frequency", short: "Mid", banks: range("mid"), blurb: "Common academic words" },
  low: { label: "Low frequency", short: "Low", banks: range("low"), blurb: "Rarer, harder words" },
};

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

/** Index of the token in `text` that is the headword or an inflection of it (e.g. "fostered"). */
function findHeadword(text: string, word: string, strict = false): { index: number; length: number } | null {
  const target = word.toLowerCase();
  // Strict matching (for masking) needs a longer shared prefix so "mute" never blanks "mutual".
  const threshold = Math.min(target.length, strict ? Math.max(4, target.length - 2) : Math.max(3, target.length - 3));
  let best: { index: number; length: number; score: number } | null = null;
  for (const match of text.matchAll(/[A-Za-zÀ-ÿ]+(?:[-'’][A-Za-zÀ-ÿ]+)*/g)) {
    const token = match[0].toLowerCase();
    let prefix = 0;
    while (prefix < token.length && prefix < target.length && token[prefix] === target[prefix]) prefix++;
    if (prefix < threshold) continue;
    // When neither word contains the other (status vs stature), demand a longer shared stem.
    if (strict && prefix < token.length && prefix < target.length && prefix < Math.min(6, target.length - 1)) continue;
    const score = prefix * 10 + (token.length >= target.length - 1 ? 5 : 0);
    if (!best || score > best.score) best = { index: match.index ?? 0, length: match[0].length, score };
  }
  return best;
}

/** Splits an example sentence around the headword so the UI can emphasize it. */
export function splitExample(example: string, word: string): [string, string, string] | null {
  const hit = findHeadword(example, word);
  if (!hit) return null;
  return [example.slice(0, hit.index), example.slice(hit.index, hit.index + hit.length), example.slice(hit.index + hit.length)];
}

/** Blanks out the headword (and its inflections) so a definition doesn't give away the answer. */
export function maskHeadword(text: string, word: string): string {
  let out = text;
  for (let guard = 0; guard < 5; guard++) {
    const hit = findHeadword(out, word, true);
    if (!hit) break;
    out = out.slice(0, hit.index) + "___" + out.slice(hit.index + hit.length);
  }
  return out;
}
