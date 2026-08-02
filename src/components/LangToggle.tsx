"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LANG_COOKIE, normalizeLang, type Lang } from "@/lib/i18n";

const LANG_EVENT = "lexora-lang-change";

function readCookieLang(): Lang {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
  return normalizeLang(match?.[1]);
}

// Module-scope cookie writer: called from event handlers only.
function writeCookieLang(next: Lang) {
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.dispatchEvent(new Event(LANG_EVENT));
}

function subscribeLang(callback: () => void) {
  window.addEventListener(LANG_EVENT, callback);
  return () => window.removeEventListener(LANG_EVENT, callback);
}

/** Client-side language reader for pages that are fully client components. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, readCookieLang, () => "en");
}

/**
 * EN / FIL segmented toggle. Sets a cookie, notifies client listeners, and
 * refreshes server components. `stretch` fills the parent width with two
 * equal halves (used at the bottom of the sidebar).
 */
export default function LangToggle({ lang, stretch = false }: { lang: Lang; stretch?: boolean }) {
  const router = useRouter();

  function setLang(next: Lang) {
    if (next === lang) return;
    writeCookieLang(next);
    router.refresh();
  }

  const btn = (value: Lang, label: string) => (
    <button
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      aria-label={value === "en" ? "English" : "Filipino"}
      className={`rounded-full py-1.5 text-xs font-extrabold transition ${
        stretch ? "flex-1 text-center" : "px-3"
      } ${lang === value ? "bg-primary text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div
      className={`items-center gap-0.5 rounded-full border border-line bg-card p-0.5 ${
        stretch ? "flex w-full" : "inline-flex"
      }`}
      role="group"
      aria-label="Language"
    >
      {btn("en", "EN")}
      {btn("fil", "FIL")}
    </div>
  );
}
