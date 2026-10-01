"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, GraduationCap, LibraryBig } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Study", icon: GraduationCap },
  { href: "/words", label: "All words", icon: LibraryBig },
  { href: "/progress", label: "Progress", icon: ChartColumn },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex w-full rounded-full bg-surface-2 p-1 sm:w-auto">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[15px] font-semibold whitespace-nowrap transition-colors sm:flex-none sm:gap-2 sm:px-4",
              active
                ? "bg-surface text-ink shadow-sm dark:bg-brand-soft dark:text-brand-text dark:ring-1 dark:ring-brand"
                : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0 max-[359px]:hidden" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
