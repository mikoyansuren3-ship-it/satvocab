"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type Theme = "light" | "dark";

/** Matches --bg in globals.css, for the browser's address bar. */
const THEME_COLOR: Record<Theme, string> = { light: "#ffffff", dark: "#0e0e0d" };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The theme chosen on this browser, if any (set on <html> by the head script or setTheme). */
function chosen(): Theme | null {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : null;
}

function currentTheme(): Theme {
  return chosen() ?? (darkQuery().matches ? "dark" : "light");
}

/** Points the browser's theme-color at the theme on screen (the metadata only knows the device setting). */
function syncThemeColor() {
  const pick = chosen();
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute("media") ?? "";
    meta.content = THEME_COLOR[pick ?? (media.includes("dark") ? "dark" : "light")];
  }
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not saved (private mode or blocked storage); it still applies for this visit.
  }
  syncThemeColor();
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    syncThemeColor();
    darkQuery().addEventListener("change", emit);
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      darkQuery().removeEventListener("change", emit);
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Another tab changed the theme: show the same one here. */
function onStorage(e: StorageEvent) {
  if (e.key !== THEME_KEY) return;
  if (e.newValue === "light" || e.newValue === "dark") document.documentElement.dataset.theme = e.newValue;
  else delete document.documentElement.dataset.theme;
  syncThemeColor();
  emit();
}

/** The theme on screen; null while server rendering and hydrating. */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, currentTheme, () => null);
}
