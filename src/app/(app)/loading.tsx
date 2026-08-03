/**
 * Shown while a page's data loads. Without this a learner on a slow connection
 * sees a blank screen and often taps again, so the wait is made explicit and
 * calm rather than invisible.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="h-4 w-28 rounded-full bg-cream-dark" />
      <div className="mt-3 h-9 w-56 rounded-xl bg-cream-dark" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-card" />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="h-80 rounded-2xl border border-line bg-card" />
        <div className="h-80 rounded-2xl border border-line bg-card" />
      </div>
    </div>
  );
}
