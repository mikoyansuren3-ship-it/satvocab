"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, ListChecks, Play, Shuffle, SpellCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeFilters, filterWords, summarize } from "@/lib/filters";
import { LEVELS, LEVEL_LABEL, LEVEL_STYLE, levelOf } from "@/lib/mastery";
import { buildQuiz, shuffle } from "@/lib/quiz";
import {
  logRun,
  sessionCache,
  sessionIds,
  sessionMode,
  type ActiveSession,
  type SessionProgress,
  type SessionResult,
} from "@/lib/session";
import { fmt } from "@/lib/format";
import { clearFilters, setFilters, setStudy, useAppState, type StudyMode } from "@/lib/store";
import { TIERS, TIER_INFO, WORDS, tierOf, type Tier } from "@/lib/words";
import { onRadioGroupKeyDown } from "../bits";
import { FilterAside, MobileFilterButton } from "../FilterPanel";
import { Flashcards } from "./Flashcards";
import { Quiz } from "./Quiz";
import { SessionSummary } from "./SessionSummary";

const MODES: { mode: StudyMode; title: string; blurb: string; icon: typeof Layers }[] = [
  { mode: "flashcards", title: "Flashcards", blurb: "Flip each card, then mark it “Got it” or “Still learning.”", icon: Layers },
  { mode: "quiz-word", title: "Word → definition", blurb: "See one word and pick its definition from four choices.", icon: ListChecks },
  { mode: "quiz-def", title: "Definition → word", blurb: "See one definition and pick the matching word from four.", icon: SpellCheck },
  { mode: "quiz-mixed", title: "Mixed quiz", blurb: "Both question types, shuffled together.", icon: Shuffle },
];

const SIZES = [10, 20, 30, 50, 0];

function sessionLength(active: ActiveSession): number {
  return active.kind === "flashcards" ? active.ids.length : active.questions.length;
}

/** Picks up a session left running on another tab; a finished one becomes its summary. */
function restore(): { active: ActiveSession | null; progress: SessionProgress | null; result: SessionResult | null } {
  const { active, progress, result } = sessionCache;
  if (active && progress && progress.index >= sessionLength(active)) {
    const done: SessionResult = {
      mode: sessionMode(active),
      ids: sessionIds(active),
      answered: progress.right.length + progress.missed.length,
      correct: progress.right.length,
      missed: progress.missed,
    };
    return { active: null, progress: null, result: done };
  }
  return { active, progress: active ? progress : null, result: active ? null : result };
}

export function StudyView() {
  const { filters, progress, saved, study } = useAppState();
  const pool = useMemo(() => filterWords(WORDS, filters, { progress, saved }), [filters, progress, saved]);
  const [initial] = useState(restore);
  const [active, setActive] = useState<ActiveSession | null>(initial.active);
  const [result, setResult] = useState<SessionResult | null>(initial.result);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusTitle = useRef(false);

  useEffect(() => {
    // A quiz finished on another tab: make the cache match the summary shown.
    if (!initial.active && initial.result && sessionCache.active) {
      sessionCache.active = null;
      sessionCache.progress = null;
      sessionCache.result = initial.result;
    }
  }, [initial]);

  useEffect(() => {
    if (focusTitle.current && !active && !result) {
      focusTitle.current = false;
      titleRef.current?.focus();
    }
  }, [active, result]);

  const count = study.size === 0 ? pool.length : Math.min(study.size, pool.length);

  const start = (mode: StudyMode, ids: string[]) => {
    if (!ids.length) return;
    const order = study.shuffle ? shuffle(ids) : ids;
    const run = Date.now();
    const next: ActiveSession =
      mode === "flashcards"
        ? { kind: "flashcards", run, ids: order, front: study.front }
        : { kind: "quiz", run, mode, questions: buildQuiz(order, mode) };
    sessionCache.active = next;
    sessionCache.progress = null;
    sessionCache.result = null;
    setResult(null);
    setActive(next);
    window.scrollTo({ top: 0 });
  };

  const saveProgress = (p: SessionProgress) => {
    sessionCache.progress = p;
    // Log as soon as the last question is answered, even if "See results" is never clicked.
    if (active && p.index >= sessionLength(active)) logRun(active, p.right.length + p.missed.length, p.right.length);
  };

  const finish = (r: SessionResult) => {
    if (active) logRun(active, r.answered, r.correct);
    sessionCache.active = null;
    sessionCache.progress = null;
    sessionCache.result = r;
    setActive(null);
    setResult(r);
    window.scrollTo({ top: 0 });
  };

  const backToSetup = () => {
    sessionCache.active = null;
    sessionCache.progress = null;
    sessionCache.result = null;
    focusTitle.current = true;
    setActive(null);
    setResult(null);
  };

  // Only the session that was restored on mount resumes mid-way.
  const resume = active && active.run === initial.active?.run ? initial.progress : null;

  if (active?.kind === "flashcards") {
    return (
      <Flashcards
        key={active.run}
        ids={active.ids}
        front={active.front}
        resume={resume}
        onProgress={saveProgress}
        onExit={backToSetup}
        onDone={finish}
      />
    );
  }
  if (active?.kind === "quiz") {
    return (
      <Quiz
        key={active.run}
        mode={active.mode}
        questions={active.questions}
        resume={resume}
        onProgress={saveProgress}
        onExit={backToSetup}
        onDone={finish}
      />
    );
  }
  if (result) {
    return (
      <SessionSummary
        result={result}
        onRetryMissed={() => start(result.mode, result.missed)}
        onRepeat={() => start(result.mode, result.ids)}
        onDone={backToSetup}
      />
    );
  }

  const levelCounts = LEVELS.map((l) => ({ level: l, n: pool.filter((w) => levelOf(progress[w.id]) === l).length }));
  const tierValue: Tier | "all" | "custom" = filters.tiers.length === 0 ? "all" : filters.tiers.length === 1 ? filters.tiers[0] : "custom";
  const pickTier = (value: Tier | "all") =>
    setFilters(
      value === "all"
        ? { tiers: [] }
        : { tiers: [value], lessons: filters.lessons.filter((l) => tierOf(l) === value) },
    );

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <FilterAside />
      <div className="min-w-0 flex-1 space-y-5">
        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-7" aria-labelledby="study-title">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 id="study-title" ref={titleRef} tabIndex={-1} className="rounded-lg text-2xl font-bold tracking-tight focus:outline-none">
                Study session
              </h1>
              <p className="mt-1 text-[15px] text-muted">
                <strong className="text-ink">{fmt(pool.length)}</strong> matching word{pool.length === 1 ? "" : "s"} ·{" "}
                {describeFilters(filters)}
              </p>
            </div>
            <MobileFilterButton />
          </div>

          {filters.query.trim() && (
            <button
              type="button"
              onClick={() => {
                setFilters({ query: "" });
                titleRef.current?.focus();
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pr-2 pl-3 text-sm font-medium hover:bg-surface-3"
            >
              Search: “{filters.query.trim()}”
              <X className="size-3.5" aria-hidden />
              <span className="sr-only">Clear search</span>
            </button>
          )}

          {pool.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
              {levelCounts.map(({ level, n }) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", LEVEL_STYLE[level].dot)} aria-hidden />
                  {LEVEL_LABEL[level]} <span className="font-semibold text-ink tabular-nums">{fmt(n)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Segmented
              label="Frequency"
              value={tierValue}
              options={[
                { value: "all", label: "All" },
                ...TIERS.map((t) => ({ value: t, label: TIER_INFO[t].short })),
              ]}
              onChange={(v) => pickTier(v as Tier | "all")}
            />
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold tracking-wide text-muted uppercase">Mode</legend>
            <div role="radiogroup" aria-label="Study mode" onKeyDown={onRadioGroupKeyDown} className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {MODES.map(({ mode, title, blurb, icon: Icon }) => {
                const selected = study.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setStudy({ mode })}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                      selected ? "border-brand bg-brand-soft/60" : "border-line hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-brand text-white" : "bg-surface-2 text-muted")}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="mt-0.5 block text-sm text-muted">{blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-5">
            <Segmented
              label="Words per session"
              value={study.size}
              options={SIZES.map((n) => ({ value: n, label: n === 0 ? "All" : String(n) }))}
              onChange={(size) => setStudy({ size })}
            />
            {study.mode === "flashcards" && (
              <Segmented
                label="Card front"
                value={study.front}
                options={[
                  { value: "word", label: "Word" },
                  { value: "definition", label: "Definition" },
                ]}
                onChange={(front) => setStudy({ front })}
              />
            )}
            <div>
              <p id="shuffle-label" className="text-sm font-semibold tracking-wide text-muted uppercase">
                Order
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={study.shuffle}
                aria-labelledby="shuffle-text"
                onClick={() => setStudy({ shuffle: !study.shuffle })}
                className="mt-2 inline-flex items-center gap-3 rounded-full py-1.5"
              >
                <span className={cn("relative h-6 w-11 rounded-full transition-colors", study.shuffle ? "bg-brand" : "bg-surface-3")} aria-hidden>
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      study.shuffle && "translate-x-5",
                    )}
                  />
                </span>
                <span id="shuffle-text" className="text-[15px] font-medium">
                  Shuffle
                </span>
              </button>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            {pool.length > 0 ? (
              <p className="text-[15px] text-muted">
                <strong className="text-ink">{fmt(count)}</strong> word{count === 1 ? "" : "s"}
                {count < pool.length ? <> · the first {count} by “{summarize.sort(filters)}”</> : null}
                {study.shuffle ? ", shuffled" : ""}
              </p>
            ) : (
              <p className="text-[15px] text-muted">
                No words match your filters.{" "}
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    titleRef.current?.focus();
                  }}
                  className="font-semibold text-brand-text underline underline-offset-2"
                >
                  Clear filters
                </button>
              </p>
            )}
            <button
              type="button"
              disabled={!pool.length}
              onClick={() =>
                start(
                  study.mode,
                  pool.slice(0, count).map((w) => w.id),
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              <Play className="size-4" aria-hidden />
              Start {study.mode === "flashcards" ? "flashcards" : "quiz"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "custom";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const anySelected = options.some((o) => o.value === value);
  return (
    <div>
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">{label}</p>
      <div role="radiogroup" aria-label={label} onKeyDown={onRadioGroupKeyDown} className="mt-2 inline-flex rounded-full bg-surface-2 p-1">
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!anySelected && i === 0) ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                "min-w-11 rounded-full px-3.5 py-1.5 text-[15px] font-semibold whitespace-nowrap transition-colors",
                selected
                  ? "bg-surface text-ink shadow-sm dark:bg-brand-soft dark:text-brand-text dark:ring-1 dark:ring-brand"
                  : "text-muted hover:text-ink",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
