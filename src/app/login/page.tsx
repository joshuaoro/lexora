"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import LangToggle, { useLang } from "@/components/LangToggle";
import { getDict } from "@/lib/i18n";
import { tryFetch } from "@/lib/net";

/**
 * Shown when a guard sent the visitor here because their session pointed at a
 * record that no longer exists — an erased learner, or a reseeded database.
 * Without it they would arrive back at a blank sign-in screen with no idea why.
 *
 * It reads the query string, so it sits behind Suspense to keep the rest of the
 * page prerendered.
 */
function ExpiredNotice({ message }: { message: string }) {
  const expired = useSearchParams().get("expired") === "1";
  if (!expired) return null;
  return (
    <p
      role="status"
      className="mt-4 rounded-xl bg-peach-soft px-4 py-2.5 text-sm font-semibold text-peach-deep"
    >
      {message}
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const lang = useLang();
  const t = getDict(lang).auth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await tryFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    // Without this the button stays on "Signing in…" for good when the wifi
    // drops, and nothing on screen says why.
    if (!res) {
      setError("No internet connection. Check it and try again.");
      setBusy(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    router.push(data.role === "SPECIALIST" ? "/specialist" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="LEXORA home">
            <Logo size="lg" />
          </Link>
          <LangToggle lang={lang} />
        </div>
        <div className="rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-extrabold text-ink">{t.signinTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t.signinSub}</p>

          <Suspense fallback={null}>
            <ExpiredNotice message={t.expired} />
          </Suspense>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-ink-soft">
                {t.email}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-cream/60 px-4 py-2.5 text-ink outline-none transition focus:border-primary focus:bg-white"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-bold text-ink-soft">
                {t.password}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-cream/60 px-4 py-2.5 text-ink outline-none transition focus:border-primary focus:bg-white"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-soft px-4 py-2.5 text-sm font-semibold text-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3 font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? t.signingIn : t.signIn}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-muted">
            {t.newHere}{" "}
            <Link href="/register" className="font-bold text-primary hover:underline">
              {t.createAccount}
            </Link>
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-line bg-cream-dark/50 p-4 text-xs text-ink-soft">
          <p className="font-bold">Demo accounts (password: lexora123)</p>
          <ul className="mt-1 space-y-0.5">
            <li>learner1@lexora.ph — learner with sample history</li>
            <li>learner2@lexora.ph — learner, fresh account</li>
            <li>specialist@lexora.ph — reading specialist</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
