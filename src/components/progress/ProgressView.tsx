"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Download, Table2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { LEVELS, LEVEL_LABEL, LEVEL_STYLE, levelOf, type Level } from "@/lib/mastery";
import {
  applyImport,
  dayKey,
  exportState,
  previewImport,
  resetProgress,
  setFilters,
  useAppState,
  useHydrated,
  type AppState,
} from "@/lib/store";
import {
  CATEGORIES,
  CATEGORY_STYLE,
  LESSONS_BY_TIER,
  TIERS,
  TIER_INFO,
  WORDS,
  WORD_BY_ID,
  bankLabel,
  type Category,
  type Tier,
  type Word,
} from "@/lib/words";
import { onRadioGroupKeyDown } from "../bits";
import { MODE_LABEL } from "../study/types";

type Counts = Record<Level, number>;

/** Stacked order: progress fills left to right; "never seen" is the trailing track. */
const STACK: Level[] = ["mastered", "almost", "learning", "new"];
const SHORT_LABEL: Record<Level, string> = { mastered: "Mastered", almost: "Almost", learning: "Learning", new: "New" };

function countLevels(words: Word[], progress: AppState["progress"]): Counts {
  const counts: Counts = { new: 0, learning: 0, almost: 0, mastered: 0 };
  for (const w of words) counts[levelOf(progress[w.id])]++;
  return counts;
}

const noopSubscribe = () => () => {};

/** Today's local date key; empty during prerender so render stays pure. */
function useToday(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => dayKey(new Date()),
    () => "",
  );
}

function streakLength(days: string[], today: string): number {
  if (!today) return 0;
  const set = new Set(days);
  const cursor = new Date(`${today}T12:00:00`);
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1); // a streak survives until today ends
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

interface Row {
  key: string;
  label: string;
  counts: Counts;
  swatch?: string;
}

export function ProgressView() {
  const { progress, saved, history, days } = useAppState();
  const hydrated = useHydrated();
  const today = useToday();
  const router = useRouter();
  const [bankTier, setBankTier] = useState<Tier>("top");

  const overall = useMemo(() => countLevels(WORDS, progress), [progress]);
  const byTier = useMemo<Row[]>(
    () => TIERS.map((t) => ({ key: t, label: TIER_INFO[t].label, counts: countLevels(WORDS.filter((w) => w.tier === t), progress) })),
    [progress],
  );
  const byLesson = useMemo<Row[]>(
    () =>
      LESSONS_BY_TIER[bankTier].map((l) => ({ key: l, label: bankLabel(l), counts: countLevels(WORDS.filter((w) => w.lesson === l), progress) })),
    [progress, bankTier],
  );
  const byCategory = useMemo<Row[]>(
    () =>
      CATEGORIES.map((c) => ({
        key: c,
        label: c,
        swatch: CATEGORY_STYLE[c].swatch,
        counts: countLevels(WORDS.filter((w) => w.category === c), progress),
      })),
    [progress],
  );

  const totals = useMemo(() => {
    let seen = 0;
    let correct = 0;
    let answers = 0;
    for (const p of Object.values(progress)) {
      seen++;
      correct += p.correct;
      answers += p.seen;
    }
    return { seen, answers, accuracy: answers ? Math.round((correct / answers) * 100) : null };
  }, [progress]);

  const missed = useMemo(
    () =>
      Object.entries(progress)
        .filter(([, p]) => p.wrong > 0)
        .sort(([a, pa], [b, pb]) => pb.wrong - pa.wrong || pa.correct / pa.seen - pb.correct / pb.seen || a.localeCompare(b, "en"))
        .slice(0, 8)
        .flatMap(([id, p]) => {
          const w = WORD_BY_ID.get(id);
          return w ? [{ w, p }] : [];
        }),
    [progress],
  );

  const showWords = (patch: Partial<Filters>) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    router.push("/words");
  };

  const total = WORDS.length;
  const streak = streakLength(days, today);

  return (
    <div className={cn("space-y-5 transition-opacity", !hydrated && "opacity-60")}>
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-7" aria-labelledby="overall-title">
        <h1 id="overall-title" className="text-sm font-semibold tracking-wide text-muted uppercase">
          Your progress
        </h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{fmt(overall.mastered)}</span>
          <span className="text-lg text-muted">of {fmt(total)} words mastered</span>
        </p>
        <div className="mt-5">
          <StackedBar counts={overall} label="All words" tall />
        </div>
        <Legend counts={overall} total={total} />
      </section>

      <section aria-label="Study stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Day streak" value={fmt(streak)} note={streak === 1 ? "day in a row" : "days in a row"} />
        <StatTile label="Words studied" value={fmt(totals.seen)} note={`${fmt(total - totals.seen)} not seen yet`} />
        <StatTile
          label="Accuracy"
          value={totals.accuracy === null ? "–" : `${totals.accuracy}%`}
          note={`${fmt(totals.answers)} answer${totals.answers === 1 ? "" : "s"}`}
        />
        <StatTile label="Saved words" value={fmt(Object.keys(saved).length)} note="bookmarked to review" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Breakdown
          title="By difficulty"
          firstColumn="Difficulty"
          rows={byTier}
          onSelect={(key) => showWords({ tiers: [key as Tier] })}
          selectHint="Show these words"
        />
        <Breakdown
          title="By category"
          firstColumn="Category"
          rows={byCategory}
          onSelect={(key) => showWords({ categories: [key as Category] })}
          selectHint="Show this category's words"
        />
      </div>

      <Breakdown
        title="By word bank"
        firstColumn="Word bank"
        rows={byLesson}
        onSelect={(key) => showWords({ lessons: [key] })}
        selectHint="Show this word bank"
        columns
        controls={
          <div role="radiogroup" aria-label="Difficulty" onKeyDown={onRadioGroupKeyDown} className="inline-flex rounded-full bg-surface-2 p-1">
            {TIERS.map((t) => {
              const selected = bankTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setBankTier(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap transition-colors",
                    selected ? "bg-surface text-ink shadow-sm dark:bg-brand-soft dark:text-brand-text dark:ring-1 dark:ring-brand" : "text-muted hover:text-ink",
                  )}
                >
                  {TIER_INFO[t].short}
                </button>
              );
            })}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="missed-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="missed-title" className="font-bold">
              Most missed
            </h2>
            {missed.length > 0 && (
              <button
                type="button"
                onClick={() => showWords({ sort: "missed" })}
                className="-my-1.5 -mr-2 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-text hover:bg-surface-2"
              >
                Review in list
              </button>
            )}
          </div>
          {missed.length ? (
            <ul className="mt-3 divide-y divide-line">
              {missed.map(({ w, p }) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="font-semibold">{w.word}</span> <span className="text-[15px] text-muted">{w.synonym}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted tabular-nums">
                    {p.wrong} missed · {p.correct} right
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-muted">Words you get wrong will show up here.</p>
          )}
        </section>

        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-bold">
            Recent sessions
          </h2>
          {history.length ? (
            <ul className="mt-3 divide-y divide-line">
              {[...history]
                .reverse()
                .slice(0, 8)
                .map((h, i) => (
                  <li key={`${h.t}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-semibold">{MODE_LABEL[h.mode]}</span>
                      <span className="block text-sm text-muted">
                        {new Date(h.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block font-semibold">
                        {h.correct}/{h.total}
                      </span>
                      <span className="block text-sm text-muted">{h.total ? `${Math.round((h.correct / h.total) * 100)}%` : "–"}</span>
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-muted">Finish a flashcard round or quiz to see it here.</p>
          )}
        </section>
      </div>

      <DataControls />
    </div>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{note}</p>
    </div>
  );
}

function StackedBar({ counts, label, tall = false }: { counts: Counts; label: string; tall?: boolean }) {
  const total = LEVELS.reduce((sum, l) => sum + counts[l], 0);
  const summary = STACK.map((l) => `${LEVEL_LABEL[l]} ${counts[l]}`).join(", ");
  return (
    <span role="img" aria-label={`${label}: ${summary}`} className={cn("flex w-full gap-[2px]", tall ? "h-6" : "h-3")}>
      {STACK.filter((l) => counts[l] > 0).map((l, i, shown) => (
        <span
          key={l}
          className={cn("group relative block h-full first:rounded-l-[4px] last:rounded-r-[4px]", LEVEL_STYLE[l].bar)}
          style={{ flexGrow: counts[l], flexBasis: 0, minWidth: 3 }}
        >
          <span
            className={cn(
              "pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-bg shadow-lg group-hover:block",
              // Anchor edge segments' tooltips inward so they stay on screen.
              i === 0 ? "left-0" : i === shown.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
            )}
          >
            {LEVEL_LABEL[l]}: {fmt(counts[l])} ({Math.round((counts[l] / total) * 100)}%)
          </span>
        </span>
      ))}
    </span>
  );
}

function Legend({ counts, total }: { counts: Counts; total: number }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
      {STACK.map((l) => (
        <li key={l} className="inline-flex items-center gap-2">
          <span className={cn("size-2.5 rounded-sm", l === "new" ? "bg-surface-3 ring-1 ring-line ring-inset" : LEVEL_STYLE[l].bar)} aria-hidden />
          <span className="text-muted">{LEVEL_LABEL[l]}</span>
          <span className="font-semibold tabular-nums">{fmt(counts[l])}</span>
          <span className="text-sm text-faint tabular-nums">{Math.round((counts[l] / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({
  title,
  firstColumn,
  rows,
  onSelect,
  selectHint,
  controls,
  columns = false,
}: {
  title: string;
  firstColumn: string;
  rows: Row[];
  onSelect: (key: string) => void;
  selectHint: string;
  controls?: React.ReactNode;
  columns?: boolean;
}) {
  const [table, setTable] = useState(false);
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          {controls}
          <button
            type="button"
            aria-pressed={table}
            onClick={() => setTable((t) => !t)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-surface-2 hover:text-ink",
              table ? "text-ink" : "text-muted",
            )}
          >
            <Table2 className="size-4" aria-hidden />
            Table view
          </button>
        </div>
      </div>
      {table ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">{firstColumn}</th>
                {STACK.map((l) => (
                  <th key={l} className="px-2 py-2 text-right font-semibold">
                    <span className="sm:hidden">{SHORT_LABEL[l]}</span>
                    <span className="hidden sm:inline">{LEVEL_LABEL[l]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key}>
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">{r.label}</th>
                  {STACK.map((l) => (
                    <td key={l} className="px-2 py-2 text-right">
                      {fmt(r.counts[l])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={cn("mt-3 gap-x-6 gap-y-1", columns ? "grid lg:grid-cols-2" : "space-y-1")}>
          {rows.map((r) => {
            const total = LEVELS.reduce((sum, l) => sum + r.counts[l], 0);
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onSelect(r.key)}
                  title={selectHint}
                  // Phones: label and count on one line, full-width bar below.
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2 text-left hover:bg-surface-2 sm:grid-cols-[10.5rem_1fr_minmax(5.5rem,max-content)]"
                >
                  <span className="flex min-w-0 items-center gap-2 text-[15px] font-medium">
                    {r.swatch && <span className={cn("size-2 shrink-0 rounded-full", r.swatch)} aria-hidden />}
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className="col-span-2 row-start-2 block sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <StackedBar counts={r.counts} label={r.label} />
                  </span>
                  <span className="text-right text-sm text-muted tabular-nums sm:col-start-3 sm:row-start-1">
                    <span className="font-semibold text-ink">{fmt(r.counts.mastered)}</span>/{fmt(total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DataControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const download = () => {
    const blob = new Blob([exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sat-vocab-progress-${dayKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Safari needs the URL to outlive the click briefly.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMessage("Progress file saved.");
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const preview = previewImport(await file.text());
    if (fileRef.current) fileRef.current.value = "";
    if (!preview) {
      setMessage("That file isn't a SAT Vocab progress export.");
      return;
    }
    const from = preview.exportedAt ? ` from ${new Date(preview.exportedAt).toLocaleDateString("en-US")}` : "";
    const ok = window.confirm(
      `Replace your current progress with this file${from}? It has ${preview.studied} studied and ${preview.saved} saved words. This can't be undone.`,
    );
    if (!ok) return;
    applyImport(preview);
    setMessage("Progress imported.");
  };

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="data-title">
      <h2 id="data-title" className="font-bold">
        Your data
      </h2>
      <p className="mt-1 text-[15px] text-muted">Progress is saved in this browser only. Export a file to back it up or move it to another device.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[15px] font-semibold hover:bg-surface-2"
        >
          <Download className="size-4" aria-hidden />
          Export progress
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[15px] font-semibold focus-within:outline-2 focus-within:outline-focus hover:bg-surface-2">
          <Upload className="size-4" aria-hidden />
          Import progress
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset all mastery progress and session history? Saved words are kept.")) {
              resetProgress();
              setMessage("Progress reset.");
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2.5 text-[15px] font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="size-4" aria-hidden />
          Reset progress
        </button>
      </div>
      <p className="mt-3 min-h-5 text-sm text-muted" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
