import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { AccountButton } from "./AccountButton";
import { NavTabs } from "./NavTabs";
import { ThemeToggle } from "./ThemeToggle";
import { TIERS, WORDS } from "@/lib/words";

export function AppHeader() {
  return (
    // Phones: brand and account share the first row, tabs go full-width below.
    // Wider: one row (sm:contents lifts the first row's children into the header).
    <header className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3 sm:contents">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl sm:flex-none">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <BookOpenCheck className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-lg font-bold tracking-tight">SAT Vocab</span>
            <span className="block truncate text-sm text-muted">
              {WORDS.length.toLocaleString("en-US")} words · {TIERS.length} frequency levels
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:order-last">
          <ThemeToggle />
          <AccountButton />
        </div>
      </div>
      <div className="sm:ml-auto">
        <NavTabs />
      </div>
    </header>
  );
}
