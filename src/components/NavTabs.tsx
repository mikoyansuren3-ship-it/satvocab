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
              "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold transition-colors sm:flex-none",
              active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
