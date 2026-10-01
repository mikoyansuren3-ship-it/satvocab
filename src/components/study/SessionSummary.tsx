"use client";

import { useEffect, useRef } from "react";
import { RotateCcw, Shuffle, Trophy } from "lucide-react";
import { levelOf } from "@/lib/mastery";
import { useAppState } from "@/lib/store";
import { WORD_BY_ID } from "@/lib/words";
import { MasteryBadge, SaveButton } from "../bits";
import { MODE_LABEL, type SessionResult } from "./types";

function headline(pct: number): string {
  if (pct >= 90) return "Outstanding!";
  if (pct >= 75) return "Nice work!";
  if (pct >= 50) return "Good progress";
  return "Keep at it";
}

export function SessionSummary({
  result,
  onRetryMissed,
  onRepeat,
  onDone,
}: {
  result: SessionResult;
  onRetryMissed: () => void;
  onRepeat: () => void;
  onDone: () => void;
}) {
  const { progress, saved } = useAppState();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const { answered, correct, missed, mode } = result;
  const pct = answered ? Math.round((correct / answered) * 100) : 0;
  const isFlash = mode === "flashcards";

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-3xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10" aria-labelledby="summary-title">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-text">
          <Trophy className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-semibold tracking-wide text-muted uppercase">{MODE_LABEL[mode]} complete</p>
        <h1 id="summary-title" ref={headingRef} tabIndex={-1} className="mt-1 rounded-lg text-3xl font-bold tracking-tight focus:outline-none">
          {headline(pct)}
        </h1>
        <p className="mt-3 text-lg text-muted">
          {isFlash ? "You knew " : "You got "}
          <strong className="text-ink">{correct}</strong> of <strong className="text-ink">{answered}</strong>
          {isFlash ? " cards" : " right"} ({pct}%)
          {answered < result.ids.length && <> · ended early, {result.ids.length - answered} skipped</>}
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {missed.length > 0 && (
            <button
              type="button"
              onClick={onRetryMissed}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold whitespace-nowrap text-white hover:bg-brand-hover"
            >
              <RotateCcw className="size-4" aria-hidden />
              Retry {missed.length} missed
            </button>
          )}
          <button
            type="button"
            onClick={onRepeat}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-3 font-semibold whitespace-nowrap hover:bg-surface-2"
          >
            <Shuffle className="size-4" aria-hidden />
            Same words again
          </button>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 font-semibold whitespace-nowrap hover:bg-surface-2"
          >
            Back to study setup
          </button>
        </div>
      </section>

      {missed.length > 0 && (
        <section className="mt-6" aria-labelledby="missed-title">
          <h2 id="missed-title" className="text-lg font-bold">
            {isFlash ? "Still learning" : "Words you missed"}
          </h2>
          <ul className="mt-3 space-y-2">
            {missed.map((id) => {
              const w = WORD_BY_ID.get(id);
              if (!w) return null;
              return (
                <li key={id} className="flex items-center gap-3 rounded-2xl bg-surface-2 py-3 pr-3 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-bold">{w.word}</span>
                      <span className="text-sm text-muted italic">{w.pos}</span>
                      <MasteryBadge level={levelOf(progress[id])} className="self-center" />
                    </p>
                    <p className="text-[15px] text-muted">
                      <span className="font-medium text-ink/85">{w.synonym}</span>
                      {w.definition && <> · {w.definition}</>}
                    </p>
                  </div>
                  <SaveButton id={id} word={w.word} saved={Boolean(saved[id])} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
