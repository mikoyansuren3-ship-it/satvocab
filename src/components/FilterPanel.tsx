"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  SAVED_OPTIONS,
  SORT_OPTIONS,
  activeFilterCount,
  facetCounts,
  summarize,
  type Filters,
} from "@/lib/filters";
import { LEVELS, LEVEL_LABEL, LEVEL_STYLE } from "@/lib/mastery";
import { clearFilters, setFilters, useAppState } from "@/lib/store";
import { CATEGORIES, CATEGORY_STYLE, LESSONS, POS_OPTIONS, WORDS } from "@/lib/words";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({ onDone }: { onDone?: () => void }) {
  const { filters: f, progress, saved } = useAppState();
  const counts = useMemo(() => facetCounts(WORDS, f, { progress, saved }), [f, progress, saved]);
  const set = (patch: Partial<Filters>) => setFilters(patch);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-base font-bold">Filters</h2>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2"
            aria-label="Close filters"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <Section label="Mastery" summary={summarize.mastery(f)} defaultOpen>
        <OptionGroup label="Mastery">
          {LEVELS.map((level) => (
            <Option
              key={level}
              kind="checkbox"
              checked={f.mastery.includes(level)}
              onSelect={() => set({ mastery: toggle(f.mastery, level) })}
              label={LEVEL_LABEL[level]}
              count={counts.mastery[level]}
              swatch={LEVEL_STYLE[level].dot}
            />
          ))}
        </OptionGroup>
      </Section>

      <Section label="Word bank" summary={summarize.lessons(f)}>
        <OptionGroup label="Word bank">
          {LESSONS.map((lesson) => (
            <Option
              key={lesson}
              kind="checkbox"
              checked={f.lessons.includes(lesson)}
              onSelect={() => set({ lessons: toggle(f.lessons, lesson) })}
              label={`Lesson ${lesson}`}
              count={counts.lessons[lesson]}
            />
          ))}
        </OptionGroup>
      </Section>

      <Section label="Category" summary={summarize.categories(f)}>
        <OptionGroup label="Category">
          {CATEGORIES.map((category) => (
            <Option
              key={category}
              kind="checkbox"
              checked={f.categories.includes(category)}
              onSelect={() => set({ categories: toggle(f.categories, category) })}
              label={category}
              count={counts.categories[category]}
              swatch={CATEGORY_STYLE[category].swatch}
            />
          ))}
        </OptionGroup>
      </Section>

      <Section label="Part of speech" summary={summarize.pos(f)}>
        <OptionGroup label="Part of speech">
          {POS_OPTIONS.filter((o) => WORDS.some((w) => w.pos === o.value)).map((o) => (
            <Option
              key={o.value}
              kind="checkbox"
              checked={f.pos.includes(o.value)}
              onSelect={() => set({ pos: toggle(f.pos, o.value) })}
              label={o.label}
              count={counts.pos[o.value]}
            />
          ))}
        </OptionGroup>
      </Section>

      <Section label="Saved" summary={summarize.saved(f)}>
        <OptionGroup label="Saved" radio>
          {SAVED_OPTIONS.map((o) => (
            <Option
              key={o.value}
              kind="radio"
              checked={f.saved === o.value}
              onSelect={() => set({ saved: o.value })}
              label={o.label}
              count={counts.saved[o.value]}
            />
          ))}
        </OptionGroup>
      </Section>

      <Section label="Sort" summary={summarize.sort(f)}>
        <OptionGroup label="Sort" radio>
          {SORT_OPTIONS.map((o) => (
            <Option
              key={o.value}
              kind="radio"
              checked={f.sort === o.value}
              onSelect={() => set({ sort: o.value })}
              label={o.label}
            />
          ))}
        </OptionGroup>
      </Section>

      <div className="flex gap-2 border-t border-line p-5">
        <button
          type="button"
          onClick={clearFilters}
          className="flex-1 rounded-full border border-line bg-surface py-2.5 text-[15px] font-semibold transition-colors hover:bg-surface-2"
        >
          Clear
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-full bg-brand py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Show words
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  summary,
  defaultOpen = false,
  children,
}: {
  label: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2"
      >
        <span className="font-semibold">{label}</span>
        <span className="flex min-w-0 items-center gap-2 text-[15px] text-muted">
          <span className="truncate">{summary}</span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      <div id={id} hidden={!open} className="px-3 pb-3">
        {children}
      </div>
    </div>
  );
}

function OptionGroup({ label, radio = false, children }: { label: string; radio?: boolean; children: ReactNode }) {
  return (
    <div role={radio ? "radiogroup" : "group"} aria-label={label} className="space-y-0.5">
      {children}
    </div>
  );
}

function Option({
  kind,
  checked,
  onSelect,
  label,
  count,
  swatch,
}: {
  kind: "checkbox" | "radio";
  checked: boolean;
  onSelect: () => void;
  label: string;
  count?: number;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={checked}
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[15px] transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
          checked ? "border-brand bg-brand text-white" : "border-brand/70",
        )}
        aria-hidden
      >
        {checked && (kind === "checkbox" ? <Check className="size-3" strokeWidth={3.5} /> : <span className="size-2 rounded-full bg-white" />)}
      </span>
      {swatch && <span className={cn("size-2 shrink-0 rounded-full", swatch)} aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="tabular-nums text-sm text-muted">{count}</span>}
    </button>
  );
}

/** Desktop sidebar; hidden below the lg breakpoint, where MobileFilterButton takes over. */
export function FilterAside() {
  return (
    <aside className="hidden w-80 shrink-0 lg:block">
      <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl">
        <FilterPanel />
      </div>
    </aside>
  );
}

export function MobileFilterButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { filters } = useAppState();
  const active = activeFilterCount(filters);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] font-semibold hover:bg-surface-2 lg:hidden",
          className,
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
        {active > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs text-white">{active}</span>
        )}
      </button>
      {open && <FilterSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function FilterSheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Filters"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[88vh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-transparent p-2 text-ink sm:mx-auto sm:mb-auto sm:max-w-md sm:rounded-3xl"
    >
      <FilterPanel onDone={onClose} />
    </dialog>
  );
}
