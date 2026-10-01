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

const sameMeaning = (a: Word, b: Word) => a.synonym.trim().toLowerCase() === b.synonym.trim().toLowerCase();

function pickDistractors(target: Word, count: number): Word[] {
  const eligible = WORDS.filter((w) => w.id !== target.id && !related(w.word, target.word) && !sameMeaning(w, target));
  // Same part of speech first so wrong answers stay plausible.
  const ordered = [...shuffle(eligible.filter((w) => w.pos === target.pos)), ...shuffle(eligible.filter((w) => w.pos !== target.pos))];
  const chosen: Word[] = [];
  for (const w of ordered) {
    if (chosen.length === count) break;
    if (chosen.some((c) => related(c.word, w.word) || sameMeaning(c, w))) continue;
    chosen.push(w);
  }
  return chosen;
}

export function buildQuestion(id: string, direction: Direction): Question {
  const target = WORD_BY_ID.get(id);
  if (!target) throw new Error(`Unknown word: ${id}`);
  const options = shuffle([target, ...pickDistractors(target, 3)].map((w) => w.id));
  return { id, direction, options, answer: options.indexOf(id) };
}

export function buildQuiz(ids: string[], mode: Exclude<StudyMode, "flashcards">): Question[] {
  return ids.map((id, i) => {
    const direction: Direction =
      mode === "quiz-word" ? "word-to-def" : mode === "quiz-def" ? "def-to-word" : Math.random() < 0.5 || i < 0 ? "word-to-def" : "def-to-word";
    return buildQuestion(id, direction);
  });
}
