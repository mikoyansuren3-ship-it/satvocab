"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { LEVEL_STYLE, levelOf, type WordProgress } from "@/lib/mastery";
import { POS_NAME, TIER_INFO, type Word } from "@/lib/words";
import { CategoryPill, DifficultyTag, Example, MasteryBadge, MasteryDots, SaveButton } from "../bits";

export const WordRow = memo(function WordRow({
  word,
  progress,
  saved,
  expanded,
  onToggle,
}: {
  word: Word;
  progress: WordProgress | undefined;
  saved: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const level = levelOf(progress);
  const detailsId = `word-${word.id}-details`;
  return (
    <li className={cn("rounded-2xl border-l-4 bg-surface-2", LEVEL_STYLE[level].border)}>
      <div className="flex items-center gap-2 py-3 pr-3 pl-4 sm:gap-3">
        <button
          type="button"
          onClick={() => onToggle(word.id)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
        >
          <span className={cn("size-2.5 shrink-0 rounded-full", LEVEL_STYLE[level].dot)} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-lg font-bold tracking-tight">{word.word}</span>
              <span className="text-sm text-muted italic">
                <abbr title={POS_NAME[word.pos]} className="no-underline">
                  {word.pos}
                </abbr>
              </span>
              <MasteryBadge level={level} className="self-center" />
              <CategoryPill category={word.category} className="self-center px-2 py-0.5 sm:hidden" />
            </span>
            <span className={cn("mt-0.5 block text-[15px] text-muted", !expanded && "truncate")}>
              <span className="font-medium text-ink/85">{word.synonym}</span>
              {word.definition && <> · {word.definition}</>}
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-3 sm:flex">
            <MasteryDots level={level} />
            <CategoryPill category={word.category} />
            <DifficultyTag difficulty={word.difficulty} className="w-[4.5rem] text-sm text-muted" />
          </span>
        </button>
        <SaveButton id={word.id} word={word.word} saved={saved} />
      </div>
      <div id={detailsId} hidden={!expanded} className="space-y-3 pr-4 pb-4 pl-[2.6rem] sm:pr-14">
        <Example text={word.example} word={word.word} className="text-[15px] leading-relaxed" />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <DifficultyTag difficulty={word.difficulty} className="rounded-lg bg-surface px-2.5 py-1 font-semibold" />
          <span className="rounded-lg bg-surface px-2.5 py-1 font-semibold">
            {TIER_INFO[word.tier].label}
          </span>
          <span>
            {progress
              ? `Reviewed ${progress.seen} time${progress.seen === 1 ? "" : "s"} · ${progress.correct} right, ${progress.wrong} missed`
              : "Not studied yet"}
          </span>
        </div>
      </div>
    </li>
  );
});
