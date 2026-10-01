"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { recordAnswer, useAppState } from "@/lib/store";
import { TIER_INFO, WORD_BY_ID, bankLabel, type Word } from "@/lib/words";
import { CategoryPill, Example, ProgressBar, SaveButton } from "../bits";
import { ignoreKey, type SessionProgress, type SessionResult } from "./types";

export function Flashcards({
  ids,
  front,
  resume,
  onProgress,
  onExit,
  onDone,
}: {
  ids: string[];
  front: "word" | "definition";
  resume?: SessionProgress | null;
  onProgress: (p: SessionProgress) => void;
  onExit: () => void;
  onDone: (result: SessionResult) => void;
}) {
  const { saved } = useAppState();
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<string[]>(resume?.right ?? []);
  const [missed, setMissed] = useState<string[]>(resume?.missed ?? []);
  const cardRef = useRef<HTMLButtonElement>(null);
  // Index of the last graded card, so a double-click can't grade the next, unseen card.
  const gradedRef = useRef(-1);
  const word = WORD_BY_ID.get(ids[index]) as Word;

  // Keep focus on the card so Space/Enter flip it rather than re-pressing a grade button.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  const finish = (k: string[], m: string[]) =>
    onDone({ mode: "flashcards", ids, answered: k.length + m.length, correct: k.length, missed: m });

  const grade = (ok: boolean) => {
    if (gradedRef.current === index) return;
    gradedRef.current = index;
    recordAnswer(word.id, ok);
    const nextKnown = ok ? [...known, word.id] : known;
    const nextMissed = ok ? missed : [...missed, word.id];
    if (index + 1 >= ids.length) {
      finish(nextKnown, nextMissed);
      return;
    }
    setKnown(nextKnown);
    setMissed(nextMissed);
    setIndex(index + 1);
    setFlipped(false);
    onProgress({ index: index + 1, right: nextKnown, missed: nextMissed });
  };

  const end = () => (known.length + missed.length ? finish(known, missed) : onExit());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e)) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1" || e.key === "ArrowLeft") {
        e.preventDefault();
        grade(false);
      } else if (e.key === "2" || e.key === "ArrowRight") {
        e.preventDefault();
        grade(true);
      } else if (e.key === "Escape") {
        end();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showWordFirst = front === "word";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={end}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[15px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
          End session
        </button>
        <span className="text-sm font-semibold text-muted tabular-nums">
          Card {index + 1} of {ids.length}
        </span>
        <SaveButton id={word.id} word={word.word} saved={Boolean(saved[word.id])} />
      </div>
      <div className="mt-2">
        <ProgressBar value={index} max={ids.length} label="Session progress" />
      </div>

      <div className="mt-6 [perspective:1600px]">
        <button
          key={index}
          ref={cardRef}
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-describedby="flip-hint"
          className={cn(
            "relative grid w-full grid-cols-1 rounded-3xl text-left transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          <Face hidden={flipped}>{showWordFirst ? <WordSide word={word} /> : <MeaningSide word={word} />}</Face>
          <Face hidden={!flipped} back>
            {showWordFirst ? (
              <>
                <p className="text-center text-muted">
                  <span className="font-semibold text-ink">{word.word}</span> <span className="italic">{word.pos}</span>
                </p>
                <MeaningSide word={word} />
              </>
            ) : (
              <WordSide word={word} />
            )}
            <Example text={word.example} word={word.word} className="mt-6 text-center leading-relaxed" />
            <div className="mt-auto flex flex-wrap items-center justify-center gap-2 pt-6">
              <CategoryPill category={word.category} />
              <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">
                {TIER_INFO[word.tier].short} · {bankLabel(word.lesson)}
              </span>
            </div>
          </Face>
        </button>
      </div>
      <p id="flip-hint" className="mt-3 text-center text-sm text-faint">
        Tap the card or press Space to flip
      </p>
      <p className="sr-only" aria-live="polite">
        {flipped
          ? showWordFirst
            ? `${word.synonym}. ${word.definition}`
            : `${word.word}, ${word.pos}`
          : ""}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => grade(false)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-500 bg-surface px-3 py-3.5 text-[15px] font-semibold text-amber-800 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/50"
        >
          <RotateCcw className="size-4 shrink-0" aria-hidden />
          Still learning
          <Kbd>1</Kbd>
        </button>
        <button
          type="button"
          onClick={() => grade(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-brand bg-brand px-3 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          Got it
          <Kbd light>2</Kbd>
        </button>
      </div>
      <p className="mt-4 hidden text-center text-sm text-faint sm:block">
        1 or ← still learning · 2 or → got it · Esc ends
      </p>
    </div>
  );
}

function Face({ hidden, back = false, children }: { hidden: boolean; back?: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "flex min-h-[20rem] min-w-0 flex-col rounded-3xl border border-line bg-surface p-6 shadow-sm [grid-area:1/1] [backface-visibility:hidden] sm:min-h-[24rem] sm:p-10",
        // Swap visibility at the flip's midpoint too, so the hidden face never
        // shows through if the browser skips backface culling.
        "transition-[visibility] delay-250 duration-0 motion-reduce:delay-0",
        hidden && "invisible",
        back && "[transform:rotateY(180deg)]",
      )}
    >
      {children}
    </div>
  );
}

function WordSide({ word }: { word: Word }) {
  return (
    <div className="my-auto text-center">
      <p className="text-[clamp(1.875rem,9vw,3rem)] leading-tight font-bold tracking-tight [overflow-wrap:anywhere]">{word.word}</p>
      <p className="mt-2 text-lg text-muted italic">{word.pos}</p>
    </div>
  );
}

function MeaningSide({ word }: { word: Word }) {
  return (
    <div className="my-auto pt-4 text-center">
      <p className="text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{word.synonym}</p>
      {word.definition && <p className="mt-3 text-lg text-muted">{word.definition}</p>}
    </div>
  );
}

function Kbd({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <kbd
      className={cn(
        "hidden rounded-md px-1.5 py-0.5 font-sans text-xs sm:inline-block",
        light ? "bg-black/20 text-white" : "bg-surface-2 text-muted",
      )}
    >
      {children}
    </kbd>
  );
}
