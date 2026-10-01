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
import { fmt } from "@/lib/format";
import { LEVELS, LEVEL_LABEL, LEVEL_STYLE } from "@/lib/mastery";
import { clearFilters, setFilters, useAppState } from "@/lib/store";
import {
  CATEGORIES,
  CATEGORY_STYLE,
  LESSONS_BY_TIER,
  POS_OPTIONS,
  TIERS,
  TIER_INFO,
  WORDS,
  bankLabel,
  tierOf,
  type Tier,
} from "@/lib/words";
import { onRadioGroupKeyDown } from "./bits";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const POS_IN_DATA = POS_OPTIONS.filter((o) => WORDS.some((w) => w.pos === o.value));

export function FilterPanel({ onDone, doneLabel = "Done" }: { onDone?: () => void; doneLabel?: string }) {
  const inSheet = Boolean(onDone);
  const { filters: f, progress, saved } = useAppState();
  const counts = useMemo(() => facetCounts(WORDS, f, { progress, saved }), [f, progress, saved]);
  const set = (patch: Partial<Filters>) => setFilters(patch);

  const toggleTier = (tier: Tier) => {
    const tiers = toggle(f.tiers, tier);
    // Drop word banks from levels that are no longer selected.
    set({ tiers, lessons: tiers.length ? f.lessons.filter((l) => tiers.includes(tierOf(l))) : f.lessons });
  };
  const visibleTiers = f.tiers.length ? TIERS.filter((t) => f.tiers.includes(t)) : TIERS;

  return (
    // No overflow clipping in the sheet, so its sticky footer can stick.
    <div className={cn("rounded-3xl border border-line bg-surface", !inSheet && "overflow-hidden")}>
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

      <Section label="Frequency" summary={summarize.tiers(f)}>
        <OptionGroup label="Frequency">
          {TIERS.map((tier) => (
            <Option
              key={tier}
              kind="checkbox"
              checked={f.tiers.includes(tier)}
              onSelect={() => toggleTier(tier)}
              label={TIER_INFO[tier].label}
              hint={TIER_INFO[tier].banks}
              count={counts.tiers[tier]}
            />
          ))}
        </OptionGroup>
      </Section>

      <Section label="Word bank" summary={summarize.lessons(f)}>
        <div className="space-y-1">
          {visibleTiers.map((tier) => (
            <BankGroup
              // Remount when a level becomes the only one shown, so it opens.
              key={`${tier}-${visibleTiers.length === 1}`}
              tier={tier}
              selected={f.lessons}
              counts={counts.lessons}
              defaultOpen={visibleTiers.length === 1 || f.lessons.some((l) => tierOf(l) === tier)}
              onToggle={(lesson) => set({ lessons: toggle(f.lessons, lesson) })}
            />
          ))}
        </div>
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
          {POS_IN_DATA.map((o) => (
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
            <Option key={o.value} kind="radio" checked={f.sort === o.value} onSelect={() => set({ sort: o.value })} label={o.label} />
          ))}
        </OptionGroup>
      </Section>

      <div className={cn("flex gap-2 border-t border-line p-5", inSheet && "sticky bottom-0 rounded-b-3xl bg-surface")}>
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
            {doneLabel}
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
    <div
      role={radio ? "radiogroup" : "group"}
      aria-label={label}
      onKeyDown={radio ? onRadioGroupKeyDown : undefined}
      className="space-y-0.5"
    >
      {children}
    </div>
  );
}

function Option({
  kind,
  checked,
  onSelect,
  label,
  hint,
  count,
  swatch,
}: {
  kind: "checkbox" | "radio";
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
  count?: number;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={checked}
      tabIndex={kind === "radio" && !checked ? -1 : 0}
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[15px] transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center border-2 transition-colors",
          kind === "checkbox" ? "rounded-md" : "rounded-full",
          checked ? "border-brand bg-brand text-white" : "border-brand dark:border-brand-text",
        )}
        aria-hidden
      >
        {checked && (kind === "checkbox" ? <Check className="size-3" strokeWidth={3.5} /> : <span className="size-2 rounded-full bg-white" />)}
      </span>
      {swatch && <span className={cn("size-2 shrink-0 rounded-full", swatch)} aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      {count !== undefined && (
        <span className="text-sm text-muted tabular-nums">
          <span className="sr-only">, </span>
          {fmt(count)}
          <span className="sr-only"> words</span>
        </span>
      )}
    </button>
  );
}

function BankGroup({
  tier,
  selected,
  counts,
  defaultOpen,
  onToggle,
}: {
  tier: Tier;
  selected: string[];
  counts: Record<string, number>;
  defaultOpen: boolean;
  onToggle: (lesson: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const banks = LESSONS_BY_TIER[tier];
  const picked = banks.filter((l) => selected.includes(l)).length;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{TIER_INFO[tier].label}</span>
          <span className="block text-sm text-muted">{TIER_INFO[tier].banks}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
          {picked > 0 && <span className="font-semibold text-brand-text">{picked} selected</span>}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      <div id={id} hidden={!open} className="px-1 pt-1 pb-2">
        {tier === "low" && (
          <p className="mb-2 px-1 text-sm text-muted">
            The source doesn’t split this list into lessons, so these sets of about 30 follow its order of difficulty.
          </p>
        )}
        <div role="group" aria-label={`${TIER_INFO[tier].label} word banks`} className="grid grid-cols-5 gap-1.5">
          {banks.map((lesson) => {
            const checked = selected.includes(lesson);
            const count = counts[lesson] ?? 0;
            return (
              <button
                key={lesson}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`${bankLabel(lesson)}, ${count} words`}
                onClick={() => onToggle(lesson)}
                className={cn(
                  "flex flex-col items-center rounded-lg border py-1.5 text-sm leading-tight font-semibold tabular-nums transition-colors",
                  checked ? "border-brand bg-brand text-white" : "border-line hover:bg-surface-2",
                  !checked && count === 0 && "opacity-50",
                )}
              >
                {lesson}
                <span className={cn("text-[11px] font-medium", checked ? "text-white/85" : "text-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
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

export function MobileFilterButton({ className, doneLabel }: { className?: string; doneLabel?: string }) {
  const [open, setOpen] = useState(false);
  const { filters } = useAppState();
  const active = activeFilterCount(filters);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] font-semibold hover:bg-surface-2 lg:hidden",
          className,
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
        {active > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs text-white">
            {active}
            <span className="sr-only"> active</span>
          </span>
        )}
      </button>
      {open && <FilterSheet onClosed={() => setOpen(false)} doneLabel={doneLabel} />}
    </>
  );
}

function FilterSheet({ onClosed, doneLabel }: { onClosed: () => void; doneLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Only a press that both starts and ends on the backdrop closes the sheet.
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);
  // Close through the dialog so focus returns to the Filters button, then unmount
  // directly rather than waiting for the async "close" event.
  const dismiss = () => {
    ref.current?.close();
    onClosed();
  };
  return (
    <dialog
      ref={ref}
      aria-label="Filters"
      onClose={() => {
        // React StrictMode re-runs effects in development; ignore stray close events.
        if (ref.current?.open) return;
        onClosed();
      }}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) dismiss();
        pressedBackdrop.current = false;
      }}
      className="m-0 mt-auto max-h-[88vh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-transparent p-2 text-ink sm:mx-auto sm:mb-auto sm:max-w-md sm:rounded-3xl"
    >
      <FilterPanel onDone={dismiss} doneLabel={doneLabel} />
    </dialog>
  );
}
