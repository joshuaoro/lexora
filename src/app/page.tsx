import Link from "next/link";
import {
  BookOpen,
  Mic,
  Sparkles,
  Volume2,
  ListChecks,
  LineChart,
  Eye,
  Puzzle,
  Users,
  ArrowRight,
  Check,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import Logo from "@/components/Logo";
import LangToggle from "@/components/LangToggle";

const FEATURE_ICONS = [
  { icon: Eye, tone: "bg-primary-soft text-primary" },
  { icon: Volume2, tone: "bg-peach-soft text-peach-deep" },
  { icon: Mic, tone: "bg-green-soft text-green" },
  { icon: Puzzle, tone: "bg-orange-soft text-orange" },
  { icon: ListChecks, tone: "bg-primary-soft text-primary" },
  { icon: LineChart, tone: "bg-peach-soft text-peach-deep" },
];

export default async function HomePage() {
  const [session, lang] = await Promise.all([getSession(), getLang()]);
  const t = getDict(lang).home;

  const appHref = session
    ? session.role === "SPECIALIST"
      ? "/specialist"
      : "/dashboard"
    : "/register";

  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex flex-wrap items-center gap-2.5">
          <LangToggle lang={lang} />
          {session ? (
            <Link
              href={appHref}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-primary-dark"
            >
              {t.openDash} <ArrowRight size={17} />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-4 py-2.5 font-bold text-ink transition hover:bg-cream-dark sm:px-5"
              >
                {t.signIn}
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-primary px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-primary-dark sm:px-5"
              >
                {t.getStarted}
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-peach-soft px-4 py-1.5 text-sm font-bold text-peach-deep">
            <Sparkles size={15} /> {t.badge}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            {t.h1a}
            <span className="text-primary">{t.h1Highlight}</span>
            {t.h1b}
          </h1>
          <p className="mt-5 max-w-xl text-lg font-semibold text-ink-soft">{t.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={appHref}
              className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark sm:px-7"
            >
              <BookOpen size={20} /> {session ? t.ctaContinue : t.ctaStart}
            </Link>
            {!session && (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-2xl border border-line bg-card px-6 py-3.5 text-lg font-bold text-ink transition hover:bg-cream-dark sm:px-7"
              >
                {t.haveAccount}
              </Link>
            )}
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink-muted">
            {t.checks.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <Check size={15} className="text-green" /> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Illustrative cards */}
        <div className="relative mx-auto w-full max-w-md" aria-hidden>
          <div className="rounded-3xl border border-line bg-card p-8 text-center shadow-md">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.mockPrompt}
            </p>
            <p
              className="mt-4 text-5xl font-bold text-ink sm:text-6xl"
              style={{ fontFamily: "var(--font-lexend)", letterSpacing: "0.08em" }}
            >
              ba·hay
            </p>
            <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <Mic size={28} />
            </div>
            <p className="mt-3 text-sm font-bold text-ink-muted">{t.mockListening}</p>
          </div>
          <div className="absolute -left-2 -bottom-6 flex rotate-[-4deg] items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 font-extrabold text-green shadow-md sm:-left-6 sm:px-5">
            <Check size={20} /> {t.mockGood}
          </div>
          <div className="absolute -right-2 -top-5 rotate-[5deg] rounded-2xl border border-line bg-card px-4 py-3 shadow-md sm:-right-4 sm:px-5">
            <p className="text-2xl font-extrabold text-ink">87%</p>
            <p className="text-xs font-bold text-ink-muted">{t.mockAcc}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-line bg-card/60 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-ink">{t.featuresTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center font-semibold text-ink-muted">
            {t.featuresSub}
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const { icon: Icon, tone } = FEATURE_ICONS[i];
              return (
                <div key={f.title} className="rounded-3xl border border-line bg-card p-6 shadow-sm">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
                    <Icon size={23} strokeWidth={2.2} />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-ink">{f.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-ink-soft">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-ink">{t.howTitle}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {t.steps.map((step, i) => (
            <div key={step.title} className="rounded-3xl border border-line bg-card p-6 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-ink">{step.title}</h3>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For specialists */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-line bg-primary-soft/60 p-6 sm:p-10">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
              <Users size={26} className="text-primary" /> {t.specTitle}
            </h2>
            <p className="mt-2 font-semibold text-ink-soft">{t.specDesc}</p>
          </div>
          <Link
            href={session?.role === "SPECIALIST" ? "/specialist" : "/register"}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 font-extrabold text-white shadow-sm transition hover:bg-primary-dark sm:px-7"
          >
            {session?.role === "SPECIALIST" ? t.specCtaOpen : t.specCta}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-cream-dark/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <Logo />
            <Link
              href="/privacy"
              className="mt-2 inline-block text-xs font-bold text-primary hover:underline"
            >
              {t.privacyLink}
            </Link>
          </div>
          <p className="max-w-xl text-xs font-semibold text-ink-muted">{t.footerNote}</p>
        </div>
      </footer>
    </main>
  );
}
