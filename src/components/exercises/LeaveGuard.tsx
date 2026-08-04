"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import SpeakButton from "@/components/SpeakButton";
import type { Lang } from "@/lib/i18n";

/**
 * Asks before a child walks out of an activity they are partway through.
 *
 * Worth being precise about what it says. Work in progress is *not* lost:
 * every word is saved the moment it is scored, and the session's totals and
 * minutes are flushed on the way out. Warning a child that their progress will
 * be discarded would be untrue, and untrue in a direction that matters — a
 * child with dyslexia doing a tiring task should be able to stop without being
 * told they are throwing away their work. What they actually lose is finishing
 * the round.
 *
 * So this is a guard against the accidental tap, not a threat.
 *
 * In-app navigation is caught by intercepting link clicks during the capture
 * phase, because the App Router exposes no cancellable route-change event.
 * Closing the tab is caught by beforeunload, whose wording the browser owns.
 */
export default function LeaveGuard({
  active,
  lang,
  rate,
  strings,
}: {
  active: boolean;
  lang: Lang;
  rate?: number;
  strings: { title: string; body: string; stay: string; leave: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      // Leave downloads, new tabs and external links alone — the CSV export
      // links on other screens are anchors too.
      if (!href.startsWith("/") || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      if (href === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setPending(href);
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // Capture phase, so this runs before the router's own click handler.
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);

  if (!pending) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 text-center shadow-lg sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-peach-soft text-peach-deep">
          <DoorOpen size={28} />
        </div>
        <h2 id="leave-title" className="mt-4 text-2xl font-extrabold text-ink">
          {strings.title}
        </h2>
        <p className="mt-2 text-base font-semibold text-ink-soft">{strings.body}</p>

        <div className="mt-3 flex justify-center">
          <SpeakButton text={`${strings.title} ${strings.body}`} lang={lang} rate={rate} size="sm" />
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            autoFocus
            onClick={() => setPending(null)}
            className="flex-1 rounded-2xl bg-primary px-6 py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark"
          >
            {strings.stay}
          </button>
          <button
            onClick={() => {
              const href = pending;
              setPending(null);
              router.push(href);
            }}
            className="flex-1 rounded-2xl border border-line bg-card px-6 py-3.5 text-lg font-bold text-ink-soft transition hover:bg-cream-dark"
          >
            {strings.leave}
          </button>
        </div>
      </div>
    </div>
  );
}
