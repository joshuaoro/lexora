"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";

/**
 * Friendly recovery screen for a failed page. Children use this app, so it
 * avoids stack traces and blame, offers one obvious action, and never leaves
 * them stranded.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-line bg-card p-8 text-center shadow-sm sm:p-10">
      <span className="text-5xl" aria-hidden>
        🌧️
      </span>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">Something went wrong</h1>
      <p className="mt-2 font-semibold text-ink-soft">
        That page could not load. This is usually a connection problem — please try again.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
        >
          <RefreshCw size={18} /> Try again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-6 py-3 font-bold text-ink transition hover:bg-cream-dark"
        >
          <Home size={18} /> Back to dashboard
        </Link>
      </div>

      {error.digest && (
        <p className="mt-6 text-xs font-semibold text-ink-muted">
          If you need to report this, the reference is {error.digest}
        </p>
      )}
    </div>
  );
}
