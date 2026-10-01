"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, ListChecks, Play, Shuffle, SpellCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeFilters, filterWords, summarize } from "@/lib/filters";
import { LEVELS, LEVEL_LABEL, LEVEL_STYLE, levelOf } from "@/lib/mastery";
import { buildQuiz, shuffle, type Question } from "@/lib/quiz";
import { clearFilters, logSession, setStudy, useAppState, type StudyMode } from "@/lib/store";
import { WORDS } from "@/lib/words";
import { FilterAside, MobileFilterButton } from "../FilterPanel";
import { Flashcards } from "./Flashcards";
import { Quiz } from "./Quiz";
import { SessionSummary } from "./SessionSummary";
import type { SessionResult } from "./types";

type Active =
  | { kind: "flashcards"; run: number; ids: string[]; front: "word" | "definition" }
  | { kind: "quiz"; run: number; mode: StudyMode; questions: Question[] };

const MODES: { mode: StudyMode; title: string; blurb: string; icon: typeof Layers }[] = [
  { mode: "flashcards", title: "Flashcards", blurb: "Flip each card, then mark it “Got it” or “Still learning.”", icon: Layers },
  { mode: "quiz-word", title: "Word → definition", blurb: "See one word and pick its definition from four choices.", icon: ListChecks },
  { mode: "quiz-def", title: "Definition → word", blurb: "See one definition and pick the matching word from four.", icon: SpellCheck },
  { mode: "quiz-mixed", title: "Mixed quiz", blurb: "Both question types, shuffled together.", icon: Shuffle },
];

const SIZES = [10, 20, 30, 50, 0];

export function StudyView() {
  const { filters, progress, saved, study } = useAppState();
  const pool = useMemo(() => filterWords(WORDS, filters, { progress, saved }), [filters, progress, saved]);
  const [active, setActive] = useState<Active | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  const count = study.size === 0 ? pool.length : Math.min(study.size, pool.length);

  const start = (mode: StudyMode, ids: string[]) => {
    if (!ids.length) return;
    const order = study.shuffle ? shuffle(ids) : ids;
    const run = (active?.run ?? 0) + 1;
    setResult(null);
    setActive(
      mode === "flashcards"
        ? { kind: "flashcards", run, ids: order, front: study.front }
        : { kind: "quiz", run, mode, questions: buildQuiz(order, mode) },
    );
    window.scrollTo({ top: 0 });
  };

  const finish = (r: SessionResult) => {
    logSession({ mode: r.mode, total: r.answered, correct: r.correct });
    setActive(null);
    setResult(r);
    window.scrollTo({ top: 0 });
  };

  if (active?.kind === "flashcards") {
    return <Flashcards key={active.run} ids={active.ids} front={active.front} onExit={() => setActive(null)} onDone={finish} />;
  }
  if (active?.kind === "quiz") {
    return <Quiz key={active.run} mode={active.mode} questions={active.questions} onExit={() => setActive(null)} onDone={finish} />;
  }
  if (result) {
    return (
      <SessionSummary
        result={result}
        onRetryMissed={() => start(result.mode, result.missed)}
        onRepeat={() => start(result.mode, result.ids)}
        onDone={() => setResult(null)}
      />
    );
  }

  const levelCounts = LEVELS.map((l) => ({ level: l, n: pool.filter((w) => levelOf(progress[w.id]) === l).length }));

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <FilterAside />
      <div className="min-w-0 flex-1 space-y-5">
        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-7" aria-labelledby="study-title">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 id="study-title" className="text-2xl font-bold tracking-tight">
                Study session
              </h1>
              <p className="mt-1 text-[15px] text-muted">
                <strong className="text-ink">{pool.length}</strong> matching word{pool.length === 1 ? "" : "s"} ·{" "}
                {describeFilters(filters)}
              </p>
            </div>
            <MobileFilterButton />
          </div>

          {pool.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
              {levelCounts.map(({ level, n }) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", LEVEL_STYLE[level].dot)} aria-hidden />
                  {LEVEL_LABEL[level]} <span className="font-semibold text-ink tabular-nums">{n}</span>
                </span>
              ))}
            </div>
          )}

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold tracking-wide text-muted uppercase">Mode</legend>
            <div role="radiogroup" aria-label="Study mode" className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {MODES.map(({ mode, title, blurb, icon: Icon }) => {
                const selected = study.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setStudy({ mode })}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                      selected ? "border-brand bg-brand-soft/60" : "border-line hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        selected ? "bg-brand text-white" : "bg-surface-2 text-muted",
                      )}
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
                aria-labelledby="shuffle-label shuffle-text"
                onClick={() => setStudy({ shuffle: !study.shuffle })}
                className="mt-2 inline-flex items-center gap-3 rounded-full py-1.5"
              >
                <span
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    study.shuffle ? "bg-brand" : "bg-surface-3",
                  )}
                  aria-hidden
                >
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
                <strong className="text-ink">{count}</strong> word{count === 1 ? "" : "s"}
                {count < pool.length ? <> · the first {count} by “{summarize.sort(filters)}”</> : null}
                {study.shuffle ? ", shuffled" : ""}
              </p>
            ) : (
              <p className="text-[15px] text-muted">
                No words match your filters.{" "}
                <button type="button" onClick={clearFilters} className="font-semibold text-brand-text underline underline-offset-2">
                  Clear filters
                </button>
              </p>
            )}
            <button
              type="button"
              disabled={!pool.length}
              onClick={() => start(study.mode, pool.slice(0, count).map((w) => w.id))}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              <Play className="size-4" aria-hidden />
              Start {study.mode === "flashcards" ? "flashcards" : "quiz"}
            </button>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-bold">How mastery works</h2>
            <p className="mt-2 text-[15px] text-muted">
              Every right answer (or “Got it”) moves a word up one step; a miss moves it down two.
            </p>
            <ul className="mt-3 space-y-1.5 text-[15px]">
              <li className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", LEVEL_STYLE.learning.dot)} aria-hidden />
                <strong>Learning</strong> <span className="text-muted">studied, 0 to 1 steps</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", LEVEL_STYLE.almost.dot)} aria-hidden />
                <strong>Almost there</strong> <span className="text-muted">2 to 3 steps</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", LEVEL_STYLE.mastered.dot)} aria-hidden />
                <strong>Mastered</strong> <span className="text-muted">4 or more steps</span>
              </li>
            </ul>
          </section>
          <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-bold">Tips</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-muted">
              <li>Sort by “Weakest first” to drill the words you miss most.</li>
              <li>Pick a word bank to work through one lesson at a time.</li>
              <li>
                Bookmark tricky words, then filter to <em>Saved only</em>.
              </li>
              <li>
                Browse and search every word on the{" "}
                <Link href="/words" className="font-semibold text-brand-text underline underline-offset-2">
                  All words
                </Link>{" "}
                tab.
              </li>
            </ul>
          </section>
        </div>
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
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-2 inline-flex rounded-full bg-surface-2 p-1">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                "min-w-11 rounded-full px-3.5 py-1.5 text-[15px] font-semibold transition-colors",
                selected ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
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
