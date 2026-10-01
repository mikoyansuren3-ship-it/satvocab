"use client";

import type { KeyboardEvent } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/cn";
import { LEVEL_LABEL, LEVEL_STYLE, type Level } from "@/lib/mastery";
import { toggleSaved } from "@/lib/store";
import { CATEGORY_STYLE, splitExample, type Category } from "@/lib/words";

export function MasteryBadge({ level, className }: { level: Level; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold",
        LEVEL_STYLE[level].badge,
        className,
      )}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

const FILLED: Record<Level, number> = { new: 0, learning: 1, almost: 2, mastered: 3 };

export function MasteryDots({ level }: { level: Level }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`Mastery: ${LEVEL_LABEL[level]}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", i < FILLED[level] ? LEVEL_STYLE[level].dot : "bg-stone-300 dark:bg-stone-700")}
        />
      ))}
    </span>
  );
}

export function CategoryPill({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold",
        CATEGORY_STYLE[category].pill,
        className,
      )}
    >
      {category}
    </span>
  );
}

export function SaveButton({
  id,
  word,
  saved,
  className,
}: {
  id: string;
  word: string;
  saved: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => toggleSaved(id)}
      // Clicking shouldn't move focus here, so Space/Enter keep driving the session.
      onMouseDown={(e) => e.preventDefault()}
      aria-pressed={saved}
      aria-label={`Save ${word}`}
      title={saved ? "Saved (click to remove)" : "Save word"}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-3",
        saved ? "text-brand-text" : "text-muted",
        className,
      )}
    >
      <Bookmark className="size-5" fill={saved ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

/** Example sentence with the headword emphasized. */
export function Example({ text, word, className }: { text: string; word: string; className?: string }) {
  if (!text) return null;
  const parts = splitExample(text, word);
  return (
    <p className={cn("italic text-muted", className)}>
      “
      {parts ? (
        <>
          {parts[0]}
          <strong className="font-semibold not-italic text-ink">{parts[1]}</strong>
          {parts[2]}
        </>
      ) : (
        text
      )}
      ”
    </p>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

const RADIO_KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

/**
 * Arrow-key navigation for a role="radiogroup" container: moves focus and
 * selection together. Pair with tabIndex={checked ? 0 : -1} on each radio.
 */
export function onRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!RADIO_KEYS.includes(e.key)) return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  const current = radios.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  e.preventDefault();
  e.stopPropagation();
  const n = radios.length;
  const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
  const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (current + (forward ? 1 : -1) + n) % n;
  radios[next].focus();
  radios[next].click();
}
