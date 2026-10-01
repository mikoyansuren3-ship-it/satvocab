import { LEVELS, LEVEL_LABEL, levelOf, type Level, type WordProgress } from "./mastery";
import {
  CATEGORIES,
  LESSONS,
  POS_OPTIONS,
  TIERS,
  TIER_INFO,
  bankLabel,
  tierOf,
  type Category,
  type Pos,
  type Tier,
  type Word,
} from "./words";

export type SortKey = "weakest" | "az" | "za" | "lesson" | "missed" | "recent";
export type SavedFilter = "all" | "saved" | "unsaved";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "weakest", label: "Weakest first" },
  { value: "lesson", label: "Lesson order" },
  { value: "az", label: "A to Z" },
  { value: "za", label: "Z to A" },
  { value: "missed", label: "Most missed" },
  { value: "recent", label: "Recently studied" },
];

export const SAVED_OPTIONS: { value: SavedFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "saved", label: "Saved only" },
  { value: "unsaved", label: "Not saved" },
];

export interface Filters {
  mastery: Level[];
  tiers: Tier[];
  lessons: string[];
  categories: Category[];
  pos: Pos[];
  saved: SavedFilter;
  sort: SortKey;
  query: string;
}

export const DEFAULT_FILTERS: Filters = {
  mastery: [],
  tiers: [],
  lessons: [],
  categories: [],
  pos: [],
  saved: "all",
  sort: "weakest",
  query: "",
};

export interface FilterContext {
  progress: Record<string, WordProgress>;
  saved: Record<string, true>;
}

type Facet = "mastery" | "tiers" | "lessons" | "categories" | "pos" | "saved";

const normalize = (s: string) => s.toLowerCase().replace(/[’']/g, "'").trim();

/** `skip` ignores one facet so its option counts reflect the other filters. */
export function matches(w: Word, f: Filters, ctx: FilterContext, skip?: Facet): boolean {
  if (skip !== "mastery" && f.mastery.length && !f.mastery.includes(levelOf(ctx.progress[w.id]))) return false;
  if (skip !== "tiers" && f.tiers.length && !f.tiers.includes(w.tier)) return false;
  if (skip !== "lessons" && f.lessons.length && !f.lessons.includes(w.lesson)) return false;
  if (skip !== "categories" && f.categories.length && !f.categories.includes(w.category)) return false;
  if (skip !== "pos" && f.pos.length && !f.pos.includes(w.pos)) return false;
  if (skip !== "saved" && f.saved !== "all") {
    const isSaved = Boolean(ctx.saved[w.id]);
    if (f.saved === "saved" ? !isSaved : isSaved) return false;
  }
  const q = normalize(f.query);
  if (q && ![w.word, w.synonym, w.definition].some((field) => normalize(field).includes(q))) return false;
  return true;
}

export function filterWords(words: Word[], f: Filters, ctx: FilterContext): Word[] {
  return sortWords(
    words.filter((w) => matches(w, f, ctx)),
    f.sort,
    ctx,
    f.query,
  );
}

// A fixed locale keeps prerendered and client order identical.
const collator = new Intl.Collator("en");
const byWord = (a: Word, b: Word) => collator.compare(a.word, b.word);
const byOrder = (a: Word, b: Word) => a.order - b.order;

/**
 * Weakness rank: studied words still in box 0 (missed more than they've been
 * right lately) come first, then never-seen words, then box 1, 2 ... mastered.
 */
function weakRank(p: WordProgress | undefined): number {
  return p ? p.box : 0.5;
}

export function sortWords(list: Word[], sort: SortKey, ctx: FilterContext, query = ""): Word[] {
  const p = (w: Word) => ctx.progress[w.id];
  const sorted = [...list];
  switch (sort) {
    case "az":
      sorted.sort(byWord);
      break;
    case "za":
      sorted.sort((a, b) => byWord(b, a));
      break;
    case "lesson":
      sorted.sort(byOrder);
      break;
    case "missed":
      sorted.sort((a, b) => (p(b)?.wrong ?? 0) - (p(a)?.wrong ?? 0) || accuracy(p(a)) - accuracy(p(b)) || byOrder(a, b));
      break;
    case "recent":
      sorted.sort((a, b) => (p(b)?.last ?? 0) - (p(a)?.last ?? 0) || byOrder(a, b));
      break;
    case "weakest":
      // Ties among studied words: lowest accuracy, then most recently reviewed.
      // Never-seen words keep study order, so new students start with Lesson 1.1.
      sorted.sort(
        (a, b) =>
          weakRank(p(a)) - weakRank(p(b)) ||
          accuracy(p(a)) - accuracy(p(b)) ||
          (p(b)?.last ?? 0) - (p(a)?.last ?? 0) ||
          byOrder(a, b),
      );
      break;
  }
  const q = normalize(query);
  if (!q) return sorted;
  // When searching, headword matches float above definition-only matches.
  const rank = (w: Word) => {
    const word = normalize(w.word);
    return word === q ? 0 : word.startsWith(q) ? 1 : word.includes(q) ? 2 : 3;
  };
  return sorted
    .map((w, i) => ({ w, i, r: rank(w) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.w);
}

function accuracy(p: WordProgress | undefined): number {
  return p && p.seen ? p.correct / p.seen : 1;
}

export interface FacetCounts {
  mastery: Record<Level, number>;
  tiers: Record<Tier, number>;
  lessons: Record<string, number>;
  categories: Record<Category, number>;
  pos: Record<Pos, number>;
  saved: Record<SavedFilter, number>;
}

export function facetCounts(words: Word[], f: Filters, ctx: FilterContext): FacetCounts {
  const counts: FacetCounts = {
    mastery: Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>,
    tiers: Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>,
    lessons: Object.fromEntries(LESSONS.map((l) => [l, 0])),
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>,
    pos: Object.fromEntries(POS_OPTIONS.map((o) => [o.value, 0])) as Record<Pos, number>,
    saved: { all: 0, saved: 0, unsaved: 0 },
  };
  // A level's count is what selecting it would show: picking a level keeps only
  // that level's selected word banks (or all of its banks if none are selected).
  const byTier = Object.fromEntries(
    TIERS.map((t) => [t, { ...f, lessons: f.lessons.filter((l) => tierOf(l) === t) }]),
  ) as Record<Tier, Filters>;
  for (const w of words) {
    if (matches(w, f, ctx, "mastery")) counts.mastery[levelOf(ctx.progress[w.id])]++;
    if (matches(w, byTier[w.tier], ctx, "tiers")) counts.tiers[w.tier]++;
    if (matches(w, f, ctx, "lessons")) counts.lessons[w.lesson]++;
    if (matches(w, f, ctx, "categories")) counts.categories[w.category]++;
    if (matches(w, f, ctx, "pos")) counts.pos[w.pos]++;
    if (matches(w, f, ctx, "saved")) {
      counts.saved.all++;
      counts.saved[ctx.saved[w.id] ? "saved" : "unsaved"]++;
    }
  }
  return counts;
}

/** Number of filter sections in use (search is shown separately). */
export function activeFilterCount(f: Filters): number {
  return (
    (f.mastery.length ? 1 : 0) +
    (f.tiers.length ? 1 : 0) +
    (f.lessons.length ? 1 : 0) +
    (f.categories.length ? 1 : 0) +
    (f.pos.length ? 1 : 0) +
    (f.saved !== "all" ? 1 : 0)
  );
}

export function isUnfiltered(f: Filters): boolean {
  return activeFilterCount(f) === 0 && !f.query.trim();
}

function listSummary(values: string[], all: string, plural: string, label = (v: string) => v): string {
  if (!values.length) return all;
  if (values.length === 1) return label(values[0]);
  return `${values.length} ${plural}`;
}

const posLabel = (v: string) => POS_OPTIONS.find((o) => o.value === v)?.label ?? v;

export const summarize = {
  mastery: (f: Filters) => listSummary(f.mastery, "All words", "selected", (v) => LEVEL_LABEL[v as Level]),
  tiers: (f: Filters) => listSummary(sortTiers(f.tiers), "All frequencies", "selected", (v) => TIER_INFO[v as Tier].label),
  lessons: (f: Filters) => listSummary(sortLessons(f.lessons), "All banks", "banks", bankLabel),
  categories: (f: Filters) => listSummary(f.categories, "All categories", "categories"),
  pos: (f: Filters) => listSummary(f.pos, "All", "selected", posLabel),
  saved: (f: Filters) => SAVED_OPTIONS.find((o) => o.value === f.saved)?.label ?? "Everything",
  sort: (f: Filters) => SORT_OPTIONS.find((o) => o.value === f.sort)?.label ?? "",
};

export function sortLessons(lessons: string[]): string[] {
  return [...lessons].sort((a, b) => LESSONS.indexOf(a) - LESSONS.indexOf(b));
}

function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b));
}

/** Short human description of the active filters, e.g. "Learning · Lesson 1.3". */
export function describeFilters(f: Filters): string {
  const parts: string[] = [];
  if (f.mastery.length) parts.push(f.mastery.map((l) => LEVEL_LABEL[l]).join(" or "));
  if (f.tiers.length) parts.push(sortTiers(f.tiers).map((t) => TIER_INFO[t].label).join(" or "));
  if (f.lessons.length)
    parts.push(f.lessons.length <= 3 ? sortLessons(f.lessons).map(bankLabel).join(", ") : `${f.lessons.length} word banks`);
  if (f.categories.length) parts.push(f.categories.length <= 2 ? f.categories.join(", ") : `${f.categories.length} categories`);
  if (f.pos.length) parts.push(f.pos.map((v) => posLabel(v).toLowerCase()).join(" or "));
  if (f.saved === "saved") parts.push("saved");
  if (f.saved === "unsaved") parts.push("not saved");
  if (f.query.trim()) parts.push(`matching “${f.query.trim()}”`);
  return parts.length ? parts.join(" · ") : "everything in your library";
}
