import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { NavTabs } from "./NavTabs";
import { LESSONS, WORDS } from "@/lib/words";

export function AppHeader() {
  return (
    <header className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/" className="flex items-center gap-3 self-start rounded-xl">
        <span className="grid size-10 place-items-center rounded-xl bg-brand text-white">
          <BookOpenCheck className="size-5" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-bold tracking-tight">SAT Vocab</span>
          <span className="block text-sm text-muted">
            {WORDS.length} top-frequency words · {LESSONS.length} lessons
          </span>
        </span>
      </Link>
      <NavTabs />
    </header>
  );
}
