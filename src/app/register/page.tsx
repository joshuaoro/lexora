"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import LangToggle, { useLang } from "@/components/LangToggle";
import { getDict } from "@/lib/i18n";
import { tryFetch } from "@/lib/net";

export default function RegisterPage() {
  const router = useRouter();
  const lang = useLang();
  const t = getDict(lang).auth;

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "LEARNER" as "LEARNER" | "SPECIALIST",
    code: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await tryFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
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

  const input =
    "w-full rounded-xl border border-line bg-cream/60 px-4 py-2.5 text-ink outline-none transition focus:border-primary focus:bg-white";

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
          <h1 className="text-xl font-extrabold text-ink">{t.registerTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t.registerSub}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-ink-soft">
                {t.name}
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={input}
                placeholder="Juan"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-ink-soft">
                {t.email}
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={input}
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
                minLength={6}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={input}
                placeholder={t.passwordHint}
              />
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-bold text-ink-soft">{t.iAm}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["LEARNER", "SPECIALIST"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set("role", r)}
                    className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition ${
                      form.role === r
                        ? "border-primary bg-primary-soft text-ink"
                        : "border-line bg-white text-ink-muted hover:border-primary/40"
                    }`}
                    aria-pressed={form.role === r}
                  >
                    {r === "LEARNER" ? t.roleLearner : t.roleSpecialist}
                  </button>
                ))}
              </div>
            </fieldset>

            {form.role === "SPECIALIST" && (
              <div>
                <label htmlFor="code" className="mb-1.5 block text-sm font-bold text-ink-soft">
                  {t.accessCode}
                </label>
                <input
                  id="code"
                  required
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  className={input}
                  placeholder={t.accessCodePlaceholder}
                />
              </div>
            )}

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
              {busy ? t.creating : t.create}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-muted">
            {t.haveAccount}{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              {t.signIn}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
