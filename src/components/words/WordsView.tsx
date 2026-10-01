"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Play, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeFilters, filterWords, isUnfiltered, type Filters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { LEVELS, LEVEL_LABEL, type Level, type WordProgress } from "@/lib/mastery";
import { clearSession } from "@/lib/session";
import { clearFilters, setFilters, useAppState, useHydrated } from "@/lib/store";
import { WORDS, type Word } from "@/lib/words";
import { FilterAside, MobileFilterButton } from "../FilterPanel";
import { WordRow } from "./WordRow";

const PAGE = 100;

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function WordsView() {
  const { filters, progress, saved } = useAppState();
  const hydrated = useHydrated();
  const router = useRouter();
  const list = useMemo(() => filterWords(WORDS, filters, { progress, saved }), [filters, progress, saved]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true,
  );

  const onToggle = useCallback((id: string) => setExpanded((cur) => (cur === id ? null : id)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || target?.closest("input, textarea, [contenteditable], dialog")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <FilterAside />
      <section className="min-w-0 flex-1" aria-labelledby="words-heading">
        <h1 id="words-heading" className="sr-only">
          All words
        </h1>
        <div className="flex gap-2">
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Search words or definitions</span>
            <Search className="pointer-events-none absolute left-4 size-5 text-muted" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder={wide ? "Search words or definitions" : "Search words"}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-full border border-line bg-surface py-3 pr-11 pl-12 text-[16px] placeholder:text-muted focus:border-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => {
                  setFilters({ query: "" });
                  searchRef.current?.focus();
                }}
                className="absolute right-2 grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </label>
          <MobileFilterButton doneLabel={`Show ${fmt(list.length)} words`} />
        </div>

        <MasteryChips filters={filters} />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[15px]" aria-live="polite">
            <span className="font-bold">
              {fmt(list.length)} word{list.length === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-muted">{describeFilters(filters)}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push("/");
            }}
            disabled={list.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            <Play className="size-4" aria-hidden />
            Study these
          </button>
        </div>

        {list.length > 0 ? (
          <WordList
            // A new filter or search starts the list from the top again.
            key={JSON.stringify(filters)}
            list={list}
            progress={progress}
            saved={saved}
            expanded={expanded}
            onToggle={onToggle}
            dimmed={!hydrated}
          />
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-lg font-semibold">No words match</p>
            <p className="mt-1 text-muted">Try a different search or loosen your filters.</p>
            <button
              type="button"
              onClick={() => {
                clearFilters();
                searchRef.current?.focus();
              }}
              className="mt-5 rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-surface-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function WordList({
  list,
  progress,
  saved,
  expanded,
  onToggle,
  dimmed,
}: {
  list: Word[];
  progress: Record<string, WordProgress>;
  saved: Record<string, true>;
  expanded: string | null;
  onToggle: (id: string) => void;
  dimmed: boolean;
}) {
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLUListElement>(null);
  // Row index that last held focus, so focus can land nearby if that row disappears
  // (e.g. un-saving a word under "Saved only") or new rows are revealed.
  const focusIndex = useRef(-1);
  const focusAfterGrow = useRef(-1);
  const visible = list.slice(0, limit);

  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>("button[aria-controls$='-details']");
    if (!rows?.length) return;
    if (focusAfterGrow.current >= 0) {
      rows[Math.min(focusAfterGrow.current, rows.length - 1)]?.focus();
      focusAfterGrow.current = -1;
    } else if (focusIndex.current >= 0 && document.activeElement === document.body) {
      rows[Math.min(focusIndex.current, rows.length - 1)]?.focus();
    }
  }, [visible.length, list]);

  return (
    <>
      <ul
        ref={listRef}
        onFocus={(e) => {
          const row = (e.target as HTMLElement).closest("li");
          focusIndex.current = row ? Array.prototype.indexOf.call(listRef.current?.children ?? [], row) : -1;
        }}
        className={cn("mt-4 space-y-2 transition-opacity", dimmed && "opacity-60")}
      >
        {visible.map((w) => (
          <WordRow
            key={w.id}
            word={w}
            progress={progress[w.id]}
            saved={Boolean(saved[w.id])}
            expanded={expanded === w.id}
            onToggle={onToggle}
          />
        ))}
      </ul>
      {list.length > limit && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-sm text-muted">
            Showing {fmt(limit)} of {fmt(list.length)}
          </p>
          <button
            type="button"
            onClick={() => {
              focusAfterGrow.current = limit;
              setLimit((l) => l + PAGE);
            }}
            className="rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-surface-2"
          >
            Show {Math.min(PAGE, list.length - limit)} more
          </button>
        </div>
      )}
    </>
  );
}

type ChipKey = "all" | Level | "saved";

function MasteryChips({ filters }: { filters: Filters }) {
  const chips: { key: ChipKey; label: string }[] = [
    { key: "all", label: "All words" },
    ...LEVELS.map((l) => ({ key: l, label: LEVEL_LABEL[l] })),
    { key: "saved", label: "Saved only" },
  ];
  const isActive = (key: ChipKey) => {
    if (key === "all") return isUnfiltered(filters);
    if (key === "saved") return filters.saved === "saved";
    return filters.mastery.length === 1 && filters.mastery[0] === key;
  };
  const select = (key: ChipKey) => {
    if (key === "all") clearFilters();
    else if (key === "saved") setFilters({ saved: filters.saved === "saved" ? "all" : "saved" });
    else setFilters({ mastery: isActive(key) ? [] : [key] });
  };
  return (
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
      {chips.map(({ key, label }) => {
        const active = isActive(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => select(key)}
            className={cn(
              "rounded-full px-4 py-2 text-[15px] font-semibold transition-colors",
              active ? "bg-brand text-white hover:bg-brand-hover" : "border border-line bg-surface hover:bg-surface-2",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
