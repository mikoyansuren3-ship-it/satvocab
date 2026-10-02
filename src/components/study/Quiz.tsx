"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleCheck, CircleX, Pause, Timer, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { levelOf } from "@/lib/mastery";
import type { Question } from "@/lib/quiz";
import { recordAnswer, useAppState, type StudyMode } from "@/lib/store";
import { fmt } from "@/lib/format";
import { WORD_BY_ID, maskHeadword, type Word } from "@/lib/words";
import { Example, MasteryBadge, ProgressBar, SaveButton } from "../bits";
import { ignoreKey, type SessionProgress, type SessionResult } from "./types";

const LETTERS = ["A", "B", "C", "D"];
/** The "choice" recorded when a question's time runs out. */
const TIMED_OUT = -1;

export function Quiz({
  mode,
  questions,
  timer,
  resume,
  onProgress,
  onPause,
  onExit,
  onDone,
}: {
  mode: StudyMode;
  questions: Question[];
  /** Seconds allowed per question; 0 means no time limit. */
  timer: number;
  resume?: SessionProgress | null;
  onProgress: (p: SessionProgress) => void;
  /** Sets the session aside to finish later, from where it stands now. */
  onPause: (p: SessionProgress) => void;
  onExit: () => void;
  onDone: (result: SessionResult) => void;
}) {
  const { saved, progress } = useAppState();
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [choice, setChoice] = useState<number | null>(null);
  const [right, setRight] = useState<string[]>(resume?.right ?? []);
  const [missed, setMissed] = useState<string[]>(resume?.missed ?? []);
  const nextRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);

  const q = questions[index];
  const word = WORD_BY_ID.get(q.id) as Word;
  const answered = choice !== null;
  const timedOut = choice === TIMED_OUT;
  const isCorrect = choice === q.answer;
  const toWord = q.direction === "def-to-word";
  const ids = questions.map((x) => x.id);

  const finish = (r: string[], m: string[]) =>
    onDone({ mode, ids, answered: r.length + m.length, correct: r.length, missed: m });

  const answer = (i: number) => {
    if (answered || i < TIMED_OUT || i >= q.options.length) return;
    const ok = i === q.answer;
    const nextRight = ok ? [...right, q.id] : right;
    const nextMissed = ok ? missed : [...missed, q.id];
    setChoice(i);
    setRight(nextRight);
    setMissed(nextMissed);
    recordAnswer(q.id, ok);
    // An answered question counts as done if the student leaves and comes back.
    onProgress({ index: index + 1, right: nextRight, missed: nextMissed });
  };

  const next = () => {
    if (!answered) return;
    if (index + 1 >= questions.length) {
      finish(right, missed);
      return;
    }
    setIndex(index + 1);
    setChoice(null);
  };

  const end = () => (right.length + missed.length ? finish(right, missed) : onExit());
  // An answered question counts as done, the same as for a reload.
  const pause = () => onPause({ index: answered ? index + 1 : index, right, missed });

  useEffect(() => {
    promptRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    if (!answered) return;
    const next = nextRef.current;
    next?.focus({ preventScroll: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    next?.closest("section")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [answered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e)) return;
      const k = e.key.toLowerCase();
      const pick = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : ["a", "b", "c", "d"].indexOf(k);
      if (pick >= 0 && !answered) {
        e.preventDefault();
        answer(pick);
      } else if ((e.key === "Enter" || e.key === "ArrowRight") && answered) {
        e.preventDefault();
        next();
      } else if (e.key === "Escape") {
        end();
      } else if (k === "p") {
        e.preventDefault();
        pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const chosenWord = choice !== null && !timedOut ? WORD_BY_ID.get(q.options[choice]) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={end}
            aria-label="End quiz"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[15px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
            End<span className="hidden sm:inline"> quiz</span>
          </button>
          <button
            type="button"
            onClick={pause}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[15px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"
          >
            <Pause className="size-4" aria-hidden />
            Pause
          </button>
        </div>
        <span className="ml-auto text-sm font-semibold tabular-nums text-muted">
          Question {fmt(index + 1)} of {fmt(questions.length)}
          <span className="mx-2 text-faint">·</span>
          <span className="text-brand-text">{right.length} right</span>
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={index + (answered ? 1 : 0)} max={questions.length} label="Quiz progress" />
      </div>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8" aria-labelledby="quiz-prompt">
        {timer > 0 && (
          // Keyed per question, so each one starts with the full time.
          <QuestionTimer key={index} seconds={timer} running={!answered} onExpire={() => answer(TIMED_OUT)} />
        )}
        <p className="text-sm font-semibold tracking-wide text-muted uppercase">
          {toWord ? "Which word matches this definition?" : "What does this word mean?"}
        </p>
        <h2 id="quiz-prompt" ref={promptRef} tabIndex={-1} className="mt-3 rounded-lg focus:outline-none">
          {toWord ? (
            <>
              <span className="block text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
                {maskHeadword(word.synonym, word.word)}
              </span>
              {word.definition && (
                <span className="mt-2 block text-lg font-normal text-muted">{maskHeadword(word.definition, word.word)}</span>
              )}
              <span className="mt-2 block text-base font-normal text-muted italic">{word.pos}</span>
            </>
          ) : (
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="min-w-0 text-[clamp(1.875rem,9vw,3rem)] leading-tight font-bold tracking-tight [overflow-wrap:anywhere]">
                {word.word}
              </span>
              <span className="text-lg font-normal text-muted italic">{word.pos}</span>
            </span>
          )}
        </h2>

        <ol className="mt-6 space-y-2.5" aria-label="Answer choices">
          {q.options.map((optId, i) => {
            const opt = WORD_BY_ID.get(optId) as Word;
            // Every option hides its own word, so a blank never singles out the answer.
            const optSynonym = maskHeadword(opt.synonym, opt.word);
            const optDefinition = opt.definition ? maskHeadword(opt.definition, opt.word) : "";
            const isAnswer = i === q.answer;
            const isChoice = i === choice;
            const state = !answered ? "idle" : isAnswer ? "right" : isChoice ? "wrong" : "dim";
            return (
              <li key={optId}>
                <button
                  type="button"
                  onClick={() => answer(i)}
                  disabled={answered}
                  aria-label={`${LETTERS[i]}: ${toWord ? opt.word : `${optSynonym}. ${optDefinition}`}${
                    state === "right" ? " (correct answer)" : state === "wrong" ? " (your answer, incorrect)" : ""
                  }`}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                    state === "idle" && "border-line bg-surface hover:border-brand/60 hover:bg-surface-2",
                    state === "right" && "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/50",
                    state === "wrong" && "border-red-500 bg-red-50 dark:bg-red-950/50",
                    state === "dim" && "border-line opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold",
                      state === "right"
                        ? "bg-green-600 text-white"
                        : state === "wrong"
                          ? "bg-red-500 text-white"
                          : "bg-surface-2 text-muted",
                    )}
                    aria-hidden
                  >
                    {state === "right" ? <CircleCheck className="size-4" /> : state === "wrong" ? <CircleX className="size-4" /> : LETTERS[i]}
                  </span>
                  {toWord ? (
                    <span className="self-center text-lg font-semibold">{opt.word}</span>
                  ) : (
                    <span className="min-w-0">
                      <span className="font-semibold">{optSynonym}</span>
                      {optDefinition && <span className="block text-[15px] text-muted">{optDefinition}</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div aria-live="polite">
        {answered && (
          <section
            className={cn(
              "mt-4 rounded-3xl border-2 p-5 sm:p-6",
              isCorrect ? "border-green-600/40 bg-green-50/60 dark:bg-green-950/30" : "border-red-500/40 bg-red-50/60 dark:bg-red-950/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn("text-lg font-bold", isCorrect ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                  {isCorrect ? "Correct!" : timedOut ? "Time’s up." : "Not quite."}
                </p>
                {timedOut && <p className="mt-1 text-[15px] text-muted">The right answer is marked above.</p>}
                {!isCorrect && chosenWord && (
                  <p className="mt-1 text-[15px] text-muted">
                    {toWord ? (
                      <>
                        You picked <strong className="text-ink">{chosenWord.word}</strong>, which means “{chosenWord.synonym}.”
                      </>
                    ) : (
                      <>
                        That definition belongs to <strong className="text-ink">{chosenWord.word}</strong>.
                      </>
                    )}
                  </p>
                )}
              </div>
              <SaveButton id={word.id} word={word.word} saved={Boolean(saved[word.id])} className="-mt-1 -mr-1" />
            </div>
            <div className="mt-4 rounded-2xl bg-surface p-4">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xl font-bold">{word.word}</span>
                <span className="text-muted italic">{word.pos}</span>
                <MasteryBadge level={levelOf(progress[word.id])} className="self-center" />
              </p>
              <p className="mt-1">
                <span className="font-semibold">{word.synonym}</span>
                {word.definition && <span className="text-muted"> · {word.definition}</span>}
              </p>
              <Example text={word.example} word={word.word} className="mt-3 text-[15px] leading-relaxed" />
            </div>
            <button
              ref={nextRef}
              type="button"
              onClick={next}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {index + 1 >= questions.length ? "See results" : "Next question"}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </section>
        )}
      </div>
      <p className="mt-4 hidden text-center text-sm text-faint sm:block">
        Press 1 to 4 (or A to D) to answer · Enter for the next question · P pauses · Esc ends
      </p>
    </div>
  );
}

/** Counts down one question's time; calls onExpire when it reaches zero, and stops once the question is answered. */
function QuestionTimer({ seconds, running, onExpire }: { seconds: number; running: boolean; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds * 1000);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    if (!running) return;
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const ms = Math.max(0, deadline - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        expire.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, seconds]);

  const secs = Math.ceil(left / 1000);
  const low = secs <= Math.min(5, Math.ceil(seconds / 4));
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        role="timer"
        aria-label={`${secs} second${secs === 1 ? "" : "s"} left`}
        className={cn(
          "inline-flex w-14 shrink-0 items-center gap-1 text-sm font-semibold tabular-nums",
          low ? "text-red-600 dark:text-red-400" : "text-muted",
        )}
      >
        <Timer className="size-4" aria-hidden />
        {secs}s
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={cn("h-full rounded-full", low ? "bg-red-500" : "bg-brand")} style={{ width: `${(left / (seconds * 1000)) * 100}%` }} />
      </div>
    </div>
  );
}
