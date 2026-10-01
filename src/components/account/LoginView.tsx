"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { checkUsername, signIn, signUp, useAccount } from "@/lib/account";
import { fmt } from "@/lib/format";
import { safeNextPath } from "@/lib/next-path";
import { useAppState } from "@/lib/store";
import { PIN_LENGTH, USERNAME_RULE, normalizeUsername } from "@/lib/username";
import { WORDS } from "@/lib/words";

/** username → (pin | choose → confirm) */
type Step = "username" | "pin" | "choose" | "confirm";

/** The page to return to, from ?next= (read when needed, so the page can stay static). */
const nextPath = () => safeNextPath(new URLSearchParams(window.location.search).get("next"));

const lockText = (ms: number) => {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
};

export function LoginView() {
  const { status, user, sync } = useAccount();
  const state = useAppState();
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [account, setAccount] = useState("");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [keepProgress, setKeepProgress] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ids = { user: useId(), hint: useId(), error: useId() };
  const signedIn = status === "user" && Boolean(user) && sync !== "expired";

  // Already signed in (or just signed in): continue to the page that was asked for.
  useEffect(() => {
    if (signedIn) router.replace(nextPath());
  }, [signedIn, router]);

  if (status === "unavailable") {
    return (
      <Card title="Accounts aren't set up yet">
        <p className="text-muted">
          This copy of the site doesn’t have account storage connected, so progress is saved in your browser only. You can keep studying without signing in.
        </p>
        <Link href="/" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-hover">
          Go study
        </Link>
      </Card>
    );
  }

  if (signedIn) {
    return (
      <Card title={`Welcome back, ${user?.username}`}>
        <p className="text-muted">Taking you to your words…</p>
      </Card>
    );
  }

  const guestStudied = status === "guest" ? Object.keys(state.progress).length : 0;
  const guestSaved = status === "guest" ? Object.keys(state.saved).length : 0;

  const go = (next: Step, message = "") => {
    setStep(next);
    setPin("");
    setError(message);
  };

  const submitUsername = async (e: FormEvent) => {
    e.preventDefault();
    const name = normalizeUsername(username);
    if (!name) return setError(`Usernames need ${USERNAME_RULE}, starting with a letter or number.`);
    setBusy(true);
    setError("");
    const result = await checkUsername(name);
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setAccount(result.username);
    setFirstPin("");
    if (result.exists) go("pin", result.lockedForMs ? lockText(result.lockedForMs) : "");
    else go("choose");
  };

  const submitPin = async (value: string) => {
    if (step === "choose") {
      setFirstPin(value);
      return go("confirm");
    }
    if (step === "confirm" && value !== firstPin) {
      setFirstPin("");
      return go("choose", "Those PINs didn’t match. Choose your PIN again.");
    }
    setBusy(true);
    setError("");
    const failure = step === "pin" ? await signIn(account, value) : await signUp(account, value, keepProgress);
    setBusy(false);
    if (!failure) return router.replace(nextPath());
    if (step === "confirm") {
      setFirstPin("");
      return go("choose", failure);
    }
    go(step, failure);
  };

  if (step === "username") {
    return (
      <Card title="Welcome to SAT Vocab">
        <p className="text-muted">
          Study {fmt(WORDS.length)} SAT words with flashcards and quizzes. Enter your username to sign in, or pick a new one to create an account.
        </p>
        <form onSubmit={submitUsername} noValidate className="mt-6 space-y-4">
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
              autoFocus
              required
              maxLength={24}
              aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ""}`}
              aria-invalid={Boolean(error)}
              className="mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px] focus:border-focus focus:outline-none"
            />
            <p id={ids.hint} className="mt-1.5 text-sm text-muted">
              {USERNAME_RULE}. Not case-sensitive.
            </p>
          </div>
          <ErrorText id={ids.error} error={error} />
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="w-full rounded-full bg-brand py-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      </Card>
    );
  }

  const creating = step === "choose" || step === "confirm";
  const title = step === "pin" ? "Enter your PIN" : step === "choose" ? "Create a PIN" : "Confirm your PIN";
  const label = step === "pin" ? `${PIN_LENGTH}-digit PIN` : step === "choose" ? `New ${PIN_LENGTH}-digit PIN` : `Type your new PIN again`;

  return (
    <Card title={title}>
      <p className="text-muted">
        {step === "pin" ? (
          <>
            Signing in as <strong className="text-ink">{account}</strong>.
          </>
        ) : step === "choose" ? (
          <>
            There’s no account called <strong className="text-ink">{account}</strong> yet. Choose a {PIN_LENGTH}-digit PIN to create it.
          </>
        ) : (
          <>Type the same {PIN_LENGTH} digits once more.</>
        )}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.length === PIN_LENGTH) void submitPin(pin);
        }}
        className="mt-6 space-y-4"
      >
        {/* Lets password managers pair the PIN with the username from step 1. */}
        <input type="text" name="username" autoComplete="username" value={account} readOnly hidden />
        <PinInput
          key={step}
          label={label}
          value={pin}
          onChange={(v) => {
            setPin(v);
            if (error && v) setError("");
          }}
          onComplete={(v) => void submitPin(v)}
          autoComplete={step === "pin" ? "current-password" : "new-password"}
          disabled={busy}
          errorId={error ? ids.error : undefined}
        />
        <ErrorText id={ids.error} error={error} />

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

        <p className="min-h-5 text-center text-sm text-muted" aria-live="polite">
          {busy ? (step === "pin" ? "Signing in…" : "Creating your account…") : ""}
        </p>
      </form>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        <button
          type="button"
          onClick={() => {
            setFirstPin("");
            go("username");
          }}
          className="inline-flex items-center gap-1.5 rounded-full py-1 font-semibold text-brand-text hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {step === "pin" ? "Not you? Change username" : "Use a different username"}
        </button>
        {creating && <span className="text-muted">There’s no email, so remember your PIN: it can’t be reset.</span>}
      </div>
    </Card>
  );
}

/** One real numeric input drawn as six boxes; submits itself on the last digit. */
function PinInput({
  label,
  value,
  onChange,
  onComplete,
  autoComplete,
  disabled,
  errorId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  autoComplete: string;
  disabled: boolean;
  errorId?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Back to the box after a wrong PIN clears it.
  useEffect(() => {
    if (!disabled && value === "") ref.current?.focus();
  }, [disabled, value]);

  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-semibold">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          ref={ref}
          id={id}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={autoComplete}
          maxLength={PIN_LENGTH}
          value={value}
          disabled={disabled}
          autoFocus
          aria-describedby={errorId}
          aria-invalid={Boolean(errorId)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
            onChange(digits);
            if (digits.length === PIN_LENGTH) onComplete(digits);
          }}
          // Invisible but still the real, focusable field; the boxes below are just its picture.
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden>
          {Array.from({ length: PIN_LENGTH }, (_, i) => {
            const filled = i < value.length;
            const current = focused && i === Math.min(value.length, PIN_LENGTH - 1);
            return (
              <div
                key={i}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border-2 bg-surface text-2xl transition-colors",
                  current ? "border-focus" : errorId ? "border-red-400" : filled ? "border-brand" : "border-line",
                  disabled && "opacity-60",
                )}
              >
                {filled ? <span className="size-3 rounded-full bg-ink" /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ErrorText({ id, error }: { id: string; error: string }) {
  return (
    <p id={id} role="alert" className={cn("text-[15px] font-medium text-red-600 dark:text-red-400", !error && "sr-only")}>
      {error}
    </p>
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
