"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { signIn, signOut, signUp, useAccount } from "@/lib/account";
import { fmt } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { PASSWORD_MIN, USERNAME_RULE, normalizeUsername, passwordProblem } from "@/lib/username";
import { SyncIcon, syncText } from "../AccountButton";

type Mode = "signin" | "signup";

export function LoginView() {
  const { status, user, sync } = useAccount();
  const state = useAppState();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepProgress, setKeepProgress] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ids = { user: useId(), pass: useId(), confirm: useId(), hint: useId(), error: useId() };

  const guestStudied = status === "guest" ? Object.keys(state.progress).length : 0;
  const guestSaved = status === "guest" ? Object.keys(state.saved).length : 0;
  const creating = mode === "signup";

  if (status === "unavailable") {
    return (
      <Card title="Accounts aren't set up yet">
        <p className="text-muted">
          This copy of the site doesn’t have account storage connected, so progress is saved in your browser only. You can keep studying as a guest.
        </p>
        <Link href="/" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-hover">
          Go study
        </Link>
      </Card>
    );
  }

  if (status === "user" && user && sync !== "expired") {
    return (
      <Card title={`You're signed in as ${user.username}`}>
        <p className="flex items-center gap-2 text-muted">
          <SyncIcon sync={sync} />
          {syncText(sync)}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-hover">
            Go study
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-surface-2"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </Card>
    );
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setConfirm("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const name = normalizeUsername(username);
    if (!name) return setError(creating ? `Usernames need ${USERNAME_RULE}, starting with a letter or number.` : "Wrong username or password.");
    if (creating) {
      const problem = passwordProblem(password);
      if (problem) return setError(problem);
      if (password !== confirm) return setError("The two passwords don't match.");
    } else if (!password) {
      return setError("Enter your password.");
    }
    setBusy(true);
    const failure = creating ? await signUp(name, password, keepProgress) : await signIn(name, password);
    setBusy(false);
    if (failure) return setError(failure);
    router.push("/");
  };

  return (
    <Card title={creating ? "Create an account" : "Sign in"}>
      <p className="text-muted">
        {creating
          ? "Your progress will be saved to your account, so it follows you to any device."
          : "Sign in to pick up your progress on any device."}
      </p>

      <div className="mt-5 grid grid-cols-2 rounded-full bg-surface-2 p-1" role="group" aria-label="Choose">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              "rounded-full py-2 text-[15px] font-semibold transition-colors",
              mode === m ? "bg-surface text-ink shadow-sm dark:bg-brand-soft dark:text-brand-text dark:ring-1 dark:ring-brand" : "text-muted hover:text-ink",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4" aria-describedby={error ? ids.error : undefined}>
        <div>
          <label htmlFor={ids.user} className="block text-[15px] font-semibold">
            Username
          </label>
          <input
            id={ids.user}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={24}
            aria-describedby={creating ? ids.hint : undefined}
            className="mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px] focus:border-focus focus:outline-none"
          />
          {creating && (
            <p id={ids.hint} className="mt-1.5 text-sm text-muted">
              {USERNAME_RULE}. Not case-sensitive.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.pass} className="block text-[15px] font-semibold">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id={ids.pass}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={creating ? PASSWORD_MIN : undefined}
              className="w-full rounded-xl border border-line bg-surface py-3 pr-12 pl-4 text-[16px] focus:border-focus focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              aria-label="Show password"
              className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          </div>
          {creating && <p className="mt-1.5 text-sm text-muted">At least {PASSWORD_MIN} characters.</p>}
        </div>

        {creating && (
          <div>
            <label htmlFor={ids.confirm} className="block text-[15px] font-semibold">
              Confirm password
            </label>
            <input
              id={ids.confirm}
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px] focus:border-focus focus:outline-none"
            />
          </div>
        )}

        {creating && guestStudied + guestSaved > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 p-4">
            <input
              type="checkbox"
              checked={keepProgress}
              onChange={(e) => setKeepProgress(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
            />
            <span className="text-[15px]">
              Start my account with the progress on this device
              <span className="block text-sm text-muted">
                {fmt(guestStudied)} word{guestStudied === 1 ? "" : "s"} studied, {fmt(guestSaved)} saved
              </span>
            </span>
          </label>
        )}

        <p id={ids.error} role="alert" className={cn("text-[15px] font-medium text-red-600 dark:text-red-400", !error && "sr-only")}>
          {error}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand py-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {busy ? (creating ? "Creating account…" : "Signing in…") : creating ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        {creating
          ? "There’s no email on these accounts, so a forgotten password can’t be reset. Pick one you’ll remember."
          : "Studying without an account still works; progress then stays in this browser."}
      </p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-4 max-w-md rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8" aria-labelledby="login-title">
      <h1 id="login-title" className="text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <div className="mt-2">{children}</div>
    </section>
  );
}
