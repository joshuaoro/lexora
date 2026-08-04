"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import Logo, { LogoMark } from "@/components/Logo";
import LangToggle from "@/components/LangToggle";
import { getDict, type Lang } from "@/lib/i18n";
import SyllableWord from "@/components/SyllableWord";

/**
 * The frame around signing in and registering.
 *
 * These pages were a single narrow card floating in an otherwise empty screen —
 * at desktop width, around four hundred pixels of form in fourteen hundred of
 * nothing, which reads as unfinished and tells a parent or a specialist nothing
 * about what they are about to sign into.
 *
 * The panel fills that space with the one thing the page was missing: what this
 * is and who it is for. It is hidden below the large breakpoint, where the form
 * is the whole screen anyway and a decorative half would only push it down.
 *
 * Every value on the panel is full-strength cream on the primary (5.2:1).
 * Dimming it to 85% looked better and measured 4.3:1, which fails AA — a
 * reminder that the eye is not the instrument here. The word chip sits on the
 * darker primary rather than a white wash, because a translucent white tile
 * lifts the background to #5d7898 and takes even full cream down to 4.2:1.
 */
export default function AuthShell({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const t = getDict(lang);

  return (
    <main className="min-h-screen bg-cream lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel — desktop only ─────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-cream lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* Soft shapes, purely decorative: they give the flat panel some depth
            without adding an image to download. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/6"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5"
        />

        <Link href="/" aria-label="LEXORA home" className="relative flex items-center gap-3">
          <LogoMark size={44} />
          <span className="text-2xl font-extrabold tracking-wide text-cream">LEXORA</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight xl:text-4xl">{t.auth.panelTitle}</h2>
          <p className="mt-4 text-lg font-semibold text-cream">{t.auth.panelSub}</p>

          <ul className="mt-8 space-y-3">
            {t.auth.panelPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 font-semibold">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-peach text-peach-deep">
                  <Check size={15} strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>

          {/* The same word the app opens with, so the panel shows the product
              rather than only describing it. */}
          <div className="mt-10 inline-flex flex-col items-center rounded-3xl bg-primary-dark px-9 py-6">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-cream">
              {t.session.readWordAloud}
            </span>
            <SyllableWord
              syllables="ba-hay"
              className="mt-2 block text-5xl font-bold text-cream"
              // On the dark panel the separator needs to lift off the navy
              // rather than recede into it, so it takes the accent instead.
              dotClassName="text-peach"
            />
          </div>
        </div>

        <p className="relative text-xs font-semibold text-cream">{t.home.footerNote}</p>
      </aside>

      {/* ── Form side ──────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-10">
        {/* Kept out of the centring below — otherwise the toggle is centred
            along with the form and the card floats above the middle. */}
        <div className="flex shrink-0 items-center justify-between lg:justify-end">
          {/* The wordmark repeats on small screens, where the panel is hidden. */}
          <Link href="/" aria-label="LEXORA home" className="lg:hidden">
            <Logo />
          </Link>
          <LangToggle lang={lang} />
        </div>

        <div className="flex flex-1 items-center py-6">
          <div className="mx-auto w-full max-w-md lg:max-w-lg">{children}</div>
        </div>
      </div>
    </main>
  );
}
