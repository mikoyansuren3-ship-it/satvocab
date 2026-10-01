import type { StudyMode } from "./store";
import { WORDS, WORD_BY_ID, type Word } from "./words";

export type Direction = "word-to-def" | "def-to-word";

export interface Question {
  /** Id of the word being tested. */
  id: string;
  direction: Direction;
  /** Word ids for the four choices, in display order. */
  options: string[];
  answer: number;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * True for word-family pairs like tenacious/tenacity or empathy/empathetic,
 * which would make a confusing pair of answer choices.
 */
export function related(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const n = Math.min(6, short.length);
  return short.slice(0, n).toLowerCase() === long.slice(0, n).toLowerCase();
}

const STOPWORDS = new Set(
  "a an and the of or to in on for with by as at from into be being is are not no one's someone something someone's oneself up out over about very".split(
    " ",
  ),
);

const norm = (s: string) => s.trim().toLowerCase();
const tokens = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));

const meaningCache = new Map<string, { synonym: Set<string>; all: Set<string> }>();
function meaning(w: Word) {
  let m = meaningCache.get(w.id);
  if (!m) {
    m = { synonym: new Set(tokens(w.synonym)), all: new Set(tokens(`${w.synonym} ${w.definition}`)) };
    meaningCache.set(w.id, m);
  }
  return m;
}

/**
 * True when two words shouldn't appear as choices for the same question
 * because either could reasonably be "the" answer: same word family, the same
 * synonym or definition, overlapping synonyms, or one word used in the other's
 * definition (pernicious: "harmful; exceedingly harmful" vs. harmful).
 */
export function conflicts(a: Word, b: Word): boolean {
  if (a.id === b.id || related(a.word, b.word)) return true;
  if (norm(a.synonym) === norm(b.synonym)) return true;
  if (a.definition && norm(a.definition) === norm(b.definition)) return true;
  const ma = meaning(a);
  const mb = meaning(b);
  const aw = norm(a.word);
  const bw = norm(b.word);
  if (ma.all.has(bw) || mb.all.has(aw)) return true;
  for (const t of ma.synonym) if (mb.synonym.has(t)) return true;
  return false;
}

const buckets = new Map<string, Word[]>();
for (const w of WORDS) {
  for (const key of [`${w.pos}|${w.tier}`, w.pos]) {
    const list = buckets.get(key);
    if (list) list.push(w);
    else buckets.set(key, [w]);
  }
}

/** Adds random non-conflicting words from `pool` to `chosen` until it has `count`. */
function sample(pool: Word[] | undefined, target: Word, chosen: Word[], count: number) {
  if (!pool?.length) return;
  for (let attempt = 0; attempt < 400 && chosen.length < count; attempt++) {
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (!conflicts(w, target) && !chosen.some((c) => conflicts(c, w))) chosen.push(w);
  }
}

function pickDistractors(target: Word, count: number): Word[] {
  const chosen: Word[] = [];
  // Same part of speech (and difficulty, when possible) keeps wrong answers plausible.
  sample(buckets.get(`${target.pos}|${target.tier}`), target, chosen, count);
  sample(buckets.get(target.pos), target, chosen, count);
  sample(WORDS, target, chosen, count);
  return chosen;
}

export function buildQuestion(id: string, direction: Direction): Question {
  const target = WORD_BY_ID.get(id);
  if (!target) throw new Error(`Unknown word: ${id}`);
  const options = shuffle([target, ...pickDistractors(target, 3)].map((w) => w.id));
  return { id, direction, options, answer: options.indexOf(id) };
}

export function buildQuiz(ids: string[], mode: Exclude<StudyMode, "flashcards">): Question[] {
  return ids.map((id) => {
    const direction: Direction =
      mode === "quiz-word" ? "word-to-def" : mode === "quiz-def" ? "def-to-word" : Math.random() < 0.5 ? "word-to-def" : "def-to-word";
    return buildQuestion(id, direction);
  });
}
