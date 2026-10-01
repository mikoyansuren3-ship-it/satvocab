"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_FILTERS, SAVED_OPTIONS, SORT_OPTIONS, type Filters } from "./filters";
import { LEVELS, MAX_BOX, nextProgress, type WordProgress } from "./mastery";
import { CATEGORIES, LESSONS, POS_OPTIONS, WORD_BY_ID } from "./words";

export type StudyMode = "flashcards" | "quiz-word" | "quiz-def" | "quiz-mixed";

export interface StudySettings {
  mode: StudyMode;
  /** Number of words per session; 0 means every matching word. */
  size: number;
  shuffle: boolean;
  front: "word" | "definition";
}

export interface SessionRecord {
  t: number;
  mode: StudyMode;
  total: number;
  correct: number;
}

export interface AppState {
  progress: Record<string, WordProgress>;
  saved: Record<string, true>;
  filters: Filters;
  study: StudySettings;
  history: SessionRecord[];
  /** Local dates (YYYY-MM-DD) with at least one review, for the streak. */
  days: string[];
}

const KEY = "sat-vocab:v1";
const MODES: StudyMode[] = ["flashcards", "quiz-word", "quiz-def", "quiz-mixed"];

export const DEFAULT_STUDY: StudySettings = { mode: "flashcards", size: 20, shuffle: true, front: "word" };

export const DEFAULT_STATE: AppState = {
  progress: {},
  saved: {},
  filters: DEFAULT_FILTERS,
  study: DEFAULT_STUDY,
  history: [],
  days: [],
};

let state: AppState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const pick = <T>(values: readonly T[], input: unknown): T[] =>
  Array.isArray(input) ? values.filter((v) => input.includes(v)) : [];

/** Coerces anything read from storage (or an imported file) into a valid state. */
function sanitize(input: unknown): AppState {
  if (!isObject(input)) return DEFAULT_STATE;

  const progress: Record<string, WordProgress> = {};
  if (isObject(input.progress)) {
    for (const [id, p] of Object.entries(input.progress)) {
      if (!WORD_BY_ID.has(id) || !isObject(p)) continue;
      const seen = Math.max(0, Math.round(num(p.seen)));
      if (!seen) continue;
      progress[id] = {
        box: Math.min(MAX_BOX, Math.max(0, Math.round(num(p.box)))),
        seen,
        correct: Math.max(0, Math.round(num(p.correct))),
        wrong: Math.max(0, Math.round(num(p.wrong))),
        last: num(p.last),
      };
    }
  }

  const saved: Record<string, true> = {};
  if (isObject(input.saved)) {
    for (const [id, v] of Object.entries(input.saved)) if (v && WORD_BY_ID.has(id)) saved[id] = true;
  }

  const f = isObject(input.filters) ? input.filters : {};
  const filters: Filters = {
    mastery: pick(LEVELS, f.mastery),
    lessons: pick(LESSONS, f.lessons),
    categories: pick(CATEGORIES, f.categories),
    pos: pick(
      POS_OPTIONS.map((o) => o.value),
      f.pos,
    ),
    saved: SAVED_OPTIONS.some((o) => o.value === f.saved) ? (f.saved as Filters["saved"]) : "all",
    sort: SORT_OPTIONS.some((o) => o.value === f.sort) ? (f.sort as Filters["sort"]) : "weakest",
    query: typeof f.query === "string" ? f.query.slice(0, 100) : "",
  };

  const s = isObject(input.study) ? input.study : {};
  const study: StudySettings = {
    mode: MODES.includes(s.mode as StudyMode) ? (s.mode as StudyMode) : DEFAULT_STUDY.mode,
    size: [0, 10, 20, 30, 50].includes(num(s.size, -1)) ? num(s.size) : DEFAULT_STUDY.size,
    shuffle: typeof s.shuffle === "boolean" ? s.shuffle : DEFAULT_STUDY.shuffle,
    front: s.front === "definition" ? "definition" : "word",
  };

  const history: SessionRecord[] = Array.isArray(input.history)
    ? input.history
        .filter(isObject)
        .filter((h) => MODES.includes(h.mode as StudyMode))
        .map((h) => ({
          t: num(h.t),
          mode: h.mode as StudyMode,
          total: Math.max(0, num(h.total)),
          correct: Math.max(0, num(h.correct)),
        }))
        .slice(-100)
    : [];

  const days = Array.isArray(input.days)
    ? input.days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-730)
    : [];

  return { progress, saved, filters, study, history, days };
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = sanitize(JSON.parse(raw));
  } catch {
    // Storage unavailable (private mode, blocked cookies): keep in-memory state.
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or availability errors; progress stays in memory this visit.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return;
  try {
    state = e.newValue ? sanitize(JSON.parse(e.newValue)) : DEFAULT_STATE;
  } catch {
    return;
  }
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

const getServerSnapshot = () => DEFAULT_STATE;

function update(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  persist();
  emit();
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** False during prerender and hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- actions ---------------------------------------------------------------

export function recordAnswer(id: string, correct: boolean) {
  const now = Date.now();
  const today = dayKey(new Date(now));
  update((s) => ({
    ...s,
    progress: { ...s.progress, [id]: nextProgress(s.progress[id], correct, now) },
    days: s.days.includes(today) ? s.days : [...s.days, today].slice(-730),
  }));
}

export function toggleSaved(id: string) {
  update((s) => {
    const saved = { ...s.saved };
    if (saved[id]) delete saved[id];
    else saved[id] = true;
    return { ...s, saved };
  });
}

export function setFilters(patch: Partial<Filters>) {
  update((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
}

/** Clears every filter but keeps the chosen sort order. */
export function clearFilters() {
  update((s) => ({ ...s, filters: { ...DEFAULT_FILTERS, sort: s.filters.sort } }));
}

export function setStudy(patch: Partial<StudySettings>) {
  update((s) => ({ ...s, study: { ...s.study, ...patch } }));
}

export function logSession(record: Omit<SessionRecord, "t">) {
  if (!record.total) return;
  update((s) => ({ ...s, history: [...s.history, { ...record, t: Date.now() }].slice(-100) }));
}

export function resetProgress() {
  update((s) => ({ ...s, progress: {}, history: [], days: [] }));
}

export function exportState(): string {
  load();
  return JSON.stringify({ app: "sat-vocab", version: 1, exportedAt: new Date().toISOString(), ...state }, null, 1);
}

/** Replaces progress, saved words and history with an exported file. */
export function importState(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObject(parsed) || (!isObject(parsed.progress) && !isObject(parsed.saved))) return false;
    const next = sanitize(parsed);
    update((s) => ({ ...next, filters: s.filters, study: s.study }));
    return true;
  } catch {
    return false;
  }
}
