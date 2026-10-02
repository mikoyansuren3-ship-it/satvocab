"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-pressed={theme ? dark : undefined}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-10.5 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink"
    >
      {/* Nothing until the theme is known in the browser, so the icon never flips after loading. */}
      {theme && (dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />)}
    </button>
  );
}
