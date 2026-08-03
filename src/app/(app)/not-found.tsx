import Link from "next/link";
import { Home } from "lucide-react";

/**
 * Not-found boundary for signed-in pages. It has to live inside this route
 * group: without it, `notFound()` calls from pages here fall through to the
 * root boundary and the response comes back 200 instead of 404.
 * Keeping it here also preserves the sidebar, so a learner is never stranded.
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-line bg-card p-8 text-center shadow-sm sm:p-10">
      <span className="text-5xl" aria-hidden>
        🔎
      </span>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 font-semibold text-ink-soft">
        The link may be out of date. Everything else is still here.
      </p>
      <Link
        href="/dashboard"
        className="mt-7 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
      >
        <Home size={18} /> Back to dashboard
      </Link>
    </div>
  );
}
