"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, CloudOff, LogIn, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut, useAccount, type SyncStatus } from "@/lib/account";

const SYNC_TEXT: Record<SyncStatus, string> = {
  idle: "Loading your progress…",
  saving: "Saving…",
  saved: "Progress saved to your account",
  offline: "Offline. Changes will save when you reconnect.",
  expired: "Your sign-in expired. Sign in again to keep saving.",
};

export function SyncIcon({ sync, className }: { sync: SyncStatus; className?: string }) {
  const Icon = sync === "saved" ? Check : sync === "offline" ? CloudOff : sync === "expired" ? TriangleAlert : RefreshCw;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        sync === "saved" && "text-brand-text",
        sync === "expired" && "text-amber-600",
        (sync === "saving" || sync === "idle") && "animate-spin motion-reduce:animate-none",
        className,
      )}
      aria-hidden
    />
  );
}

export function syncText(sync: SyncStatus) {
  return SYNC_TEXT[sync];
}

export function AccountButton() {
  const { status, user, sync } = useAccount();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "unavailable" || (pathname === "/login" && status !== "user")) return null;
  if (status === "loading") return <span className="block h-10 w-24 rounded-full bg-surface-2" aria-hidden />;
  if (status === "guest" || !user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[15px] font-semibold whitespace-nowrap hover:bg-surface-2"
      >
        <LogIn className="size-4" aria-hidden />
        Sign in
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3 pl-1.5 text-[15px] font-semibold hover:bg-surface-2"
      >
        <span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-white uppercase" aria-hidden>
          {user.username[0]}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{user.username}</span>
        {sync === "offline" || sync === "expired" ? (
          <SyncIcon sync={sync} />
        ) : (
          <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        )}
        <span className="sr-only">
          <span className="sm:hidden">{user.username}</span>, account menu
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-sm text-muted">Signed in as</p>
            <p className="truncate font-semibold">{user.username}</p>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted" aria-live="polite">
            <SyncIcon sync={sync} className="mt-0.5" />
            {syncText(sync)}
          </p>
          {sync === "expired" && (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold hover:bg-surface-2"
            >
              <LogIn className="size-4" aria-hidden />
              Sign in again
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
              // A full page load, so nothing preloaded for this account is reused.
              window.location.replace("/login");
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold hover:bg-surface-2 disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
