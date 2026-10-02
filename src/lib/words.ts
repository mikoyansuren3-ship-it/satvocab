import data from "@/data/words.json";

export type Pos = "n." | "v." | "adj." | "adv.";

/** The three source lists, from most to least common on past SATs. */
export type Tier = "top" | "mid" | "low";
export const TIERS: Tier[] = ["top", "mid", "low"];

/**
 * How hard a word's SAT meaning is, from published data on which words people know
 * and the school grade at which students learn each meaning (see data/difficulty.json).
 */
export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string }> = {
  easy: { label: "Easy", blurb: "Middle school level" },
  medium: { label: "Medium", blurb: "High school level" },
  hard: { label: "Hard", blurb: "College level" },
};

export interface Word {
  id: string;
  word: string;
  tier: Tier;
  difficulty: Difficulty;
  /** Position in study order: easiest first (Easy, then Medium, then Hard, each by score). */
  order: number;
  synonym: string;
  definition: string;
  pos: Pos;
  example: string;
}

/** Same rule as scripts/build-words.mjs, which checks ids stay unique. */
export function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Row = [
  word: string,
  tier: number,
  synonym: string,
  definition: string,
  pos: string,
  example: string,
  difficulty: number,
];
const raw = data as unknown as { rows: Row[] };

export const WORDS: Word[] = raw.rows.map(([word, tier, synonym, definition, pos, example, difficulty], order) => ({
  id: slugify(word),
  word,
  tier: TIERS[tier] ?? "low",
  difficulty: DIFFICULTIES[difficulty] ?? "medium",
  order,
  synonym,
  definition,
  pos: pos as Pos,
  example,
}));
export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export const TIER_INFO: Record<Tier, { label: string; short: string; blurb: string }> = {
  top: { label: "High frequency", short: "High", blurb: "Most common on SATs" },
  mid: { label: "Mid frequency", short: "Mid", blurb: "Common on SATs" },
  low: { label: "Low frequency", short: "Low", blurb: "Less common on SATs" },
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

/**
 * Strict match used for masking answers: does `token` share the headword's
 * root closely enough to give the answer away?
 */
function isSameRoot(token: string, target: string, prefix: number): boolean {
  // The headword is a prefix of the token: predict -> prediction, vex -> vexed.
  if (prefix === target.length) return true;
  // The token is the headword's root: harm -> harmful, neutral -> neutralize.
  if (prefix === token.length) return token.length >= 4 && token.length >= target.length * 0.45;
  if (prefix < 4) return false; // mute vs mutual
  // Root that drops a final e or y: malice -> malicious, mutiny -> mutinous.
  const rest = token.slice(prefix);
  if (rest === "e" || rest === "y") return true;
  // Otherwise a long shared stem (repetitive / repetitious, toxic / toxin), but not
  // status vs stature, and not a short word inside a long one (chary / characterized).
  return prefix >= Math.min(6, target.length - 1) && !(token.length > target.length + 3 && prefix < 5);
}

/** Index of the token in `text` that is the headword or an inflection of it (e.g. "fostered"). */
function findHeadword(text: string, word: string, strict = false): { index: number; length: number } | null {
  const target = word.toLowerCase();
  const threshold = Math.min(target.length, Math.max(3, target.length - 3));
  let best: { index: number; length: number; score: number } | null = null;
  for (const match of text.matchAll(/[A-Za-zÀ-ÿ]+(?:[-'’][A-Za-zÀ-ÿ]+)*/g)) {
    const token = match[0].toLowerCase();
    let prefix = 0;
    while (prefix < token.length && prefix < target.length && token[prefix] === target[prefix]) prefix++;
    if (strict ? !isSameRoot(token, target, prefix) : prefix < threshold) continue;
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
